"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { vehicle } from "@/lib/vehicleState";
import { heightAt, getWorld, coastT } from "@/lib/world/terrain";
import { LAKE_CENTER } from "@/lib/world/layout";
import { GROVE, TERMINAL, CABIN } from "@/lib/world/structures";
import { mulberry32 } from "@/lib/world/noise";
import { getScatter } from "@/lib/world/scatter";
import { audio } from "@/lib/audio";
import { usePortfolio } from "@/lib/store";
import { sharedUniforms } from "./materials";

interface PetalState {
  data: { x: number; y: number; z: number; sp: number; ph: number; rot: number }[];
  m: THREE.Matrix4;
  q: THREE.Quaternion;
  e: THREE.Euler;
  v: THREE.Vector3;
  sc: THREE.Vector3;
}

function makePetals(count: number, box: number): PetalState {
  const r = mulberry32(5);
  return {
    data: Array.from({ length: count }, () => ({
      x: (r() - 0.5) * box,
      y: r() * 14,
      z: (r() - 0.5) * box,
      sp: 0.5 + r() * 0.6,
      ph: r() * 10,
      rot: r() * 6,
    })),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    e: new THREE.Euler(),
    v: new THREE.Vector3(),
    sc: new THREE.Vector3(1, 1, 1),
  };
}

const PETAL_COLORS = ["#ffb7cf", "#ff9ab8", "#e0512f", "#f08a2c", "#f6b93b", "#ffc2d4"];

/** Blossom petals and autumn leaves drifting around the car. Recycled in a box that follows it. */
function Petals({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const BOX = 46;
  const state = useRef<PetalState | null>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const pal = PETAL_COLORS.map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) mesh.setColorAt(i, pal[i % pal.length]);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  useFrame(({ clock }, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!state.current || state.current.data.length !== count) state.current = makePetals(count, BOX);
    const { data, m, q, e, v, sc } = state.current;
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      p.y -= p.sp * dt;
      p.x += Math.sin(t * 0.7 + p.ph) * dt * 0.9 + dt * 0.6;
      p.z += Math.cos(t * 0.5 + p.ph) * dt * 0.5;
      // Wrap around the car.
      if (p.x > BOX / 2) p.x -= BOX;
      if (p.x < -BOX / 2) p.x += BOX;
      if (p.z > BOX / 2) p.z -= BOX;
      if (p.z < -BOX / 2) p.z += BOX;
      const wx = p.x + vehicle.x;
      const wz = p.z + vehicle.z;
      const ground = heightAt(wx, wz);
      if (p.y + vehicle.y < ground) p.y = 10 + Math.random() * 6;
      e.set(t * 1.3 + p.ph, p.rot + t * 0.6, t * 0.9);
      q.setFromEuler(e);
      v.set(wx, p.y + vehicle.y, wz);
      m.compose(v, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.16, 0.12]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.6} emissive="#ffffff" emissiveIntensity={0.08} />
    </instancedMesh>
  );
}

interface FallingLeaf {
  x: number;
  y: number;
  z: number;
  ground: number;
  sp: number;
  ph: number;
  /** Seconds left lying on the ground once landed; < 0 while airborne. */
  rest: number;
  scale: number;
}

const LEAF_FALL_COLORS = {
  round: ["#e0512f", "#f08a2c", "#f6b93b", "#a9c455", "#86bf55"],
  blossom: ["#ffb7cf", "#ff8fab", "#ffc2d4", "#f78fb3"],
};

function makeFallingLeaves(count: number) {
  const s = getScatter();
  const trees = [
    ...s.roundTrees.map((t) => ({ t, pal: LEAF_FALL_COLORS.round })),
    ...s.blossoms.map((t) => ({ t, pal: LEAF_FALL_COLORS.blossom })),
  ];
  const leaves: FallingLeaf[] = Array.from({ length: count }, (_, i) => ({ x: 0, y: -999, z: 0, ground: 0, sp: 0, ph: i, rest: (i / count) * 5, scale: 0 }));
  return { trees, near: [] as typeof trees, scan: 0, leaves, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), sc: new THREE.Vector3(), c: new THREE.Color() };
}

