import { resolveCircle } from "./world/colliders";
import { BREAK_KINDS, breakablesNear, smash, type Breakable } from "./world/breakables";
import { COURSE } from "./world/layout";
import { heightAt, nearestRoadSample, roadEdgeAt, surfaceAt, waterAt } from "./world/terrain";

/**
 * A small rigid-body car. Four spring-damper wheels hold the chassis up, so
 * it pitches, rolls, bounces and can leave the ground. Tyres make force from
 * slip angle within a friction circle that scales with each axle's load, so
 * weight transfer, understeer and slides come out of the model rather than
 * being scripted. Everything is per unit mass. Units: metres, seconds, radians.
 */
export const vehicleConfig = {
  maxSpeed: 25, // ≈ 90 km/h
  maxReverse: 7,
  /** Engine pull at standstill, m/s², before traction limits. */
  engineAccel: 22,
  reverseAccel: 10,
  /** Brake demand, m/s²; the tyres cap what actually reaches the road. */
  brakeDecel: 16,
  rollingDrag: 0.3,
  airDrag: 0.0045,
  engineBraking: 1.6,
  /** Fraction of drive sent to the front axle. */
  frontDrive: 0.4,
  /** Traction control: drive never asks for more than this share of an axle's grip. */
  tractionLimit: 0.95,
  maxSteer: 0.52,
  /** Steering lock at top speed, as a fraction of maxSteer. */
  highSpeedSteer: 0.34,
  steerSpeed: 3.6,
  steerReturn: 7.0,
  /** Stability assist, 1/s: pulls the yaw rate toward the path the wheels point along, within the grip available. */
  stability: 3,
  /** Axle distances from the centre of mass and half the track width (match the car model at 0.7 scale). */
  axleFront: 1.16,
  axleRear: 1.16,
  halfTrack: 0.83,
  cgHeight: 0.5,
  /** Moments of inertia per unit mass, m². */
  yawInertia: 1.6,
  pitchInertia: 1.2,
  rollInertia: 0.5,
  /** Per-wheel spring and damper, per unit car mass. */
  springK: 20,
  damperC: 2.6,
  /** Compression where the bump stops start, metres. */
  bumpStop: 0.3,
  /** Lateral force per radian of slip for one axle at its static load, m/s². */
  cornering: 95,
  /** Rear tyres a little stiffer than the front: mild understeer keeps the car stable at speed. */
  rearCornering: 1.35,
  grip: { road: 1.2, dirt: 1.0, grass: 0.9, water: 0.7 },
  surfaceDrag: { road: 0, dirt: 0.35, grass: 1.0, water: 1.6 },
  /** How far below the water surface the wheels find footing: the car wades through lakes, streams and the sea. */
  wadeDepth: 0.45,
  /** Extra drag per (m/s)² when fully in water. */
  waterDrag: 0.035,
  /** Uphill gradient along the direction of travel that counts as a wall. Inland hills stay under 1.4. */
  wallSlope: 1.8,
  /** The sea mesh ends here. */
  worldEdge: 480,
  /** Rear grip multiplier with the handbrake on. */
  handbrakeGrip: 0.4,
  gravity: 9.8,
  /** Two collision circles along the body. */
  bodyRadius: 0.8,
  bodyOffset: 0.7,
  restitution: 0.25,
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
  /** Chassis reference height: ground level under the car at static ride height. */
  y: number;
  vx: number;
  vy: number;
  vz: number;
  /** Yaw; forward = (sin, cos). Increasing heading turns left. */
  heading: number;
  yawRate: number;
  /** Positive pitch lowers the nose; positive roll lifts the left side. */
  pitch: number;
  pitchRate: number;
  roll: number;
  rollRate: number;
  steer: number;
  forward: number;
  /** Spring compression per wheel: front-left, front-right, rear-left, rear-right. */
  comp: [number, number, number, number];
  wheelsDown: number;
  wheelSpin: number;
  onRoad: boolean;
  blocked: boolean;
  /** Strongest knock since the last frame, 0..1. */
  impact: number;
  /** Strongest smash since the last frame, 0..1. */
  smashed: number;
  time: number;
  safe: { x: number; z: number; heading: number };
  safeTimer: number;
  acc: number;
}

const sag = (cfg: VehicleConfig) => cfg.gravity / (4 * cfg.springK);

