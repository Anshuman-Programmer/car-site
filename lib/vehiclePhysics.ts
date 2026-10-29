import { resolveCircle } from "./world/colliders";
import { isDrivable, nearestRoadSample, roadEdgeAt, surfaceAt } from "./world/terrain";

/** All the handling knobs in one place. Units: metres, seconds, radians. */
export const vehicleConfig = {
  maxSpeed: 25, // ≈ 90 km/h
  maxReverse: 7,
  accel: 21,
  reverseAccel: 10,
  brake: 44,
  handbrake: 9,
  rollingDrag: 0.8,
  airDrag: 0.004,
  offroadMaxFactor: 0.74,
  offroadDrag: 1.6,
  maxSteer: 0.52,
  /** Steering lock at top speed, as a fraction of maxSteer. */
  highSpeedSteer: 0.34,
  steerSpeed: 2.6,
  steerReturn: 5.0,
  wheelBase: 2.6,
  grip: 9,
  handbrakeGrip: 1.8,
  gravity: 9.8,
  slopeFactor: 0.55,
  /** Two collision circles along the body. */
  bodyRadius: 0.8,
  bodyOffset: 0.7,
  wheelRadius: 0.385,
  fixedStep: 1 / 120,
};

export type VehicleConfig = typeof vehicleConfig;

export interface DriveInput {
  throttle: number; // 0..1
  brake: number; // 0..1 (brake, then reverse)
  steer: number; // -1..1, +1 = right
  handbrake: boolean;
}

export interface VehicleSim {
  x: number;
  z: number;
  y: number;
  heading: number;
  vx: number;
  vz: number;
  steer: number;
  forward: number;
  yawRate: number;
  /** Terrain-following attitude. */
  pitch: number;
  roll: number;
  /** Visual body motion (spring-damped). */
  bodyPitch: number;
  bodyPitchVel: number;
  bodyRoll: number;
  bodyRollVel: number;
  wheelSpin: number;
  onRoad: boolean;
  blocked: boolean;
  impact: number;
  safe: { x: number; z: number; heading: number };
  safeTimer: number;
  acc: number;
}

export function createSim(x: number, z: number, heading: number): VehicleSim {
  return {
    x,
    z,
    y: surfaceAt(x, z),
    heading,
    vx: 0,
    vz: 0,
    steer: 0,
    forward: 0,
    yawRate: 0,
    pitch: 0,
    roll: 0,
    bodyPitch: 0,
    bodyPitchVel: 0,
    bodyRoll: 0,
    bodyRollVel: 0,
    wheelSpin: 0,
    onRoad: true,
    blocked: false,
    impact: 0,
    safe: { x, z, heading },
    safeTimer: 0,
    acc: 0,
  };
}

const approach = (v: number, target: number, rate: number) =>
  v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);