/** Leaves that let go of the broadleaf trees near the car, tumble down and settle. */
function FallingLeaves({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.13, 0.08, 0, 0, 0, 0, 0.13, -0.08, 0, 0], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    return g;
  }, []);
  const stateRef = useRef<ReturnType<typeof makeFallingLeaves> | null>(null);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ clock }, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    if (!stateRef.current || stateRef.current.leaves.length !== count) stateRef.current = makeFallingLeaves(count);
    const state = stateRef.current;
    const { leaves, m, q, e, v, sc, c } = state;

    state.scan -= dt;
    if (state.scan <= 0) {
      state.scan = 0.5;
      state.near = state.trees.filter(({ t: tr }) => (tr.x - vehicle.x) ** 2 + (tr.z - vehicle.z) ** 2 < 34 * 34);
    }

    let recolor = false;
    for (let i = 0; i < leaves.length; i++) {
      const L = leaves[i];
      if (L.rest >= 0) {
        L.rest -= dt;
        if (L.rest < 0 && state.near.length) {
          // Let go from somewhere in a nearby crown.
          const { t: tr, pal } = state.near[Math.floor(Math.random() * state.near.length)];
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * 1.8 * tr.s;
          L.x = tr.x + Math.cos(a) * d;
          L.z = tr.z + Math.sin(a) * d;
          L.y = tr.y + (2.8 + Math.random() * 1.6) * tr.s;
          L.sp = 0.55 + Math.random() * 0.5;
          L.ph = Math.random() * 10;
          L.scale = 0.9 + Math.random() * 0.6;
          L.ground = heightAt(L.x, L.z) + 0.04;
          L.rest = -1;
          mesh.setColorAt(i, c.set(pal[Math.floor(Math.random() * pal.length)]));
          recolor = true;
        } else if (L.rest < 0) {
          L.rest = 0.2 + Math.random();
        }
      } else {
        L.y -= L.sp * dt * (0.75 + 0.5 * Math.sin(t * 2.3 + L.ph));
        L.x += (Math.sin(t * 1.6 + L.ph) * 0.9 + 0.35) * dt;
        L.z += Math.cos(t * 1.2 + L.ph) * 0.6 * dt;
        if (L.y <= L.ground) {
          L.y = L.ground;
          L.rest = 2 + Math.random() * 3;
        }
      }
      const airborne = L.rest < 0;
      const life = airborne ? 1 : Math.min(1, L.rest);
      if (airborne) e.set(Math.sin(t * 2.1 + L.ph) * 1.1, t * 1.4 + L.ph, Math.cos(t * 1.7 + L.ph) * 0.9);
      else e.set(0, L.ph, 0);
      q.setFromEuler(e);
      v.set(L.x, L.y, L.z);
      const s = L.y < -900 ? 0 : L.scale * life;
      sc.set(s, s, s);
      m.compose(v, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (recolor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false} castShadow>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.7} />
    </instancedMesh>
  );
}

