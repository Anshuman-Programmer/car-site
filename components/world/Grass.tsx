"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { vehicle } from "@/lib/vehicleState";
import { GRID, getWorld, coastT, heightAt } from "@/lib/world/terrain";
import { LAKE_CENTER, lakeRadius, PADS, WORLD_HALF } from "@/lib/world/layout";
import { exclusionZones } from "@/lib/world/structures";
import { mulberry32, smoothstep } from "@/lib/world/noise";
import { getGround } from "./groundColors";
import { sharedUniforms } from "./materials";

/**
 * A dense carpet of individual blades that follows the camera. Blades live
 * in a tile that wraps in world space, so they stay put as the car drives
 * through them; height, colour and density come from the baked terrain. The
 * car stamps a trail texture each frame and blades bend away from it, then
 * spring back as the trail fades.
 */

const CELL = (WORLD_HALF * 2) / (GRID - 1);
const TRAIL_RES = 320;
const TRAIL_SIZE = 150; // metres covered before it wraps; fully recovered long before the car gets that far
const TRAIL_CELL = TRAIL_SIZE / TRAIL_RES;
const TRAIL_PEAK = 2; // stamped above 1 so grass stays flat for a while before springing back
const TRAIL_RECOVER = 0.36; // per second

// The car as rendered (CarModel at Vehicle's 0.7 scale), in metres from its centre.
const CAR_HALF_LENGTH = 1.55;
const CAR_HALF_WIDTH = 1.0;
const WHEEL_ALONG = 1.16;
const WHEEL_ACROSS = 0.79;
const FOOTPRINT_SOFT = 0.6; // grass bends a little beyond the body edge
const FOOTPRINT_REACH = Math.hypot(CAR_HALF_LENGTH, CAR_HALF_WIDTH) + FOOTPRINT_SOFT;

// Big enough to cover the locked camera's whole ground footprint (~42 m ahead, ~±30 m wide).
const SETTINGS = {
  high: { blades: 80000, radius: 38, clippings: 70 },
  low: { blades: 22000, radius: 28, clippings: 30 },
};

// ------------------------------------------------------------------ baked data

let densityCache: Float32Array | null = null;

/** Where blades may grow: grassy ground away from water, buildings and the stream. */
function getDensity() {
  if (densityCache) return densityCache;
  const { grassy } = getGround();
  const { stream, fallIndex } = getWorld();
  const zones = exclusionZones();
  const wet = stream.slice(0, fallIndex + 3);
  const out = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const k = j * GRID + i;
      let d = grassy[k];
      if (d <= 0) continue;
      const x = i * CELL - WORLD_HALF;
      const z = j * CELL - WORLD_HALF;
      d *= 1 - smoothstep(0.86, 0.9, coastT(x, z).t);
      const lx = x - LAKE_CENTER[0];
      const lz = z - LAKE_CENTER[1];
      d *= smoothstep(1.14, 1.3, Math.hypot(lx, lz) / lakeRadius(Math.atan2(lz, lx)));
      for (const [zx, zz, r] of zones) d *= smoothstep(r * 0.8, r, Math.hypot(x - zx, z - zz));
      for (const p of PADS) d *= smoothstep(p.r * 0.8, p.r + 0.5, Math.hypot(x - p.x, z - p.z));
      if (d > 0) {
        let sd = Infinity;
        for (let n = 0; n < wet.length; n += 2) sd = Math.min(sd, Math.abs(wet[n].x - x) + Math.abs(wet[n].z - z));
        if (sd < 9) {
          sd = Infinity;
          for (const s of wet) sd = Math.min(sd, Math.hypot(s.x - x, s.z - z));
          d *= smoothstep(3.6, 5.6, sd);
        }
      }
      out[k] = d;
    }
  }
  densityCache = out;
  return out;
}