export function createSim(x: number, z: number, heading: number, cfg: VehicleConfig = vehicleConfig): VehicleSim {
  const s = sag(cfg);
  return {
    x,
    z,
    y: groundAt(x, z),
    vx: 0,
    vy: 0,
    vz: 0,
    heading,
    yawRate: 0,
    pitch: 0,
    pitchRate: 0,
    roll: 0,
    rollRate: 0,
    steer: 0,
    forward: 0,
    comp: [s, s, s, s],
    wheelsDown: 4,
    wheelSpin: 0,
    onRoad: true,
    blocked: false,
    impact: 0,
    smashed: 0,
    time: 0,
    safe: { x, z, heading },
    safeTimer: 0,
    acc: 0,
  };
}

const approach = (v: number, target: number, rate: number) =>
  v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Scale (fx, fy) down to fit inside a circle of radius `max`. */
function frictionCircle(fx: number, fy: number, max: number): [number, number] {
  const m = Math.hypot(fx, fy);
  if (m <= max || m === 0) return [fx, fy];
  const k = max / m;
  return [fx * k, fy * k];
}

const nearby: Breakable[] = [];

/** Footprint offsets along the wheel's travel, with how far the round tyre sits above each. */
const TYRE = [0, 0.18, -0.18, 0.3, -0.3].map((u) => [u, vehicleConfig.wheelRadius - Math.sqrt(vehicleConfig.wheelRadius ** 2 - u * u)] as const);

/** What the wheels stand on: the surface, or wading depth where the water is deeper than that. */
const groundAt = (x: number, z: number) => Math.max(surfaceAt(x, z), waterAt(x, z) - vehicleConfig.wadeDepth);
/** The same over bare terrain, for spotting walls without tripping on course props or the bridge. */
const terrainAt = (x: number, z: number) => Math.max(heightAt(x, z), waterAt(x, z) - vehicleConfig.wadeDepth);

/** Ground as a rolling tyre feels it: the highest point under its curve, so edges become ramps. */
function tyreGround(x: number, z: number, fx: number, fz: number) {
  let h = -Infinity;
  for (const [u, lift] of TYRE) h = Math.max(h, groundAt(x + fx * u, z + fz * u) - lift);
  return h;
}

/** True where moving along (dx, dz) would drive straight up something too steep to climb: a cliff face or bank. */
function isWall(x: number, z: number, dx: number, dz: number, cfg: VehicleConfig) {
  if (Math.abs(x) > cfg.worldEdge || Math.abs(z) > cfg.worldEdge) return true;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) return false;
  const e = 0.6;
  const gx = (terrainAt(x + e, z) - terrainAt(x - e, z)) / (2 * e);
  const gz = (terrainAt(x, z + e) - terrainAt(x, z - e)) / (2 * e);
  return (gx * dx + gz * dz) / l > cfg.wallSlope;
}