/** Additive point sprites that drift and blink. */
function Fireflies({ center, radius, count, color }: { center: [number, number]; radius: number; count: number; color: string }) {
  const geo = useMemo(() => {
    const r = mulberry32(Math.round(center[0] * 13 + center[1]));
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * radius;
      const x = center[0] + Math.cos(a) * d;
      const z = center[1] + Math.sin(a) * d;
      pos[i * 3] = x;
      pos[i * 3 + 1] = heightAt(x, z) + 0.6 + r() * 3;
      pos[i * 3 + 2] = z;
      phase[i] = r() * 10;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, [center, radius, count]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: sharedUniforms.uTime, uColor: { value: new THREE.Color(color) }, uScale: { value: 220 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uScale;
          attribute float aPhase;
          varying float vA;
          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.6 + aPhase) * 0.8;
            p.y += sin(uTime * 0.9 + aPhase * 2.0) * 0.5;
            p.z += cos(uTime * 0.5 + aPhase) * 0.8;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            vA = smoothstep(0.2, 1.0, sin(uTime * 1.7 + aPhase * 3.0) * 0.5 + 0.5);
            gl_PointSize = uScale * 0.12 / -mv.z;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vA;
            gl_FragColor = vec4(uColor * 1.6, a);
          }`,
      }),
    [color],
  );
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

function cloudGeometry(seed: number) {
  const r = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(3 + r() * 3.5, 0);
    g.scale(1, 0.62, 1);
    g.translate((i - n / 2) * 4.2 + r() * 2, r() * 1.5, (r() - 0.5) * 4);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

function Clouds({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: count }, (_, i) => ({
      geo: cloudGeometry(100 + i),
      a: (i / count) * Math.PI * 2 + r() * 0.4,
      rad: 110 + r() * 110,
      y: 48 + r() * 26,
      s: 0.8 + r() * 0.8,
    }));
  }, [count]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.006;
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <mesh key={i} geometry={c.geo} position={[Math.cos(c.a) * c.rad, c.y, Math.sin(c.a) * c.rad]} scale={c.s} rotation={[0, c.a, 0]}>
          <meshStandardMaterial color="#fff4ef" emissive="#ffd6c4" emissiveIntensity={0.25} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** A few birds wheeling over the lake. */
function Birds() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const birds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ r: 22 + i * 5, sp: 0.18 + i * 0.02, ph: i * 1.3, y: 26 + (i % 3) * 3 })), []);
  const wing = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.25, 0, 0, -0.25, 1.1, 0.05, 0], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = t * b.sp + b.ph;
      g.position.set(LAKE_CENTER[0] + Math.cos(a) * b.r, b.y + Math.sin(t * 0.7 + i) * 1.5, LAKE_CENTER[1] + Math.sin(a) * b.r);
      g.rotation.y = -a;
      const flap = Math.sin(t * 7 + i) * 0.6;
      (g.children[0] as THREE.Mesh).rotation.z = flap;
      (g.children[1] as THREE.Mesh).rotation.z = -flap;
    });
  });
  return (
    <group>
      {birds.map((_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          <mesh geometry={wing}>
            <meshBasicMaterial color="#3a3046" side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={wing} scale={[-1, 1, 1]}>
            <meshBasicMaterial color="#3a3046" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Butterflies flutter in the meadow by the cabin. */
function Butterflies() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const items = useMemo(() => {
    const r = mulberry32(9);
    return Array.from({ length: 7 }, () => ({
      cx: CABIN.x + (r() - 0.5) * 30,
      cz: CABIN.z - 10 + (r() - 0.5) * 18,
      ph: r() * 10,
      color: ["#ffd166", "#ff8fab", "#b49cff", "#ffffff"][Math.floor(r() * 4)],
    }));
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const x = b.cx + Math.sin(t * 0.4 + b.ph) * 4 + Math.sin(t * 1.1 + b.ph) * 1.2;
      const z = b.cz + Math.cos(t * 0.33 + b.ph) * 4;
      g.position.set(x, heightAt(x, z) + 0.9 + Math.sin(t * 2 + b.ph) * 0.3, z);
      g.rotation.y = t * 0.4 + b.ph;
      const flap = Math.sin(t * 16 + b.ph) * 0.9;
      (g.children[0] as THREE.Mesh).rotation.z = 0.2 + flap;
      (g.children[1] as THREE.Mesh).rotation.z = -0.2 - flap;
    });
  });
  return (
    <group>
      {items.map((b, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          {[1, -1].map((s) => (
            <mesh key={s} position={[0, 0, 0]}>
              <planeGeometry args={[0.22, 0.18]} />
              <meshStandardMaterial color={b.color} side={THREE.DoubleSide} emissive={b.color} emissiveIntensity={0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Feeds the procedural audio how close the car is to water. */
function AudioProximity() {
  const timer = useRef(0);
  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < 0.3) return;
    timer.current = 0;
    const w = getWorld();
    const lake = Math.hypot(vehicle.x - LAKE_CENTER[0], vehicle.z - LAKE_CENTER[1]) - 26;
    let stream = Infinity;
    for (let i = 0; i < w.stream.length; i += 6) stream = Math.min(stream, Math.hypot(w.stream[i].x - vehicle.x, w.stream[i].z - vehicle.z));
    const coast = (1 - coastT(vehicle.x, vehicle.z).t) * 120;
    const d = Math.min(lake, stream, coast);
    audio.setWater(Math.max(0, 1 - d / 30));
  });
  return null;
}

/** Ticks shared shader time, scaled down for reduced motion. */
function Clock() {
  useFrame((_, dt) => {
    const calm = usePortfolio.getState().reducedMotion;
    sharedUniforms.uTime.value += dt * (calm ? 0.35 : 1);
    sharedUniforms.uWind.value = calm ? 0.4 : 1;
  });
  return null;
}

export function EnvironmentEffects({ quality }: { quality: "high" | "low" }) {
  const low = quality === "low";
  return (
    <group>
      <Clock />
      <AudioProximity />
      <Petals count={low ? 60 : 160} />
      <FallingLeaves count={low ? 40 : 110} />
      <Fireflies center={[GROVE.x, GROVE.z]} radius={16} count={low ? 30 : 70} color="#c8ff7a" />
      <Fireflies center={[TERMINAL.x, TERMINAL.z]} radius={9} count={low ? 14 : 30} color="#7dffb0" />
      <Clouds count={low ? 7 : 12} />
      <Birds />
      {!low && <Butterflies />}
    </group>
  );
}