function densityAt(x: number, z: number) {
  const arr = getDensity();
  const gx = Math.min(Math.max((x + WORLD_HALF) / CELL, 0), GRID - 1.001);
  const gz = Math.min(Math.max((z + WORLD_HALF) / CELL, 0), GRID - 1.001);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const a = arr[j * GRID + i];
  const b = arr[j * GRID + i + 1];
  const c = arr[(j + 1) * GRID + i];
  const d = arr[(j + 1) * GRID + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function makeTextures() {
  const { heights } = getWorld();
  const { colors } = getGround();
  const density = getDensity();

  // Exact heights, read with texelFetch and filtered in the shader to match heightAt().
  const height = new THREE.DataTexture(heights, GRID, GRID, THREE.RedFormat, THREE.FloatType);
  height.needsUpdate = true;

  // Ground colour (gamma-encoded so 8 bits hold the darks) with density in alpha.
  const g = new Uint8Array(GRID * GRID * 4);
  for (let k = 0; k < GRID * GRID; k++) {
    for (let c = 0; c < 3; c++) g[k * 4 + c] = Math.round(Math.pow(colors[k * 3 + c], 1 / 2.2) * 255);
    g[k * 4 + 3] = Math.round(density[k] * 255);
  }
  const ground = new THREE.DataTexture(g, GRID, GRID, THREE.RGBAFormat, THREE.UnsignedByteType);
  ground.magFilter = THREE.LinearFilter;
  ground.minFilter = THREE.LinearFilter;
  ground.needsUpdate = true;

  // R = how flattened, GB = push direction. Wraps so it can scroll with the car.
  const trailData = new Uint8Array(TRAIL_RES * TRAIL_RES * 4).fill(128);
  for (let k = 0; k < TRAIL_RES * TRAIL_RES; k++) trailData[k * 4] = 0;
  const trail = new THREE.DataTexture(trailData, TRAIL_RES, TRAIL_RES, THREE.RGBAFormat, THREE.UnsignedByteType);
  trail.wrapS = trail.wrapT = THREE.RepeatWrapping;
  trail.magFilter = THREE.LinearFilter;
  trail.minFilter = THREE.LinearFilter;
  trail.needsUpdate = true;

  return { height, ground, trail, trailData, trailFlat: new Float32Array(TRAIL_RES * TRAIL_RES) };
}

// ------------------------------------------------------------------ blades

function bladeGeometry(count: number, tile: number) {
  const geo = new THREE.InstancedBufferGeometry();
  // x = side (-1..1), y = position along the blade (0 root .. 1 tip).
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -0.85, 0.35, 0, 0.85, 0.35, 0, -0.6, 0.7, 0, 0.6, 0.7, 0, 0, 1, 0], 3),
  );
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(21).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  const rand = mulberry32(4242);
  const offset = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    offset[i * 2] = rand() * tile;
    offset[i * 2 + 1] = rand() * tile;
    for (let c = 0; c < 4; c++) seeds[i * 4 + c] = rand();
  }
  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 2));
  geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  return geo;
}

