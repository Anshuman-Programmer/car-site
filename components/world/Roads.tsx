"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { getWorld, heightAt, type Road } from "@/lib/world/terrain";
import { lampPosts, signposts } from "@/lib/world/structures";
import { palette } from "./materials";

const FONT = "/fonts/bricolage-700.woff";

function roadGeometry(road: Road) {
  const half = road.def.width / 2;
  // Cross-section: outer shoulder, inner edge, inner edge, outer shoulder.
  const offsets = [-half - 0.5, -half + 0.35, half - 0.35, half + 0.5];
  const pos: number[] = [];
  const col: number[] = [];
  const base = road.def.kind === "dirt" ? palette.dirtPath : palette.road;
  const edge = road.def.kind === "dirt" ? palette.dirtPath.clone().multiplyScalar(0.85) : palette.roadEdge;
  const c = new THREE.Color();
  const samples = road.samples;
  for (let n = 0; n < samples.length; n++) {
    const s = samples[n];
    const plank = s.bridge ? (n % 2 ? palette.wood : palette.woodDark) : null;
    for (let k = 0; k < offsets.length; k++) {
      const o = offsets[k];
      const x = s.x - s.tz * o;
      const z = s.z + s.tx * o;
      const outer = k === 0 || k === 3;
      let y: number;
      if (s.bridge) y = s.y + 0.08;
      else y = outer ? Math.max(heightAt(x, z) + 0.03, s.y - 0.12) : s.y + 0.06;
      pos.push(x, y, z);
      if (plank) c.copy(plank).multiplyScalar(outer ? 0.8 : 1);
      else c.copy(outer ? edge : base).offsetHSL(0, 0, ((n * 7919) % 13) / 13 * 0.025 - 0.012);
      col.push(c.r, c.g, c.b);
    }
  }
  const index: number[] = [];
  const ring = offsets.length;
  const count = road.def.closed ? samples.length : samples.length - 1;
  for (let n = 0; n < count; n++) {
    const a = n * ring;
    const b = ((n + 1) % samples.length) * ring;
    for (let k = 0; k < ring - 1; k++) index.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function useInstances(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  items: { x: number; y: number; z: number; yaw: number; s?: number }[],
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    items.forEach((it, i) => {
      e.set(0, it.yaw, 0);
      q.setFromEuler(e);
      const s = it.s ?? 1;
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, items]);
}

export function Roads() {
  const world = getWorld();
  const geos = useMemo(() => world.roads.map((r) => roadGeometry(r)), [world]);

  // Centre dashes on the loop.
  const dashes = useMemo(() => {
    const loop = world.roads[0];
    const out: { x: number; y: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < loop.samples.length; i += 5) {
      const s = loop.samples[i];
      if (s.bridge) continue;
      out.push({ x: s.x, y: s.y + 0.075, z: s.z, yaw: Math.atan2(s.tx, s.tz) });
    }
    return out;
  }, [world]);
  const dashRef = useRef<THREE.InstancedMesh>(null);
  useInstances(dashRef, dashes);

  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
      <instancedMesh ref={dashRef} args={[undefined, undefined, dashes.length]} receiveShadow>
        <boxGeometry args={[0.22, 0.02, 1.8]} />
        <meshStandardMaterial color="#fbf1dc" roughness={0.8} />
      </instancedMesh>
      <Bridge />
      <Lamps />
      <Signposts />
    </group>
  );
}

function Bridge() {
  const world = getWorld();
  const bridge = world.bridge;
  const parts = useMemo(() => {
    if (!bridge) return null;
    const posts: { x: number; y: number; z: number; yaw: number }[] = [];
    const rails: { x: number; y: number; z: number; yaw: number }[] = [];
    const beams: { x: number; y: number; z: number; yaw: number; s: number }[] = [];
    const bs = bridge.samples;
    bs.forEach((s, i) => {
      const yaw = Math.atan2(s.tx, s.tz);
      for (const side of [-1, 1]) {
        const o = side * (bridge.halfWidth + 0.25);
        const x = s.x - s.tz * o;
        const z = s.z + s.tx * o;
        if (i % 3 === 0) posts.push({ x, y: s.y + 0.6, z, yaw });
        rails.push({ x, y: s.y + 1.05, z, yaw });
      }
      if (i % 5 === 2) beams.push({ x: s.x, y: s.y - 1.1, z: s.z, yaw, s: 1 });
    });
    return { posts, rails, beams };
  }, [bridge]);

  const postRef = useRef<THREE.InstancedMesh>(null);
  const railRef = useRef<THREE.InstancedMesh>(null);
  const beamRef = useRef<THREE.InstancedMesh>(null);
  useInstances(postRef, parts?.posts ?? []);
  useInstances(railRef, parts?.rails ?? []);
  useInstances(beamRef, parts?.beams ?? []);
  if (!parts) return null;

  return (
    <group>
      <instancedMesh ref={postRef} args={[undefined, undefined, parts.posts.length]} castShadow>
        <boxGeometry args={[0.22, 1.2, 0.22]} />
        <meshStandardMaterial color={palette.woodDark} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={railRef} args={[undefined, undefined, parts.rails.length]} castShadow>
        <boxGeometry args={[0.14, 0.14, 1.05]} />
        <meshStandardMaterial color={palette.wood} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={beamRef} args={[undefined, undefined, parts.beams.length]}>
        <boxGeometry args={[9, 2.2, 0.5]} />
        <meshStandardMaterial color={palette.woodDark} roughness={0.95} />
      </instancedMesh>
    </group>
  );
}

function Lamps() {
  const lamps = useMemo(
    () => lampPosts().map((l) => ({ ...l, y: heightAt(l.x, l.z) })),
    [],
  );
  const postRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  useInstances(postRef, lamps.map((l) => ({ ...l, y: l.y + 1.45 })));
  useInstances(capRef, lamps.map((l) => ({ ...l, y: l.y + 3.4, yaw: l.yaw + Math.PI / 4 })));
  useInstances(headRef, lamps.map((l) => ({ ...l, y: l.y + 3.05 })));
  useInstances(glowRef, lamps.map((l) => ({ ...l, y: l.y + 3.05 })));
  return (
    <group>
      <instancedMesh ref={postRef} args={[undefined, undefined, lamps.length]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 2.9, 6]} />
        <meshStandardMaterial color={palette.charcoal} roughness={0.6} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, lamps.length]}>
        <boxGeometry args={[0.3, 0.42, 0.3]} />
        <meshStandardMaterial color="#ffd89a" emissive="#ffb85c" emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, lamps.length]} castShadow>
        <coneGeometry args={[0.32, 0.28, 4]} />
        <meshStandardMaterial color={palette.charcoal} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshBasicMaterial color="#ffb366" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}

function Signposts() {
  const signs = useMemo(() => signposts().map((s) => ({ ...s, y: heightAt(s.x, s.z) })), []);
  return (
    <group>
      {signs.map((s) => (
        <group key={s.label} position={[s.x, s.y, s.z]} rotation={[0, s.yaw, 0]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[0.16, 2.4, 0.16]} />
            <meshStandardMaterial color={palette.woodDark} />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <boxGeometry args={[2.6, 0.62, 0.12]} />
            <meshStandardMaterial color={palette.cream} roughness={0.8} />
          </mesh>
          {[1, -1].map((side) => (
            <Text
              key={side}
              font={FONT}
              fontSize={0.34}
              color="#3b2a20"
              anchorX="center"
              anchorY="middle"
              position={[0, 2.15, 0.07 * side]}
              rotation={[0, side > 0 ? 0 : Math.PI, 0]}
            >
              {s.label}
            </Text>
          ))}
        </group>
      ))}
    </group>
  );
}
