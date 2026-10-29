"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CarModel, WHEEL_R } from "./CarModel";
import { addOccludedOutline, DRAW_ORDER } from "./xray";
import { createSim, placeVehicle, resetVehicle, stepVehicle, vehicleConfig, type DriveInput, type VehicleSim } from "@/lib/vehiclePhysics";
import { input, vehicle } from "@/lib/vehicleState";
import { drivingEnabled, usePortfolio } from "@/lib/store";
import { restoreBreakables } from "@/lib/world/breakables";
import { nearestRoadSample } from "@/lib/world/terrain";
import { START } from "@/lib/world/layout";
import { audio } from "@/lib/audio";

/** Model is authored at full size; physics radii in vehicleConfig match this scale. */
const CAR_SCALE = 0.7;

export function Vehicle() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const wheelMount = useRef<(THREE.Group | null)[]>([]);
  const wheelSpin = useRef<(THREE.Group | null)[]>([]);
  const wheelSteer = useRef<(THREE.Group | null)[]>([]);
  const stuckTimer = useRef(0);

  const brakeMat = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const simRef = useRef<VehicleSim | null>(null);
  const driveRef = useRef<DriveInput>({ throttle: 0, brake: 0, steer: 0, handbrake: false });

  // Outline the car wherever trees, buildings or hills hide it. Every group is tagged, since the nearest one sets draw order.
  useLayoutEffect(() => {
    const car = group.current;
    if (!car) return;
    car.traverse((o) => {
      if ((o as THREE.Group).isGroup) o.renderOrder = DRAW_ORDER.car;
    });
    return addOccludedOutline(car, "#ffd166");
  }, []);

  useFrame((_, dt) => {
    if (!simRef.current) simRef.current = startSim();
    const sim = simRef.current;
    const drive = driveRef.current;
    const enabled = drivingEnabled();
    if (enabled) {
      drive.throttle = Math.max(input.keyThrottle, input.touchThrottle);
      drive.brake = Math.max(input.keyBrake, input.touchBrake);
      drive.steer = Math.max(-1, Math.min(1, input.keySteer + input.touchSteer));
      drive.handbrake = input.keyHandbrake;
    } else {
      // Panels and the intro hold the car still.
      drive.throttle = 0;
      drive.steer = 0;
      drive.brake = 0;
      drive.handbrake = true;
    }

    if (vehicle.teleportTo) {
      const t = vehicle.teleportTo;
      vehicle.teleportTo = null;
      sim.safe = { x: t.x, z: t.z, heading: t.heading };
      placeVehicle(sim, t.x, t.z, t.heading);
    }

    if (vehicle.resetRequested) {
      vehicle.resetRequested = false;
      resetVehicle(sim);
      stuckTimer.current = 0;
      usePortfolio.getState().setStuck(false);
    }

    stepVehicle(sim, drive, dt, vehicleConfig);

    // Stuck: pushing on the pedals but going nowhere for a while.
    const pushing = drive.throttle > 0 || drive.brake > 0;
    if (enabled && pushing && Math.abs(sim.forward) < 0.6) stuckTimer.current += dt;
    else stuckTimer.current = Math.max(0, stuckTimer.current - dt * 2);
    usePortfolio.getState().setStuck(stuckTimer.current > 2.5);

    vehicle.x = sim.x;
    vehicle.y = sim.y;
    vehicle.z = sim.z;
    vehicle.heading = sim.heading;
    vehicle.speed = sim.forward;
    vehicle.steer = sim.steer;
    vehicle.throttle = drive.throttle;
    vehicle.onRoad = sim.onRoad;
    vehicle.impact = sim.impact;
    audio.updateEngine(Math.abs(sim.forward) / vehicleConfig.maxSpeed, drive.throttle);
    if (sim.impact > 0.35) {
      audio.bump(sim.impact);
      sim.impact = 0;
    }
    if (sim.smashed > 0.2) {
      audio.smash(sim.smashed);
      sim.smashed = 0;
    }
    restoreBreakables(sim.x, sim.z, sim.time);

    const g = group.current;
    if (g) {
      g.position.set(sim.x, sim.y, sim.z);
      g.rotation.set(sim.pitch, sim.heading, sim.roll, "YXZ");
    }
    const b = body.current;
    if (b) b.position.y = Math.abs(sim.forward) > 0.5 && !sim.onRoad ? Math.sin(performance.now() * 0.03) * 0.015 : 0;
    // Wheels follow the ground: up with compression, down to full droop in the air.
    const sag = vehicleConfig.gravity / (4 * vehicleConfig.springK);
    wheelMount.current.forEach((w, i) => {
      if (w) w.position.y = WHEEL_R + Math.max(-0.22, Math.min(0.3, sim.comp[i] - sag)) / CAR_SCALE;
    });
    for (const w of wheelSpin.current) if (w) w.rotation.x = sim.wheelSpin;
    for (const w of wheelSteer.current) if (w) w.rotation.y = -sim.steer;
    const braking = drive.brake > 0 && sim.forward > 0.3 ? 3.2 : 0.8;
    for (const m of brakeMat.current) if (m) m.emissiveIntensity = braking;
    if (shadow.current) {
      shadow.current.position.set(sim.x, sim.y + 0.05, sim.z);
      shadow.current.rotation.set(-Math.PI / 2, 0, sim.heading);
    }
  });

  return (
    <>
      <group ref={group}>
        <group scale={CAR_SCALE}>
          <CarModel bodyRef={body} wheelMount={wheelMount} wheelSpin={wheelSpin} wheelSteer={wheelSteer} brakeMat={brakeMat} />
        </group>
      </group>
      <group ref={shadow} scale={CAR_SCALE}>
        <mesh renderOrder={1}>
          <planeGeometry args={[3.0, 5.0]} />
          <meshBasicMaterial color="#1a1020" transparent opacity={0.3} depthWrite={false} alphaMap={blobTexture()} />
        </mesh>
      </group>
    </>
  );
}

function startSim() {
  const { sample } = nearestRoadSample(START.x, START.z);
  let heading = Math.atan2(sample.tx, sample.tz);
  if (Math.cos(heading - START.heading) < 0) heading += Math.PI;
  return createSim(sample.x, sample.z, heading);
}

let blob: THREE.Texture | null = null;
/** Soft elliptical contact shadow, generated once. */
function blobTexture() {
  if (blob) return blob;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const dx = (i / (size - 1)) * 2 - 1;
      const dy = (j / (size - 1)) * 2 - 1;
      const v = Math.max(0, 1 - Math.hypot(dx, dy));
      const a = Math.round(Math.pow(v, 0.8) * 255);
      const k = (j * size + i) * 4;
      data[k] = data[k + 1] = data[k + 2] = a;
      data[k + 3] = 255;
    }
  blob = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  blob.needsUpdate = true;
  return blob;
}
