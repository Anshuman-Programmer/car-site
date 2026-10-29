"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { debrisQueue, type BreakKind, type DebrisBurst } from "@/lib/world/breakables";
import { heightAt, surfaceAt } from "@/lib/world/terrain";
import { vehicle } from "@/lib/vehicleState";

type Shape = "box" | "cyl" | "cone";
type V3 = [number, number, number];

/** One piece of a broken prop, in the prop's own frame (front = +z). Sizes are full extents. */
interface Fragment {
  shape: Shape;
  size: V3;
  pos: V3;
  color: string;
}

const CHARCOAL = "#2b2733";
const WOOD = "#c8875a";
const FRAME = "#3d4a6b";

const FRAGMENTS: Record<BreakKind, Fragment[]> = {
  lamp: [
    { shape: "cyl", size: [0.2, 1.4, 0.2], pos: [0, 0.7, 0], color: CHARCOAL },
    { shape: "cyl", size: [0.16, 1.5, 0.16], pos: [0, 2.15, 0], color: CHARCOAL },
    { shape: "box", size: [0.3, 0.42, 0.3], pos: [0, 3.05, 0], color: "#ffd89a" },
    { shape: "cone", size: [0.64, 0.28, 0.64], pos: [0, 3.4, 0], color: CHARCOAL },
  ],
  bench: [
    ...[0.15, 0, -0.15].map((z): Fragment => ({ shape: "box", size: [1.8, 0.06, 0.13], pos: [0, 0.48, z], color: WOOD })),
    { shape: "box", size: [1.8, 0.12, 0.05], pos: [0, 0.72, -0.27], color: WOOD },
    { shape: "box", size: [1.8, 0.12, 0.05], pos: [0, 0.9, -0.3], color: WOOD },
    { shape: "box", size: [0.07, 0.9, 0.5], pos: [0.8, 0.45, -0.05], color: FRAME },
    { shape: "box", size: [0.07, 0.9, 0.5], pos: [-0.8, 0.45, -0.05], color: FRAME },
  ],
  lantern: [
    { shape: "box", size: [0.36, 0.14, 0.36], pos: [0, 0.07, 0], color: "#7a7e89" },
    { shape: "box", size: [0.28, 0.42, 0.28], pos: [0, 0.37, 0], color: "#ffe2a8" },
    { shape: "cone", size: [0.52, 0.2, 0.52], pos: [0, 0.66, 0], color: FRAME },
  ],
  sign: [
    { shape: "box", size: [0.16, 1.2, 0.16], pos: [0, 0.6, 0], color: "#6e4128" },
    { shape: "box", size: [0.16, 1.2, 0.16], pos: [0, 1.8, 0], color: "#6e4128" },
    { shape: "box", size: [2.6, 0.62, 0.12], pos: [0, 2.15, 0], color: "#f6ead2" },
  ],
  cone: [
    { shape: "cone", size: [0.48, 0.7, 0.48], pos: [0, 0.4, 0], color: "#ff6b2c" },
    { shape: "box", size: [0.55, 0.05, 0.55], pos: [0, 0.025, 0], color: CHARCOAL },
  ],
  crate: [
    ...[0.41, -0.41].map((z): Fragment => ({ shape: "box", size: [0.9, 0.9, 0.08], pos: [0, 0.45, z], color: "#b07a4a" })),
    ...[0.41, -0.41].map((x): Fragment => ({ shape: "box", size: [0.08, 0.9, 0.74], pos: [x, 0.45, 0], color: "#a06c40" })),
    { shape: "box", size: [0.9, 0.08, 0.9], pos: [0, 0.86, 0], color: "#b07a4a" },
    { shape: "box", size: [0.9, 0.08, 0.9], pos: [0, 0.04, 0], color: "#7d5233" },
  ],
};

/** Heavier props fly less far. */
const FLING: Record<BreakKind, number> = { lamp: 0.75, bench: 0.6, lantern: 1, sign: 0.8, cone: 1.25, crate: 0.85 };

const CAPACITY: Record<Shape, number> = { box: 220, cyl: 48, cone: 64 };
/** Pieces linger this long, then clear away once the car is out of sight. */
const LIFETIME = 50;

