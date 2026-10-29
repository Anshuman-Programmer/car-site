"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { GRID, getWorld, heightAt } from "@/lib/world/terrain";
import { LAKE_CENTER, LAKE_LEVEL, lakeRadius, SEA_LEVEL, WORLD_HALF } from "@/lib/world/layout";
import { sharedUniforms } from "./materials";

const H_MIN = -16;
const H_RANGE = 28;

/** Terrain heights packed into an 8-bit texture so water can colour itself by depth. */
function useHeightTexture() {
  const tex = useMemo(() => {
    const { heights } = getWorld();
    const data = new Uint8Array(GRID * GRID);
    for (let i = 0; i < heights.length; i++) {
      data[i] = Math.max(0, Math.min(255, Math.round(((heights[i] - H_MIN) / H_RANGE) * 255)));
    }
    const t = new THREE.DataTexture(data, GRID, GRID, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function makeDepthWater(heightTex: THREE.Texture, level: number, wave: number) {
  const mat = new THREE.MeshStandardMaterial({
    color: "#3fb7c0",
    roughness: 0.22,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
  });
  mat.defines = { WATER_WAVE: wave.toFixed(3), H_MIN: H_MIN.toFixed(1), H_RANGE: H_RANGE.toFixed(1), HALF: WORLD_HALF.toFixed(1) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uHeight = { value: heightTex };
    shader.uniforms.uLevel = { value: level };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vWPos;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
        float wave = sin(wp0.x * 0.09 + uTime * 0.9) * 0.11 + sin(wp0.z * 0.13 - uTime * 1.2) * 0.09
          + sin((wp0.x + wp0.z) * 0.23 + uTime * 1.7) * 0.04;
        transformed.y += wave * WATER_WAVE;
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uLevel;\nuniform sampler2D uHeight;\nvarying vec3 vWPos;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 huv = (vWPos.xz + HALF) / (2.0 * HALF);
        float inside = step(0.0, huv.x) * step(huv.x, 1.0) * step(0.0, huv.y) * step(huv.y, 1.0);
        float th = mix(H_MIN, texture2D(uHeight, clamp(huv, 0.0, 1.0)).r * H_RANGE + H_MIN, inside);
        float depth = uLevel - th;
        vec3 shallow = vec3(0.42, 0.88, 0.80);
        vec3 mid = vec3(0.10, 0.55, 0.66);
        vec3 deep = vec3(0.06, 0.24, 0.42);
        vec3 wcol = mix(shallow, mid, smoothstep(0.0, 4.0, depth));
        wcol = mix(wcol, deep, smoothstep(5.0, 15.0, depth));
        float fn = sin(vWPos.x * 0.7 + uTime * 1.3) * sin(vWPos.z * 0.6 - uTime) * 0.5 + 0.5;
        float foam = 1.0 - smoothstep(0.0, 0.45 + fn * 0.35, depth);
        float wave2 = fract(uTime * 0.12 + fn * 0.15);
        float ring = smoothstep(0.12, 0.0, abs(depth - (0.6 + wave2 * 1.6))) * (1.0 - wave2);
        wcol = mix(wcol, vec3(1.0, 0.98, 0.94), clamp(foam * 0.9 + ring * 0.45, 0.0, 1.0));
        diffuseColor.rgb = wcol;
        diffuseColor.a = clamp(mix(0.55, 0.94, smoothstep(0.0, 3.5, depth)) + foam, 0.0, 1.0);`,
      );
  };
  return mat;
}

function makeFlowMaterial(colorA: string, colorB: string, speed: number, opacity: number) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uColorA: { value: new THREE.Color(colorA) }, uColorB: { value: new THREE.Color(colorB) }, uSpeed: { value: speed }, uOpacity: { value: opacity } },
  ]);
  (uniforms as Record<string, THREE.IUniform>).uTime = sharedUniforms.uTime;
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uSpeed;
      uniform float uOpacity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      void main() {
        float lanes = 6.0;
        float lane = floor(vUv.x * lanes);
        float inLane = fract(vUv.x * lanes);
        float rnd = fract(sin(lane * 91.7) * 43758.5);
        float s = (vUv.y - uTime * uSpeed * (0.8 + rnd * 0.5)) * (1.4 + rnd) + rnd * 7.0;
        float dash = smoothstep(0.8, 0.97, sin(s * 6.2831) * 0.5 + 0.5);
        float streak = dash * smoothstep(0.2, 0.45, inLane) * (1.0 - smoothstep(0.55, 0.8, inLane));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 col = mix(uColorA, uColorB, streak);
        gl_FragColor = vec4(col, uOpacity * (0.55 + 0.45 * edge) * (0.75 + streak * 0.25));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

function ribbon(points: { x: number; y: number; z: number; tx: number; tz: number }[], width: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  let acc = 0;
  points.forEach((p, i) => {
    if (i) acc += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y, p.z - points[i - 1].z);
    for (const side of [-1, 1]) {
      pos.push(p.x - p.tz * side * width * 0.5, p.y, p.z + p.tx * side * width * 0.5);
      uv.push(side < 0 ? 0 : 1, acc * 0.12);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export function Water({ quality }: { quality: "high" | "low" }) {
  const heightTex = useHeightTexture();
  const world = getWorld();

  const sea = useMemo(() => {
    const seg = quality === "high" ? 150 : 80;
    const g = new THREE.PlaneGeometry(1000, 1000, seg, seg);
    g.rotateX(-Math.PI / 2);
    return { geo: g, mat: makeDepthWater(heightTex, SEA_LEVEL, 1) };
  }, [heightTex, quality]);

  const lake = useMemo(() => {
    // Ring geometry has interior vertices for the waves; stretch it to the shoreline.
    const g = new THREE.RingGeometry(0, 1, 64, 14);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const r = lakeRadius(Math.atan2(-y, x)) * 1.12;
      p.setXY(i, x * r, y * r);
    }
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return { geo: g, mat: makeDepthWater(heightTex, LAKE_LEVEL, 0.35) };
  }, [heightTex]);

  const stream = useMemo(() => {
    const pts = world.stream.slice(0, world.fallIndex + 1);
    return { geo: ribbon(pts, 6.5), mat: makeFlowMaterial("#3fb3c2", "#bdf1f4", 0.3, 0.9) };
  }, [world]);

  const fall = useMemo(() => {
    const top = world.stream[world.fallIndex];
    const pts: { x: number; y: number; z: number; tx: number; tz: number }[] = [];
    let out = 0;
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = top.y + (SEA_LEVEL - 0.3 - top.y) * Math.pow(u, 1.25);
      out = Math.max(out, u * 2.5);
      // Push outward until we clear the cliff face.
      let x = top.x + top.tx * out;
      let z = top.z + top.tz * out;
      while (heightAt(x, z) > y - 0.4 && out < 30) {
        out += 0.4;
        x = top.x + top.tx * out;
        z = top.z + top.tz * out;
      }
      pts.push({ x, y, z, tx: top.tx, tz: top.tz });
    }
    const base = pts[pts.length - 1];
    return { geo: ribbon(pts, 4.2), mat: makeFlowMaterial("#7fd8e0", "#ffffff", 1.4, 0.88), base };
  }, [world]);

  useEffect(
    () => () => {
      sea.geo.dispose();
      sea.mat.dispose();
    },
    [sea],
  );

  return (
    <group>
      <mesh geometry={sea.geo} material={sea.mat} position={[0, SEA_LEVEL, 0]} renderOrder={1} />
      <mesh geometry={lake.geo} material={lake.mat} position={[LAKE_CENTER[0], LAKE_LEVEL, LAKE_CENTER[1]]} renderOrder={1} />
      <mesh geometry={stream.geo} material={stream.mat} position={[0, 0.02, 0]} renderOrder={2} />
      <mesh geometry={fall.geo} material={fall.mat} renderOrder={2} />
      <WaterfallMist x={fall.base.x} z={fall.base.z} />
    </group>
  );
}

function WaterfallMist({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 14;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2, o: (i * 0.37) % 1 })), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      const life = (t * 0.45 + s.o) % 1;
      const r = 1 + life * 3.2;
      const sc = 0.6 + life * 1.6;
      m.makeScale(sc, sc * 0.7, sc);
      m.setPosition(x + Math.cos(s.a) * r, SEA_LEVEL + 0.2 + life * 2.2, z + Math.sin(s.a) * r);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} flatShading />
    </instancedMesh>
  );
}