function fixedStep(sim: VehicleSim, inp: DriveInput, dt: number, cfg: VehicleConfig) {
  const sinH = Math.sin(sim.heading);
  const cosH = Math.cos(sim.heading);
  // forward = (sin h, cos h); right = (-cos h, sin h)
  let vF = sim.vx * sinH + sim.vz * cosH;
  let vR = sim.vx * -cosH + sim.vz * sinH;
  const absF = Math.abs(vF);
  const prevF = vF;

  // Steering: speed-sensitive lock, eased toward the target.
  const lock = cfg.maxSteer * (1 - (1 - cfg.highSpeedSteer) * Math.min(1, absF / cfg.maxSpeed));
  const target = inp.steer * lock;
  sim.steer = approach(sim.steer, target, (inp.steer === 0 ? cfg.steerReturn : cfg.steerSpeed) * dt);

  sim.onRoad = roadEdgeAt(sim.x, sim.z) < 0.4;
  const maxF = cfg.maxSpeed * (sim.onRoad ? 1 : cfg.offroadMaxFactor);

  // Longitudinal forces.
  let a = 0;
  if (inp.throttle > 0) {
    if (vF < -0.4) a += cfg.brake * inp.throttle;
    else a += cfg.accel * inp.throttle * Math.max(0, 1 - (vF / maxF) ** 4);
  }
  if (inp.brake > 0) {
    if (vF > 0.4) a -= cfg.brake * inp.brake;
    else a -= cfg.reverseAccel * inp.brake * Math.max(0, 1 - (vF / cfg.maxReverse) ** 2);
  }
  // Gravity along the slope.
  const e = 1.2;
  const slope = (surfaceAt(sim.x + sinH * e, sim.z + cosH * e) - surfaceAt(sim.x - sinH * e, sim.z - cosH * e)) / (2 * e);
  a -= cfg.gravity * slope * cfg.slopeFactor;
  vF += a * dt;

  // Drag never flips the direction of travel.
  let drag = cfg.rollingDrag + (sim.onRoad ? 0 : cfg.offroadDrag) + cfg.airDrag * vF * vF;
  if (inp.handbrake) drag += cfg.handbrake;
  if (inp.throttle === 0 && inp.brake === 0) drag += 2.4; // engine braking
  if (absF > cfg.maxSpeed) drag += 4;
  const dv = drag * dt;
  vF = Math.abs(vF) <= dv ? 0 : vF - Math.sign(vF) * dv;

  // Lateral grip — lower with the handbrake for a little slide.
  vR *= Math.exp(-(inp.handbrake ? cfg.handbrakeGrip : cfg.grip) * dt);

  // Yaw from a bicycle model; +steer turns right (heading decreases).
  sim.yawRate = -(vF / cfg.wheelBase) * Math.tan(sim.steer) * (inp.handbrake ? 1.35 : 1);
  sim.heading += sim.yawRate * dt;

  const s2 = Math.sin(sim.heading);
  const c2 = Math.cos(sim.heading);
  sim.vx = s2 * vF - c2 * vR;
  sim.vz = c2 * vF + s2 * vR;

  // Move, respecting the island boundary (slide along it).
  let nx = sim.x + sim.vx * dt;
  let nz = sim.z + sim.vz * dt;
  const ok = (x: number, z: number) =>
    isDrivable(x, z) && isDrivable(x + s2 * 2, z + c2 * 2) && isDrivable(x - s2 * 2, z - c2 * 2);
  sim.blocked = false;
  if (!ok(nx, nz)) {
    sim.blocked = true;
    if (ok(nx, sim.z)) {
      nz = sim.z;
      sim.vz *= -0.2;
    } else if (ok(sim.x, nz)) {
      nx = sim.x;
      sim.vx *= -0.2;
    } else {
      nx = sim.x;
      nz = sim.z;
      sim.vx *= -0.25;
      sim.vz *= -0.25;
    }
    sim.impact = Math.max(sim.impact, Math.min(1, absF / 12));
  }

  // Static colliders: front and rear circles.
  for (const off of [cfg.bodyOffset, -cfg.bodyOffset]) {
    const cx = nx + s2 * off;
    const cz = nz + c2 * off;
    const hit = resolveCircle(cx, cz, cfg.bodyRadius);
    if (!hit) continue;
    const px = hit.x - cx;
    const pz = hit.z - cz;
    if (!ok(nx + px, nz + pz)) continue;
    nx += px;
    nz += pz;
    const vn = sim.vx * hit.nx + sim.vz * hit.nz;
    if (vn < 0) {
      sim.vx -= hit.nx * vn * 1.25;
      sim.vz -= hit.nz * vn * 1.25;
      sim.vx *= 0.9;
      sim.vz *= 0.9;
      sim.impact = Math.max(sim.impact, Math.min(1, -vn / 10));
      sim.blocked = true;
    }
  }
  sim.x = nx;
  sim.z = nz;
  sim.forward = sim.vx * s2 + sim.vz * c2;

  // Visual body motion: squat under acceleration, lean out of corners.
  const aLong = (sim.forward - prevF) / dt;
  const aLat = sim.forward * sim.yawRate;
  const spring = (pos: number, vel: number, target: number) => {
    const acc = (target - pos) * 70 - vel * 11;
    vel += acc * dt;
    return [pos + vel * dt, vel] as const;
  };
  [sim.bodyPitch, sim.bodyPitchVel] = spring(sim.bodyPitch, sim.bodyPitchVel, Math.max(-0.07, Math.min(0.07, -aLong * 0.006)));
  [sim.bodyRoll, sim.bodyRollVel] = spring(sim.bodyRoll, sim.bodyRollVel, Math.max(-0.09, Math.min(0.09, aLat * 0.012)));

  sim.wheelSpin += (sim.forward / cfg.wheelRadius) * dt;
}

/** Advance with a fixed timestep so handling is identical at 30, 60 or 144 fps. */
export function stepVehicle(sim: VehicleSim, inp: DriveInput, frameDt: number, cfg: VehicleConfig = vehicleConfig) {
  sim.acc += Math.min(frameDt, 0.1);
  let steps = 0;
  while (sim.acc >= cfg.fixedStep && steps < 12) {
    fixedStep(sim, inp, cfg.fixedStep, cfg);
    sim.acc -= cfg.fixedStep;
    steps++;
  }
  sim.impact *= Math.exp(-6 * frameDt);

  // Terrain attitude from four contact points.
  const sinH = Math.sin(sim.heading);
  const cosH = Math.cos(sim.heading);
  const L = 1.3;
  const W = 0.9;
  const hF = surfaceAt(sim.x + sinH * L, sim.z + cosH * L);
  const hB = surfaceAt(sim.x - sinH * L, sim.z - cosH * L);
  const hR = surfaceAt(sim.x - cosH * W, sim.z + sinH * W);
  const hL = surfaceAt(sim.x + cosH * W, sim.z - sinH * W);
  const k = 1 - Math.exp(-14 * frameDt);
  sim.pitch += (Math.atan2(hB - hF, 2 * L) - sim.pitch) * k;
  // Model faces +z, so local +x is the car's left side: positive roll lifts the left.
  sim.roll += (Math.atan2(hL - hR, 2 * W) - sim.roll) * k;
  const yTarget = (hF + hB + hL + hR) / 4;
  sim.y += (yTarget - sim.y) * (1 - Math.exp(-20 * frameDt));

  // Remember the latest on-road spot for resets.
  sim.safeTimer += frameDt;
  if (sim.safeTimer > 0.5) {
    sim.safeTimer = 0;
    if (sim.onRoad && !sim.blocked) sim.safe = { x: sim.x, z: sim.z, heading: sim.heading };
  }
}

/** Put the car back on the nearest road point to its last safe spot, facing along the road. */
export function resetVehicle(sim: VehicleSim) {
  const { sample } = nearestRoadSample(sim.safe.x, sim.safe.z, true);
  let heading = Math.atan2(sample.tx, sample.tz);
  // Keep roughly the direction the driver was going.
  if (Math.cos(heading - sim.safe.heading) < 0) heading += Math.PI;
  sim.x = sample.x;
  sim.z = sample.z;
  sim.heading = heading;
  sim.vx = sim.vz = 0;
  sim.steer = 0;
  sim.forward = 0;
  sim.y = surfaceAt(sim.x, sim.z);
  sim.bodyPitch = sim.bodyRoll = sim.bodyPitchVel = sim.bodyRollVel = 0;
}