interface Piece {
  shape: Shape;
  slot: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  spin: THREE.Vector3;
  half: THREE.Vector3;
  size: THREE.Vector3;
  age: number;
  asleep: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const zero = new THREE.Matrix4().makeScale(0, 0, 0);

/** Lowest point of the box around a rotated piece, relative to its centre. */
function lowest(p: Piece) {
  let min = Infinity;
  for (let i = 0; i < 8; i++) {
    tmpV.set(i & 1 ? p.half.x : -p.half.x, i & 2 ? p.half.y : -p.half.y, i & 4 ? p.half.z : -p.half.z).applyQuaternion(p.quat);
    min = Math.min(min, tmpV.y);
  }
  return min;
}

export function Debris() {
  const meshes = useRef<Record<Shape, THREE.InstancedMesh | null>>({ box: null, cyl: null, cone: null });
  const pieces = useRef<Piece[]>([]);
  const free = useRef<Record<Shape, number[]>>({
    box: Array.from({ length: CAPACITY.box }, (_, i) => i),
    cyl: Array.from({ length: CAPACITY.cyl }, (_, i) => i),
    cone: Array.from({ length: CAPACITY.cone }, (_, i) => i),
  });

  const assets = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      cone: new THREE.ConeGeometry(0.5, 1, 8),
      mat: new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(assets).forEach((a) => a.dispose());
    },
    [assets],
  );

  // Every slot starts hidden.
  useEffect(() => {
    for (const shape of ["box", "cyl", "cone"] as Shape[]) {
      const mesh = meshes.current[shape];
      if (!mesh) continue;
      const white = new THREE.Color("#ffffff");
      for (let i = 0; i < CAPACITY[shape]; i++) {
        mesh.setMatrixAt(i, zero);
        mesh.setColorAt(i, white);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, []);

  const release = (p: Piece) => {
    meshes.current[p.shape]?.setMatrixAt(p.slot, zero);
    free.current[p.shape].push(p.slot);
  };

  const spawn = (burst: DebrisBurst) => {
    const base = heightAt(burst.x, burst.z);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, burst.yaw);
    const fling = FLING[burst.kind];
    const speed = Math.hypot(burst.vx, burst.vz);
    for (const f of FRAGMENTS[burst.kind]) {
      let slot = free.current[f.shape].pop();
      if (slot === undefined) {
        // Pool full: recycle the oldest piece of this shape.
        const oldest = pieces.current.findIndex((p) => p.shape === f.shape);
        if (oldest < 0) continue;
        slot = pieces.current[oldest].slot;
        pieces.current.splice(oldest, 1);
      }
      const local = new THREE.Vector3(...f.pos).applyQuaternion(yawQ);
      const k = fling * (0.55 + Math.random() * 0.6);
      // Higher pieces get whipped forward more as the base is knocked out from under them.
      const lift = 1 + f.pos[1] * 0.25;
      pieces.current.push({
        shape: f.shape,
        slot,
        pos: new THREE.Vector3(burst.x + local.x, base + f.pos[1], burst.z + local.z),
        vel: new THREE.Vector3(
          burst.vx * k * lift + (Math.random() - 0.5) * 3,
          (1.5 + Math.random() * 2.5) * Math.min(1.6, 0.4 + speed / 12),
          burst.vz * k * lift + (Math.random() - 0.5) * 3,
        ),
        quat: yawQ.clone(),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6 + speed * 0.6),
        half: new THREE.Vector3(...f.size).multiplyScalar(0.5),
        size: new THREE.Vector3(...f.size),
        age: 0,
        asleep: false,
      });
      meshes.current[f.shape]?.setColorAt(slot, new THREE.Color(f.color));
      const mesh = meshes.current[f.shape];
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    while (debrisQueue.length) spawn(debrisQueue.shift()!);
    const list = pieces.current;
    if (!list.length) return;

    const carVx = Math.sin(vehicle.heading) * vehicle.speed;
    const carVz = Math.cos(vehicle.heading) * vehicle.speed;
    const touched = new Set<Shape>();
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      const dxCar = p.pos.x - vehicle.x;
      const dzCar = p.pos.z - vehicle.z;
      const carDist = Math.hypot(dxCar, dzCar);
      if (p.age > LIFETIME && carDist > 40) {
        release(p);
        list.splice(i, 1);
        touched.add(p.shape);
        continue;
      }

      // The car bulldozes pieces it drives into.
      if (carDist < 1.7 && p.pos.y < vehicle.y + 1.6 && Math.hypot(carVx, carVz) > 0.5) {
        const nx = dxCar / (carDist || 1);
        const nz = dzCar / (carDist || 1);
        p.vel.set(carVx * 1.1 + nx * 1.5, 1 + Math.random() * 1.5, carVz * 1.1 + nz * 1.5);
        p.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8);
        p.asleep = false;
      }
      if (p.asleep) continue;

      p.vel.y -= 9.8 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const w = p.spin.length();
      if (w > 1e-4) p.quat.premultiply(tmpQ.setFromAxisAngle(tmpV.copy(p.spin).divideScalar(w), w * dt)).normalize();

      const ground = surfaceAt(p.pos.x, p.pos.z);
      const low = lowest(p);
      if (p.pos.y + low < ground) {
        p.pos.y = ground - low;
        if (p.vel.y < 0) p.vel.y *= -0.28;
        p.vel.x *= 0.78;
        p.vel.z *= 0.78;
        p.spin.multiplyScalar(0.72);
        // Once slow, tip over onto the nearest flat face rather than balancing on an edge.
        if (p.vel.lengthSq() < 2.5) {
          let best = AXES[0];
          let bestDot = 0;
          for (const a of AXES) {
            const d = tmpV.copy(a).applyQuaternion(p.quat).y;
            if (Math.abs(d) > Math.abs(bestDot)) {
              bestDot = d;
              best = a;
            }
          }
          const axis = tmpV.copy(best).applyQuaternion(p.quat).multiplyScalar(Math.sign(bestDot));
          tmpQ.setFromUnitVectors(axis, UP).multiply(p.quat);
          p.quat.slerp(tmpQ, Math.min(1, 6 * dt));
          if (p.vel.lengthSq() < 0.01 && p.spin.lengthSq() < 0.05 && 1 - Math.abs(bestDot) < 0.002) p.asleep = true;
        }
      }

      tmpM.compose(p.pos, p.quat, p.size);
      meshes.current[p.shape]?.setMatrixAt(p.slot, tmpM);
      touched.add(p.shape);
    }
    for (const s of touched) {
      const mesh = meshes.current[s];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const setMesh = (shape: Shape) => (m: THREE.InstancedMesh | null) => {
    meshes.current[shape] = m;
  };
  return (
    <group>
      {(["box", "cyl", "cone"] as Shape[]).map((s) => (
        <instancedMesh key={s} ref={setMesh(s)} args={[assets[s], assets.mat, CAPACITY[s]]} castShadow frustumCulled={false} />
      ))}
    </group>
  );
}