function bladeMaterial(tex: ReturnType<typeof makeTextures>, tile: number) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  mat.defines = {
    GRID_N: GRID.toFixed(1),
    CELL_SIZE: CELL.toFixed(5),
    HALF_W: WORLD_HALF.toFixed(1),
    TILE: tile.toFixed(2),
    TRAIL_SIZE: TRAIL_SIZE.toFixed(1),
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.uniforms.uField = sharedUniforms.uField;
    shader.uniforms.uHeightTex = { value: tex.height };
    shader.uniforms.uGroundTex = { value: tex.ground };
    shader.uniforms.uTrailTex = { value: tex.trail };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform vec3 uField;
        uniform sampler2D uHeightTex;
        uniform sampler2D uGroundTex;
        uniform sampler2D uTrailTex;
        attribute vec2 aOffset;
        attribute vec4 aRand;
        vec3 gPos;
        vec3 gNrm;
        vec3 gCol;

        float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float gHeight(vec2 g) {
          ivec2 i = min(ivec2(floor(g)), ivec2(int(GRID_N) - 2));
          vec2 f = g - vec2(i);
          float a = texelFetch(uHeightTex, i, 0).r;
          float b = texelFetch(uHeightTex, i + ivec2(1, 0), 0).r;
          float c = texelFetch(uHeightTex, i + ivec2(0, 1), 0).r;
          float d = texelFetch(uHeightTex, i + ivec2(1, 1), 0).r;
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void grassBlade() {
          // Wrap the tile around the field centre so blades keep their world position.
          vec2 rel = mod(aOffset - uField.xy + 0.5 * TILE, TILE) - 0.5 * TILE;
          vec2 w = uField.xy + rel;
          vec2 g = clamp((w + HALF_W) / CELL_SIZE, vec2(0.0), vec2(GRID_N - 1.001));
          vec4 ground = texture2D(uGroundTex, (g + 0.5) / GRID_N);

          // Patches of taller, thicker grass with thinner gaps between them.
          float patchN = gNoise(w * 0.38 + 7.3) * 0.6 + gNoise(w * 0.09 - 2.1) * 0.6;
          float keep = step(aRand.x, ground.a * (0.45 + 0.7 * patchN));
          // Between the camera and the car, blades get short and sparse so the ground reads.
          float nearCam = smoothstep(6.0, 12.0, length(w - cameraPosition.xz));
          keep *= step(fract(aRand.x * 7.13), mix(0.35, 1.0, nearCam));
          float edge = 1.0 - smoothstep(uField.z * 0.82, uField.z, length(rel));
          float h = 1.4 * (0.38 + 0.5 * aRand.y) * (0.55 + 0.8 * patchN) * mix(0.35, 1.0, nearCam) * keep * edge;

          vec4 trail = texture2D(uTrailTex, w / TRAIL_SIZE);
          float flat_ = trail.r;
          h *= 1.0 - 0.3 * flat_;

          float ang = aRand.z * 6.2831853;
          vec2 face = vec2(cos(ang), sin(ang));
          vec2 across = vec2(-face.y, face.x);

          // Natural lean, rolling gusts that sweep across the field, and a little flutter.
          vec2 windDir = vec2(0.83, 0.55);
          float gust = gNoise(w * 0.06 - windDir * uTime * 0.7);
          gust = gust * gust * 1.8;
          float flutter = sin(uTime * 3.1 + aRand.w * 6.2831853 + dot(w, vec2(1.3, 0.9))) * 0.18;
          vec2 bend2 = face * (0.25 + aRand.w * 0.35) + (windDir * (0.15 + gust) + across * flutter) * uWind * 0.8;

          // Pressed flat along the car's push direction.
          vec2 push = trail.gb * 2.0 - 1.0;
          vec2 pd = length(push) > 0.05 ? normalize(push) : face;
          bend2 = mix(bend2, pd * 2.2, flat_);

          // Constant-curvature arc, so a bent blade keeps its length.
          float B = max(length(bend2), 0.001);
          vec2 bd = bend2 / B;
          float t = position.y;
          float hor = h * (1.0 - cos(B * t)) / B;
          float ver = h * sin(B * t) / B;
          float wdt = (0.055 + 0.04 * aRand.y) * min(1.0, h * 4.0);
          vec2 wd = vec2(-bd.y, bd.x);

          gPos = vec3(w.x, gHeight(g) - 0.04, w.y) + vec3(bd.x * hor, ver, bd.y * hor) + vec3(wd.x, 0.0, wd.y) * position.x * wdt;
          // Mostly-up normals light the carpet like the ground; the lean adds sparkle.
          gNrm = normalize(vec3(bd.x, 1.4, bd.y));

          vec3 gc = pow(ground.rgb, vec3(2.2));
          vec3 root = gc * 0.5;
          vec3 tip = mix(gc * 1.45, vec3(0.86, 0.8, 0.38), 0.15 + 0.25 * aRand.w * patchN);
          gCol = mix(root, tip, t) * (0.85 + 0.3 * aRand.y) * (1.0 - 0.18 * flat_);        }`,
      )
      .replace("#include <color_vertex>", "grassBlade();\nvColor = vec4(gCol, 1.0);")
      .replace("#include <beginnormal_vertex>", "vec3 objectNormal = gNrm;")
      .replace("#include <begin_vertex>", "vec3 transformed = gPos;");
    // Keep the same normal on both faces so blades never flip dark.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      "#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;",
    );
  };
  return mat;
}

// ------------------------------------------------------------------ trail

const tmpRay = new THREE.Vector3();
const corners = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
/** How far a ray that never meets the ground (above the horizon) is allowed to reach. */
const FOOTPRINT_MAX = 70;

/** Where a screen corner (NDC x, y) lands on the ground plane at height `gy`. */
function groundHit(camera: THREE.Camera, nx: number, ny: number, gy: number, out: THREE.Vector2) {
  tmpRay.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
  const p = camera.position;
  const t = tmpRay.y < -0.02 ? Math.min((gy - p.y) / tmpRay.y, FOOTPRINT_MAX) : FOOTPRINT_MAX;
  return out.set(p.x + tmpRay.x * t, p.z + tmpRay.z * t);
}

/**
 * Smallest circle around the camera's ground footprint. With no roll the
 * footprint is a symmetric trapezoid, so the centre lies on its axis between
 * the near and far edge midpoints.
 */
function footprintCircle(camera: THREE.Camera, gy: number) {
  const [bl, br, tl, tr] = corners;
  groundHit(camera, -1, -1, gy, bl);
  groundHit(camera, 1, -1, gy, br);
  groundHit(camera, -1, 1, gy, tl);
  groundHit(camera, 1, 1, gy, tr);
  const nx = (bl.x + br.x) / 2;
  const nz = (bl.y + br.y) / 2;
  const fx = (tl.x + tr.x) / 2;
  const fz = (tl.y + tr.y) / 2;
  const len = Math.hypot(fx - nx, fz - nz) || 1;
  const wn = bl.distanceTo(br) / 2;
  const wf = tl.distanceTo(tr) / 2;
  const t = Math.max(0, Math.min(len, (len * len + wf * wf - wn * wn) / (2 * len)));
  return {
    x: nx + ((fx - nx) / len) * t,
    z: nz + ((fz - nz) / len) * t,
    r: Math.max(Math.hypot(t, wn), Math.hypot(len - t, wf)),
  };
}

function updateTrail(tex: ReturnType<typeof makeTextures>, dt: number) {
  const { trailData, trailFlat } = tex;
  let active = false;
  const fall = dt * TRAIL_RECOVER;
  for (let k = 0; k < trailFlat.length; k++) {
    const v = trailFlat[k];
    if (v <= 0) continue;
    const nv = Math.max(0, v - fall);
    trailFlat[k] = nv;
    trailData[k * 4] = Math.min(255, Math.round(nv * 255));
    active = true;
  }

  // Stamp the car's footprint, pushing blades forward and out to the sides.
  const fx = Math.sin(vehicle.heading);
  const fz = Math.cos(vehicle.heading);
  const rx = fz;
  const rz = -fx;
  const move = Math.max(-1, Math.min(1, vehicle.speed / 4));
  const r = FOOTPRINT_REACH;
  const i0 = Math.floor((vehicle.x - r) / TRAIL_CELL);
  const i1 = Math.floor((vehicle.x + r) / TRAIL_CELL);
  const j0 = Math.floor((vehicle.z - r) / TRAIL_CELL);
  const j1 = Math.floor((vehicle.z + r) / TRAIL_CELL);
  for (let j = j0; j <= j1; j++) {
    const dz = (j + 0.5) * TRAIL_CELL - vehicle.z;
    const row = ((j % TRAIL_RES) + TRAIL_RES) % TRAIL_RES;
    for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5) * TRAIL_CELL - vehicle.x;
      const along = dx * fx + dz * fz;
      const side = dx * rx + dz * rz;
      const k = 1 - smoothstep(-0.2, FOOTPRINT_SOFT, Math.max(Math.abs(along) - CAR_HALF_LENGTH, Math.abs(side) - CAR_HALF_WIDTH));
      if (k <= 0) continue;
      const idx = row * TRAIL_RES + (((i % TRAIL_RES) + TRAIL_RES) % TRAIL_RES);
      const v = TRAIL_PEAK * k;
      if (v <= trailFlat[idx]) continue;
      trailFlat[idx] = v;
      const sd = side >= 0 ? 1 : -1;
      let px = fx * move * 0.7 + rx * sd * 0.8;
      let pz = fz * move * 0.7 + rz * sd * 0.8;
      const l = Math.hypot(px, pz) || 1;
      px /= l;
      pz /= l;
      trailData[idx * 4] = Math.min(255, Math.round(v * 255));
      trailData[idx * 4 + 1] = Math.round((px * 0.5 + 0.5) * 255);
      trailData[idx * 4 + 2] = Math.round((pz * 0.5 + 0.5) * 255);
      active = true;
    }
  }
  if (active) tex.trail.needsUpdate = true;
}

// ------------------------------------------------------------------ clippings

interface Bit {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  spin: number;
}

function makeClippings(count: number) {
  const bits: Bit[] = Array.from({ length: count }, () => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, spin: 0 }));
  return { bits, next: 0, carry: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() };
}

/** Bits of grass thrown up by the rear wheels when driving across the meadow. */
function Clippings({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stateRef = useRef<ReturnType<typeof makeClippings> | null>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const pal = ["#8fc25a", "#a8cc5e", "#7bb04e", "#c3c867"].map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) mesh.setColorAt(i, pal[i % pal.length]);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    if (!stateRef.current || stateRef.current.bits.length !== count) stateRef.current = makeClippings(count);
    const state = stateRef.current;
    const { bits, m, q, e, v, s } = state;
    const speed = Math.abs(vehicle.speed);
    const dens = densityAt(vehicle.x, vehicle.z);
    state.carry += dt * 45 * dens * Math.max(0, Math.min(1, (speed - 2) / 10));
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    const back = -Math.sign(vehicle.speed || 1);
    while (state.carry >= 1) {
      state.carry -= 1;
      const b = bits[state.next];
      state.next = (state.next + 1) % bits.length;
      const sd = Math.random() < 0.5 ? -1 : 1;
      // Trailing wheels: behind the car when driving forward, ahead when reversing.
      b.x = vehicle.x + fx * back * WHEEL_ALONG + fz * sd * WHEEL_ACROSS;
      b.z = vehicle.z + fz * back * WHEEL_ALONG - fx * sd * WHEEL_ACROSS;
      b.y = heightAt(b.x, b.z) + 0.15;
      const kick = 1 + Math.random() * 2.5;
      b.vx = fx * back * kick + fz * sd * Math.random() * 1.2;
      b.vz = fz * back * kick - fx * sd * Math.random() * 1.2;
      b.vy = 2 + Math.random() * 2.5;
      b.life = 0.9 + Math.random() * 0.6;
      b.spin = Math.random() * 10;
    }
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      if (b.life > 0) {
        b.life -= dt;
        b.vy -= 9 * dt;
        const drag = Math.exp(-2.2 * dt);
        b.vx *= drag;
        b.vz *= drag;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.spin += dt * 9;
      }
      const sc = b.life > 0 ? Math.min(1, b.life * 3) : 0;
      e.set(b.spin, b.spin * 0.7, b.spin * 1.3);
      q.setFromEuler(e);
      v.set(b.x, b.y, b.z);
      s.set(sc, sc, sc);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.07, 0.22]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.85} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------------ field

export function Grass({ quality }: { quality: "high" | "low" }) {
  const cfg = SETTINGS[quality];
  const tex = useMemo(() => makeTextures(), []);
  const field = useMemo(() => {
    const tile = cfg.radius * 2;
    return { geo: bladeGeometry(cfg.blades, tile), mat: bladeMaterial(tex, tile) };
  }, [cfg, tex]);

  useEffect(
    () => () => {
      field.geo.dispose();
      field.mat.dispose();
    },
    [field],
  );
  useEffect(
    () => () => {
      tex.height.dispose();
      tex.ground.dispose();
      tex.trail.dispose();
      sharedUniforms.uField.value.z = 0;
    },
    [tex],
  );

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    // Centre the field on everything the camera can see, but keep the car well inside it.
    const fp = footprintCircle(camera, vehicle.y);
    let cx = fp.x;
    let cz = fp.z;
    const ox = cx - vehicle.x;
    const oz = cz - vehicle.z;
    const ol = Math.hypot(ox, oz);
    const maxOff = cfg.radius * 0.7;
    if (ol > maxOff) {
      cx = vehicle.x + (ox / ol) * maxOff;
      cz = vehicle.z + (oz / ol) * maxOff;
    }
    sharedUniforms.uField.value.set(cx, cz, cfg.radius);
    updateTrail(tex, dt);
  });

  return (
    <group>
      <mesh geometry={field.geo} material={field.mat} frustumCulled={false} receiveShadow />
      <Clippings count={cfg.clippings} />
    </group>
  );
}