function fixedStep(sim: VehicleSim, inp: DriveInput, dt: number, cfg: VehicleConfig) {
  const g = cfg.gravity;
  const A = cfg.axleFront;
  const B = cfg.axleRear;
  const W = cfg.halfTrack;
  const sinH = Math.sin(sim.heading);
  const cosH = Math.cos(sim.heading);
  // forward = (sin h, cos h); left = (cos h, -sin h)
  let vF = sim.vx * sinH + sim.vz * cosH;
  let vL = sim.vx * cosH - sim.vz * sinH;
  const absF = Math.abs(vF);

  // Steering: speed-sensitive lock, eased toward the target. +steer = right.
  const lock = cfg.maxSteer * (1 - (1 - cfg.highSpeedSteer) * Math.min(1, absF / cfg.maxSpeed));
  sim.steer = approach(sim.steer, inp.steer * lock, (inp.steer === 0 ? cfg.steerReturn : cfg.steerSpeed) * dt);
  const delta = -sim.steer; // positive turns left

  sim.onRoad = roadEdgeAt(sim.x, sim.z) < 0.4;
  // 0 dry .. 1 wheels fully under.
  const wet = clamp((waterAt(sim.x, sim.z) - surfaceAt(sim.x, sim.z)) / cfg.wadeDepth, 0, 1);
  const surface =
    wet > 0.5 ? "water" : !sim.onRoad ? "grass" : Math.hypot(sim.x - COURSE.x, sim.z - COURSE.z) < COURSE.radius + 6 ? "dirt" : "road";
  const mu = cfg.grip[surface];

  // ---- suspension: vertical support, attitude torques, and the push of sloped ground
  const sp = Math.sin(sim.pitch);
  const sr = Math.sin(sim.roll);
  const s0 = sag(cfg);
  let lift = 0;
  let tPitch = 0;
  let tRoll = 0;
  let nFront = 0;
  let nRear = 0;
  let pushX = 0;
  let pushZ = 0;
  let deepest = 0;
  sim.wheelsDown = 0;
  for (let i = 0; i < 4; i++) {
    const lz = i < 2 ? A : -B;
    const lx = i % 2 === 0 ? W : -W;
    const wx = sim.x + sinH * lz + cosH * lx;
    const wz = sim.z + cosH * lz - sinH * lx;
    const ground = tyreGround(wx, wz, sinH, cosH);
    const c = ground - (sim.y + lx * sr - lz * sp) + s0;
    // A wheel off the ground hangs at full droop (zero compression). Dampers saturate, like real valving.
    const cRate = clamp((Math.max(c, 0) - sim.comp[i]) / dt, -4, 4);
    sim.comp[i] = Math.max(c, 0);
    if (c <= 0) continue;
    let f = cfg.springK * c + cfg.damperC * cRate;
    if (c > cfg.bumpStop) f += cfg.springK * 8 * (c - cfg.bumpStop) + cfg.damperC * 2 * Math.max(0, cRate);
    f = clamp(f, 0, 45);
    if (f === 0) continue;
    sim.wheelsDown++;
    deepest = Math.max(deepest, c);
    const e = 0.25;
    const hx = clamp((groundAt(wx + e, wz) - groundAt(wx - e, wz)) / (2 * e), -1.5, 1.5);
    const hz = clamp((groundAt(wx, wz + e) - groundAt(wx, wz - e)) / (2 * e), -1.5, 1.5);
    pushX -= hx * f;
    pushZ -= hz * f;
    lift += f;
    tPitch -= f * lz;
    tRoll += f * lx;
    if (i < 2) nFront += f;
    else nRear += f;
  }

  // ---- tyres, in each axle's own frame
  const staticLoad = g / 2;
  const vLf = vL + sim.yawRate * A;
  const vLr = vL - sim.yawRate * B;

  // Drive and reverse go through the tyres; brakes and drag are applied below.
  let drive = 0;
  if (inp.throttle > 0 && vF > -0.5) drive += cfg.engineAccel * inp.throttle * Math.max(0, 1 - (vF / cfg.maxSpeed) ** 4);
  if (inp.brake > 0 && vF < 0.5) drive -= cfg.reverseAccel * inp.brake * Math.max(0, 1 - (vF / cfg.maxReverse) ** 2);

  const cosD = Math.cos(delta);
  const sinD = Math.sin(delta);
  const gripF = mu * nFront;
  const gripR = mu * nRear * (inp.handbrake ? cfg.handbrakeGrip : 1);
  const fLong = clamp(drive * cfg.frontDrive, -gripF * cfg.tractionLimit, gripF * cfg.tractionLimit);
  const rLong = inp.handbrake ? 0 : clamp(drive * (1 - cfg.frontDrive), -gripR * cfg.tractionLimit, gripR * cfg.tractionLimit);

  const wLong = vF * cosD + vLf * sinD;
  const wLat = -vF * sinD + vLf * cosD;
  const alphaF = Math.atan2(wLat, Math.max(Math.abs(wLong), 2));
  const alphaR = Math.atan2(vLr, Math.max(absF, 2));
  const [fx, fy] = frictionCircle(fLong, -cfg.cornering * (nFront / staticLoad) * alphaF, gripF);
  const [rx, ry] = frictionCircle(rLong, -cfg.cornering * cfg.rearCornering * (nRear / staticLoad) * alphaR, gripR);
  // Front force back into the body frame.
  const frontF = fx * cosD - fy * sinD;
  const frontL = fx * sinD + fy * cosD;

  const aF = frontF + rx + pushX * sinH + pushZ * cosH;
  const aL = frontL + ry + pushX * cosH - pushZ * sinH;
  // Tyre forces act at the ground, below the centre of mass: weight shifts back and outward.
  tPitch -= (frontF + rx) * cfg.cgHeight;
  tRoll += (frontL + ry) * cfg.cgHeight;

  vF += aF * dt;
  vL += aL * dt;
  sim.yawRate += ((A * frontL - B * ry) / cfg.yawInertia) * dt;

  // ---- chassis heave, pitch and roll
  sim.vy += (lift - g) * dt;
  const airDamp = sim.wheelsDown ? 1 : Math.exp(-0.6 * dt);
  sim.pitchRate = (sim.pitchRate + (tPitch / cfg.pitchInertia) * dt) * airDamp;
  sim.rollRate = (sim.rollRate + (tRoll / cfg.rollInertia) * dt) * airDamp;
  sim.y += sim.vy * dt;
  sim.pitch += sim.pitchRate * dt;
  sim.roll += sim.rollRate * dt;
  // No rollovers: past this the body is held at the limit.
  const tilt = 0.6;
  if (Math.abs(sim.pitch) > tilt) {
    sim.pitch = Math.sign(sim.pitch) * tilt;
    sim.pitchRate *= -0.2;
  }
  if (Math.abs(sim.roll) > tilt) {
    sim.roll = Math.sign(sim.roll) * tilt;
    sim.rollRate *= -0.2;
  }
  // Bottoming out: the chassis meets the ground and stops dead.
  const floor = cfg.bumpStop + 0.18;
  if (deepest > floor) {
    sim.y += deepest - floor;
    if (sim.vy < 0) {
      sim.impact = Math.max(sim.impact, Math.min(1, -sim.vy / 8));
      sim.vy *= -0.1;
    }
  }

  // ---- low speed: blend toward rolling without slip, where the tyre model gets twitchy
  const grounded = Math.min(1, (nFront + nRear) / g);
  const kin = (1 - Math.min(1, Math.max(0, (absF - 1.5) / 2.5))) * grounded;
  if (kin > 0) {
    const yawKin = (vF * Math.tan(delta)) / (A + B);
    sim.yawRate += (yawKin - sim.yawRate) * kin;
    vL += (sim.yawRate * B - vL) * kin;
  }

  // ---- stability assist: catch slides and spins, but never turn tighter than the tyres allow. Off with the handbrake.
  if (!inp.handbrake && absF > 1) {
    const maxYaw = (mu * g) / absF;
    const target = clamp((vF * Math.tan(delta)) / (A + B), -maxYaw, maxYaw);
    sim.yawRate += (target - sim.yawRate) * Math.min(1, cfg.stability * grounded * dt);
  }

  // ---- drag, brakes, handbrake: these slow the car but never reverse it
  let drag = (cfg.airDrag + cfg.waterDrag * wet) * vF * vF;
  let groundDrag = cfg.rollingDrag + cfg.surfaceDrag[surface];
  if (inp.throttle === 0 && inp.brake === 0) groundDrag += cfg.engineBraking;
  let brakeDemand = 0;
  if (inp.brake > 0 && vF > 0.5) brakeDemand += cfg.brakeDecel * inp.brake;
  if (inp.throttle > 0 && vF < -0.5) brakeDemand += cfg.brakeDecel * inp.throttle;
  if (inp.handbrake) brakeDemand += mu * nRear * 0.8;
  groundDrag += Math.min(brakeDemand, mu * (nFront + nRear));
  drag += groundDrag * grounded;
  const dv = drag * dt;
  vF = Math.abs(vF) <= dv ? 0 : vF - Math.sign(vF) * dv;

  sim.heading += sim.yawRate * dt;
  const s2 = Math.sin(sim.heading);
  const c2 = Math.cos(sim.heading);
  sim.vx = s2 * vF + c2 * vL;
  sim.vz = c2 * vF - s2 * vL;

  // ---- move anywhere: off cliffs, into water. Only faces too steep to climb stop the car (it slides along them). Tested at the body's ends.
  let nx = sim.x + sim.vx * dt;
  let nz = sim.z + sim.vz * dt;
  const reach = cfg.bodyOffset + cfg.bodyRadius;
  const ok = (x: number, z: number) => {
    const dx = x - sim.x;
    const dz = z - sim.z;
    return !isWall(x, z, dx, dz, cfg) && !isWall(x + s2 * reach, z + c2 * reach, dx, dz, cfg) && !isWall(x - s2 * reach, z - c2 * reach, dx, dz, cfg);
  };
  sim.blocked = false;
  if (!ok(nx, nz)) {
    sim.blocked = true;
    sim.impact = Math.max(sim.impact, Math.min(1, Math.hypot(sim.vx, sim.vz) / 12));
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
  }

  // ---- collisions: front and rear circles. Off-centre hits spin the car.
  for (const off of [cfg.bodyOffset, -cfg.bodyOffset]) {
    const cx = nx + s2 * off;
    const cz = nz + c2 * off;
    // Velocity of this point on the body: v + ω × r.
    const pvx = sim.vx + sim.yawRate * off * c2;
    const pvz = sim.vz - sim.yawRate * off * s2;

    const hit = resolveCircle(cx, cz, cfg.bodyRadius);
    if (hit) {
      const px = hit.x - cx;
      const pz = hit.z - cz;
      if (ok(nx + px, nz + pz)) {
        nx += px;
        nz += pz;
        bounce(sim, off, hit.nx, hit.nz, pvx, pvz, cfg.restitution, 1, cfg);
      }
    }

    for (const b of breakablesNear(cx, cz, cfg.bodyRadius, nearby)) {
      let dx = cx - b.x;
      let dz = cz - b.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      dx /= d;
      dz /= d;
      const closing = -(pvx * dx + pvz * dz);
      if (closing <= 0) continue;
      const spec = BREAK_KINDS[b.kind];
      if (closing > spec.breakSpeed) {
        // Smash straight through, losing the momentum it took to send it flying.
        smash(b, pvx, pvz, sim.time);
        bounce(sim, off, dx, dz, pvx, pvz, 0.1, spec.mass / (1 + spec.mass), cfg);
        sim.smashed = Math.max(sim.smashed, Math.min(1, 0.25 + closing / 14));
      } else {
        const depth = cfg.bodyRadius + b.r - d;
        if (ok(nx + dx * depth, nz + dz * depth)) {
          nx += dx * depth;
          nz += dz * depth;
        }
        bounce(sim, off, dx, dz, pvx, pvz, cfg.restitution, 1, cfg);
      }
    }
  }
  sim.x = nx;
  sim.z = nz;
  sim.forward = sim.vx * s2 + sim.vz * c2;
  sim.wheelSpin += (sim.forward / cfg.wheelRadius) * dt;
  sim.time += dt;
}

