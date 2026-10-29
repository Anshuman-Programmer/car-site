"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { usePortfolio } from "@/lib/store";
import { vehicle } from "@/lib/vehicleState";
import { surfaceAt } from "@/lib/world/terrain";
import { destinations } from "@/data/locations";

/**
 * Fixed-angle diorama view: the camera keeps one world-space direction (from
 * the south-east, looking down at 30°) and never turns with the car. The sun
 * comes from the west, so shadows fall toward screen-right where they read.
 */
const VIEW_YAW = Math.PI + 0.45;
const VIEW_PITCH = Math.PI / 6;

/**
 * The rig tracks a look point and an offset from it separately. While
 * driving the offset is constant, so the view slides without rotating; the
 * intro and focus framings blend in by easing the offset.
 */
export function CameraRig() {
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const offset = useRef(new THREE.Vector3(0, 20, 20));
  const lead = useRef({ x: 0, z: 0 });
  const tmpRef = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), off: new THREE.Vector3() });
  const initialised = useRef(false);

  useFrame(({ clock, camera, size }, rawDt) => {
    const tmp = tmpRef.current;
    const dt = Math.min(rawDt, 0.1);
    const s = usePortfolio.getState();
    const t = clock.elapsedTime;

    let offK = 3;
    let lookK = 6;
    const focus =
      s.activePanel !== null
        ? destinations.find((dd) => dd.panel === s.activePanel && s.nearby === dd.id)
        : undefined;

    // Look a little ahead of the car so the road it is heading into stays in view.
    const speed = Math.abs(vehicle.speed);
    const leadDist = Math.min(speed, 24) * 0.2;
    const lk = 1 - Math.exp(-2.5 * dt);
    lead.current.x += (Math.sin(vehicle.heading) * Math.sign(vehicle.speed) * leadDist - lead.current.x) * lk;
    lead.current.z += (Math.cos(vehicle.heading) * Math.sign(vehicle.speed) * leadDist - lead.current.z) * lk;

    if (s.phase !== "driving") {
      // Slow cinematic drift around the starting area.
      const a = 0.95 + (s.reducedMotion ? 0 : Math.sin(t * 0.05) * 0.2);
      const cx = vehicle.x - 8;
      const cz = vehicle.z + 6;
      tmp.pos.set(cx + Math.sin(a) * 34, vehicle.y + 15, cz + Math.cos(a) * 34);
      tmp.look.set(cx - 4, vehicle.y + 2, cz - 4);
      // The intro copy sits on the left on wide screens, so aim left of the subject.
      if (size.width >= 768) {
        const fx = tmp.look.x - tmp.pos.x;
        const fz = tmp.look.z - tmp.pos.z;
        const l = Math.hypot(fx, fz) || 1;
        // right = forward × up = (-fz, fx) normalised
        tmp.look.x -= (-fz / l) * 10;
        tmp.look.z -= (fx / l) * 10;
      }
      tmp.off.subVectors(tmp.pos, tmp.look);
      offK = 1.6;
      lookK = 2.2;
    } else {
      // Locked angle: only the distance and the target change, never the direction.
      // Portrait screens need more room side to side.
      const portrait = size.width < size.height ? 1.35 : 1;
      const dist = (focus ? 20 : 15 + Math.min(speed, 24) * 0.12) * portrait;
      const flat = Math.cos(VIEW_PITCH) * dist;
      tmp.off.set(-Math.sin(VIEW_YAW) * flat, Math.sin(VIEW_PITCH) * dist, -Math.cos(VIEW_YAW) * flat);
      if (focus) {
        // Glide over to frame the destination while its panel is open.
        const [fx, fz] = focus.position;
        tmp.look.set(fx, surfaceAt(fx, fz) + 1.5, fz);
      } else {
        tmp.look.set(vehicle.x + lead.current.x, vehicle.y + 0.6, vehicle.z + lead.current.z);
      }
      offK = focus ? 2.2 : 3;
      lookK = focus ? 3 : 7;
    }

    if (!initialised.current) {
      offset.current.copy(tmp.off);
      look.current.copy(tmp.look);
      initialised.current = true;
    } else {
      offset.current.lerp(tmp.off, 1 - Math.exp(-offK * dt));
      look.current.lerp(tmp.look, 1 - Math.exp(-lookK * dt));
    }

    camera.position.addVectors(look.current, offset.current);
    const ground = surfaceAt(camera.position.x, camera.position.z);
    if (camera.position.y < ground + 1.4) camera.position.y = ground + 1.4;
    camera.lookAt(look.current);
  });

  return null;
}