/**
 * Impulse at a point `off` metres along the car's axis against normal n.
 * `share` scales the impulse for things lighter than the car (1 = immovable).
 */
function bounce(sim: VehicleSim, off: number, nx: number, nz: number, pvx: number, pvz: number, e: number, share: number, cfg: VehicleConfig) {
  const vn = pvx * nx + pvz * nz;
  if (vn >= 0) return;
  const s = Math.sin(sim.heading);
  const c = Math.cos(sim.heading);
  // Lever arm of the impulse about the centre of mass, along the car's left axis.
  const arm = off * (nx * c - nz * s);
  const j = (-(1 + e) * vn * share) / (1 + (arm * arm) / cfg.yawInertia);
  sim.vx += j * nx;
  sim.vz += j * nz;
  sim.yawRate += (arm * j) / cfg.yawInertia;
  // Scrub some sliding speed along the obstacle, and a little hop from the jolt.
  const tvx = pvx - vn * nx;
  const tvz = pvz - vn * nz;
  sim.vx -= tvx * 0.12 * share;
  sim.vz -= tvz * 0.12 * share;
  sim.vy += j * 0.03;
  if (share === 1) {
    sim.impact = Math.max(sim.impact, Math.min(1, -vn / 10));
    sim.blocked = true;
  }
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
  sim.smashed *= Math.exp(-6 * frameDt);

  // Remember the latest on-road spot for resets.
  sim.safeTimer += frameDt;
  if (sim.safeTimer > 0.5) {
    sim.safeTimer = 0;
    if (sim.onRoad && !sim.blocked && sim.wheelsDown >= 3) sim.safe = { x: sim.x, z: sim.z, heading: sim.heading };
  }
}

/** Set the car down at rest at (x, z). */
export function placeVehicle(sim: VehicleSim, x: number, z: number, heading: number, cfg: VehicleConfig = vehicleConfig) {
  const s = sag(cfg);
  sim.x = x;
  sim.z = z;
  sim.heading = heading;
  sim.y = groundAt(x, z);
  sim.vx = sim.vy = sim.vz = 0;
  sim.yawRate = sim.pitch = sim.pitchRate = sim.roll = sim.rollRate = 0;
  sim.steer = 0;
  sim.forward = 0;
  sim.comp = [s, s, s, s];
}

/** Put the car back on the nearest road point to its last safe spot, facing along the road. */
export function resetVehicle(sim: VehicleSim) {
  const { sample } = nearestRoadSample(sim.safe.x, sim.safe.z, true);
  let heading = Math.atan2(sample.tx, sample.tz);
  // Keep roughly the direction the driver was going.
  if (Math.cos(heading - sim.safe.heading) < 0) heading += Math.PI;
  placeVehicle(sim, sample.x, sample.z, heading);
}
