"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getScatter, type Instance } from "@/lib/world/scatter";
import { mulberry32 } from "@/lib/world/noise";
import { makeWindMaterial, paint } from "./materials";
import { DRAW_ORDER } from "./xray";

// ------------------------------------------------------------------ geometry

function at(g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

type Lump = [x: number, y: number, z: number, r: number];

const ROUND_LUMPS: Lump[] = [
  [0, 3.7, 0, 1.75],
  [1.1, 3.2, 0.5, 1.15],
  [-1.0, 3.35, -0.5, 1.1],
  [0.3, 4.6, -0.4, 1.05],
  [-0.4, 3.0, 1.0, 0.95],
  [0.6, 3.1, -1.1, 0.9],
  [-0.6, 4.3, 0.6, 0.8],
];

const BLOSSOM_LUMPS: Lump[] = [
  [0.2, 3.3, 0, 1.5],
  [1.4, 3.0, 0.3, 1.05],
  [-0.9, 3.0, -0.6, 1.0],
  [0.3, 4.2, 0.6, 0.85],
  [-0.5, 3.9, -0.3, 0.9],
  [0.9, 3.7, -0.8, 0.8],
  [-1.1, 3.4, 0.7, 0.75],
  [1.0, 2.6, 1.0, 0.6],
];

const BUSH_LUMPS: Lump[] = [
  [0, 0.6, 0, 0.8],
  [0.7, 0.45, 0.2, 0.55],
  [-0.55, 0.5, -0.3, 0.5],
];

/** Leaf silhouette for the canopy cards; alphaMap reads the green channel. */
function leafTexture() {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = (i + 0.5) / S - 0.5;
      const v = (j + 0.5) / S;
      // Pointed at the tip, rounded at the base.
      const half = 0.44 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.8) * (1 - 0.35 * v);
      const a = Math.abs(u) < half ? 255 : 0;
      data.set([a, a, a, 255], (j * S + i) * 4);
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Fir sprig for the pine cards: a tapering spray with a serrated, needly edge. */
function sprigTexture() {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = Math.abs((i + 0.5) / S - 0.5);
      const v = (j + 0.5) / S;
      // Serrated rather than gappy, so the cut-out survives mipmapping at a distance.
      const saw = 1 - ((v * 6 + u * 2.2) % 1);
      const half = 0.47 * Math.pow(1 - v, 0.55) * Math.min(1, v * 6) * (0.72 + 0.28 * saw);
      const a = u < Math.max(half, v < 0.95 ? 0.035 : 0) ? 255 : 0;
      data.set([a, a, a, 255], (j * S + i) * 4);
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Accumulates flat foliage cards (two triangles each) with shared crown normals. */
function cardBuffer() {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const corners = [
    [-1, -1, 0, 0],
    [1, -1, 1, 0],
    [1, 1, 1, 1],
    [-1, 1, 0, 1],
  ];
  return {
    /** Card centred on `p`, spanning ±hw along `a` and ±hh along `b` (texture v runs along `b`). */
    push(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, hw: number, hh: number, n: THREE.Vector3, shade: number) {
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [cx, cy, u, v] = corners[k];
        pos.push(p.x + a.x * cx * hw + b.x * cy * hh, p.y + a.y * cx * hw + b.y * cy * hh, p.z + a.z * cx * hw + b.z * cy * hh);
        nrm.push(n.x, n.y, n.z);
        col.push(shade, shade, shade);
        uv.push(u, v);
      }
    },
    /** The cards merged with solid core shapes, whose uvs sit in the opaque middle of the texture. */
    build(cores: THREE.BufferGeometry[]) {
      const cards = new THREE.BufferGeometry();
      cards.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      cards.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      cards.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      cards.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      for (const g of cores) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(g.getAttribute("position").count * 2).fill(0.5), 2));
      return mergeGeometries([...cores, cards])!;
    },
  };
}

// #d0d0d0 is ~0.63 linear: just over the instance-tint threshold, so cores take the crown colour.
const CORE_SHADE = "#d0d0d0";

/**
 * A canopy of hundreds of small leaf cards spread through overlapping lumps,
 * around a dark core that hides the gaps. Normals point out of the whole
 * crown, so it shades as one soft mass while the cards break up its outline.
 */
function canopyGeometry(lumps: Lump[], leafSize: number, perArea: number, seed: number) {
  const rand = mulberry32(seed);
  const cards = cardBuffer();
  const centre = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y, z, r] of lumps) {
    centre.x += x / lumps.length;
    centre.y += y / lumps.length;
    centre.z += z / lumps.length;
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  }
  const dir = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const cn = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  for (const [x, y, z, r] of lumps) {
    const count = Math.round(r * r * perArea);
    for (let i = 0; i < count; i++) {
      // Uniform direction, a shell biased to the surface.
      const cy = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const sy = Math.sqrt(1 - cy * cy);
      dir.set(Math.cos(th) * sy, cy, Math.sin(th) * sy);
      const depth = 0.72 + rand() * 0.36;
      p.set(x + dir.x * r * depth, y + dir.y * r * depth * 0.88, z + dir.z * r * depth);
      n.copy(dir).multiplyScalar(0.55).add(tmp.subVectors(p, centre).normalize().multiplyScalar(0.45)).normalize();

      // The card faces roughly outward, tilted and spun at random.
      cn.copy(dir).add(tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.3)).normalize();
      a.crossVectors(cn, tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5)).normalize();
      b.crossVectors(cn, a);
      const s = leafSize * (0.75 + rand() * 0.55);
      // Lower and inner leaves sit in shade; stays above the 0.6 instance-tint threshold.
      const shade = Math.max(
        0.61,
        (0.7 + 0.3 * THREE.MathUtils.clamp((p.y - minY) / (maxY - minY), 0, 1)) * (0.88 + 0.12 * depth) * (0.9 + rand() * 0.1),
      );
      cards.push(p, a, b, s * 0.5, s * 0.5, n, shade);
    }
  }

  return cards.build(lumps.map(([x, y, z, r]) => paint(at(new THREE.IcosahedronGeometry(r * 0.62, 1), x, y, z, 1, 0.88, 1), CORE_SHADE)));
}

type Tier = [y: number, h: number, r: number]; // cone centre height, cone height, base radius

const PINE_TIERS: Tier[] = [
  [2.9, 3.0, 2.1],
  [4.4, 2.7, 1.65],
  [5.8, 2.2, 1.1],
];

/**
 * Pine crown: stacked skirts of fir sprigs. Each sprig grows out of a tier's
 * cone surface, angled outward and down, around a slimmer solid cone.
 */
function pineCanopyGeometry(tiers: Tier[], sprigSize: number, perArea: number, seed: number) {
  const rand = mulberry32(seed);
  const cards = cardBuffer();
  const minY = tiers[0][0] - tiers[0][1] / 2;
  const top = tiers[tiers.length - 1];
  const maxY = top[0] + top[1] / 2;
  const up = new THREE.Vector3(0, 1, 0);
  const out = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  for (const [y, h, r] of tiers) {
    const count = Math.round(Math.PI * r * Math.hypot(r, h) * perArea);
    for (let i = 0; i < count; i++) {
      // Area grows toward the skirt, so sample height with a square-root bias.
      const v = 1 - Math.sqrt(rand());
      const th = rand() * Math.PI * 2;
      out.set(Math.cos(th), 0, Math.sin(th));
      const rr = r * (1 - v) * (0.82 + rand() * 0.28);
      p.set(out.x * rr, y - h / 2 + v * h, out.z * rr);
      n.copy(out).multiplyScalar(h).addScaledVector(up, r * 1.4).normalize();

      // Sprig points outward and droops, twisted a little about its own axis.
      b.copy(out).addScaledVector(up, -0.45 - rand() * 0.25).add(tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5)).normalize();
      a.crossVectors(b, up).normalize();
      const twist = (rand() - 0.5) * 1.2;
      a.multiplyScalar(Math.cos(twist)).add(tmp.crossVectors(b, a).multiplyScalar(Math.sin(twist))).normalize();
      const s = sprigSize * (0.75 + rand() * 0.5) * (0.7 + 0.3 * (1 - v));
      p.addScaledVector(b, s * 0.3);

      // Higher sprigs catch the light; each skirt's upper part sits under the next one.
      const shade = Math.max(0.61, (0.68 + 0.32 * (p.y - minY) / (maxY - minY)) * (0.86 + 0.14 * (1 - v)) * (0.9 + rand() * 0.1));
      cards.push(p, a, b, s * 0.32, s * 0.5, n, shade);
    }
  }

  return cards.build(tiers.map(([y, h, r]) => paint(at(new THREE.ConeGeometry(r * 0.68, h * 0.92, 9), 0, y, 0), CORE_SHADE)));
}

function pineTrunkGeometry() {
  return paint(at(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6), 0, 0.9, 0), "#6b4630");
}

function roundTrunkGeometry() {
  return mergeGeometries([
    paint(at(new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6), 0, 1.3, 0), "#6e4a33"),
    paint(at(new THREE.CylinderGeometry(0.07, 0.11, 1.3, 5).rotateZ(0.8), -0.6, 2.4, 0.1), "#6e4a33"),
    paint(at(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 5).rotateZ(-0.7).rotateY(0.9), 0.4, 2.6, -0.4), "#6e4a33"),
  ])!;
}

function blossomTrunkGeometry() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6);
  trunk.rotateZ(0.12);
  return mergeGeometries([
    paint(at(trunk, 0.1, 1.2, 0), "#5b3a2c"),
    paint(at(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 5).rotateZ(-0.9), 0.75, 2.3, 0), "#5b3a2c"),
    paint(at(new THREE.CylinderGeometry(0.06, 0.1, 1.1, 5).rotateZ(0.8), -0.5, 2.5, -0.2), "#5b3a2c"),
  ])!;
}

export function rockGeometry(seed: number) {
  const g = new THREE.DodecahedronGeometry(1, 0);
  const rand = mulberry32(seed);
  const p = g.getAttribute("position");
  // Jitter shared vertices consistently so the rock stays closed.
  const offsets = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, 0.75 + rand() * 0.5);
    const f = offsets.get(key)!;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.75, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return paint(g, "#ffffff");
}

/** A spiky tuft: blades fanned around the centre, dark at the root. */
function grassGeometry(blades: number, height: number, seed: number) {
  const rand = mulberry32(seed);
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + rand() * 0.6;
    const r = 0.05 + rand() * 0.14;
    const w = 0.07 + rand() * 0.05;
    const h = height * (0.6 + rand() * 0.55);
    const lean = 0.15 + rand() * 0.25;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    // Blade faces sideways to its lean so tufts look full from any angle.
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    const tx = bx + Math.cos(a) * lean * h;
    const tz = bz + Math.sin(a) * lean * h;
    // Both windings, so every blade is front-facing and shares an upward normal.
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz);
    pos.push(bx + px, 0, bz + pz, bx - px, 0, bz - pz, tx, h, tz);
    // Roots stay above the wind shader's 0.6 tint threshold so they pick up the instance colour.
    const root = 0.62 + rand() * 0.08;
    for (let k = 0; k < 2; k++) col.push(root, root, root, root, root, root, 1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  // Lit from above rather than per blade, so tufts never flicker dark.
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

function leafGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.14, 0.09, 0, 0, 0, 0, 0.14, -0.09, 0, 0], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return paint(g, "#ffffff");
}

function flowerHeadGeometry() {
  return paint(at(new THREE.IcosahedronGeometry(0.16, 0), 0, 0.42, 0), "#ffffff");
}

function flowerStemGeometry() {
  return paint(at(new THREE.CylinderGeometry(0.02, 0.025, 0.42, 3), 0, 0.21, 0), "#4f8a3c");
}

function mushroomGeometry() {
  return mergeGeometries([
    paint(at(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 5), 0, 0.15, 0), "#f3ead8"),
    paint(at(new THREE.SphereGeometry(0.22, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.28, 0, 1, 0.8, 1), "#e2483d"),
  ])!;
}

// ------------------------------------------------------------------ instancing

const PALETTES = {
  pine: ["#2f6b4f", "#3a7d57", "#2a5f55", "#447f4a", "#356e60"],
  // Greens drifting into early autumn.
  round: ["#6fae4f", "#86bf55", "#a9c455", "#f0c24b", "#e98a35", "#d4532f", "#7bb661"],
  blossom: ["#f7a1c4", "#ff8fab", "#ff9a8b", "#ffc2d4", "#f78fb3", "#ffb3a7"],
  bush: ["#5d9a4a", "#6aa955", "#4f8a43", "#7cb85a"],
  rock: ["#b9a48b", "#c7a57d", "#a99880", "#cdb393", "#9c8a75"],
  cliff: ["#c99766", "#b8865a", "#d4a874", "#a87652", "#c08f62"],
  grass: ["#7fbf5a", "#8fcb63", "#6fae4f", "#9ccf6c", "#a8c862"],
  clump: ["#86b84f", "#a3c457", "#6fa64a", "#bcc45a", "#93bd55"],
  leaf: ["#e0512f", "#f08a2c", "#f6b93b", "#c93a32", "#ff9d5c", "#e8663a"],
  pebble: ["#f1ece4", "#e3ddd3", "#fbf7f0", "#d6cfc4"],
  flower: ["#ff7aa2", "#ffd166", "#ffffff", "#b49cff", "#ff9e6d", "#f15bb5"],
  mushroom: ["#ffffff"],
};

export function InstancedSet({
  items,
  geometry,
  material,
  colors,
  count,
  castShadow = false,
  scaleY = 1,
  depthMaterial,
}: {
  items: Instance[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  colors: string[];
  count?: number;
  castShadow?: boolean;
  scaleY?: number;
  /** Shadow-pass material, for cut-out foliage. */
  depthMaterial?: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = items.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pal = colors.map((c) => new THREE.Color(c));
    const col = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * scaleY, it.s));
      mesh.setMatrixAt(i, m);
      const t = it.tint * pal.length;
      const a = pal[Math.floor(t) % pal.length];
      const b = pal[(Math.floor(t) + 1) % pal.length];
      col.copy(a).lerp(b, (t % 1) * 0.35);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, colors, scaleY]);

  useLayoutEffect(() => {
    if (ref.current) ref.current.count = Math.min(n, count ?? n);
  }, [count, n]);

  return <instancedMesh ref={ref} args={[geometry, material, n]} castShadow={castShadow} receiveShadow customDepthMaterial={depthMaterial} />;
}

export function Vegetation({ quality }: { quality: "high" | "low" }) {
  const scatter = getScatter();

  const assets = useMemo(() => {
    const flat = { vertexColors: true, flatShading: true, roughness: 0.85 };
    const leafTex = leafTexture();
    const foliage = { vertexColors: true, alphaMap: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 };
    return {
      leafTex,
      roundTrunkGeo: roundTrunkGeometry(),
      roundGeo: canopyGeometry(ROUND_LUMPS, 0.42, 95, 7),
      blossomTrunkGeo: blossomTrunkGeometry(),
      blossomGeo: canopyGeometry(BLOSSOM_LUMPS, 0.36, 110, 8),
      bushGeo: canopyGeometry(BUSH_LUMPS, 0.26, 160, 9),
      foliageDepthMat: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: leafTex, alphaTest: 0.5 }),
      rockGeo: rockGeometry(3),
      cliffGeo: rockGeometry(11),
      grassGeo: grassGeometry(5, 0.6, 1),
      clumpGeo: grassGeometry(9, 1.05, 2),
      leafGeo: leafGeometry(),
      pebbleGeo: rockGeometry(23),
      headGeo: flowerHeadGeometry(),
      stemGeo: flowerStemGeometry(),
      mushGeo: mushroomGeometry(),
      trunkMat: makeWindMaterial(flat, { amp: 0.012, freq: 1.4, bendStart: 2.2 }),
      blossomTrunkMat: makeWindMaterial(flat, { amp: 0.014, freq: 1.6, bendStart: 1.8 }),
      roundMat: makeWindMaterial(foliage, { amp: 0.012, freq: 1.4, bendStart: 2.2, leaves: true }),
      blossomMat: makeWindMaterial({ ...foliage, roughness: 0.65 }, { amp: 0.014, freq: 1.6, bendStart: 1.8, leaves: true }),
      bushMat: makeWindMaterial(foliage, { amp: 0.05, freq: 2.0, bendStart: 0.2, leaves: true }),
      grassMat: makeWindMaterial({ vertexColors: true, roughness: 0.9 }, { amp: 0.45, freq: 2.6, bendStart: 0.05, fieldFade: true }),
      clumpMat: makeWindMaterial({ vertexColors: true, roughness: 0.9 }, { amp: 0.22, freq: 2.2, bendStart: 0.1, fieldFade: true }),
      leafMat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }),
      headMat: makeWindMaterial({ ...flat, roughness: 0.6 }, { amp: 0.35, freq: 2.4, bendStart: 0.05 }),
      stemMat: makeWindMaterial({ vertexColors: true, roughness: 0.9 }, { amp: 0.35, freq: 2.4, bendStart: 0.05 }),
      rockMat: new THREE.MeshStandardMaterial({ ...flat, roughness: 0.95 }),
      mushMat: new THREE.MeshStandardMaterial({ ...flat, roughness: 0.6 }),
    };
  }, []);

  const low = quality === "low";

  // Pines are the most numerous tree, so Low quality gets sparser sprigs.
  const pine = useMemo(() => {
    const sprigTex = sprigTexture();
    const wind = { amp: 0.006, freq: 1.1, bendStart: 1.6 };
    return {
      sprigTex,
      trunkGeo: pineTrunkGeometry(),
      canopyGeo: pineCanopyGeometry(PINE_TIERS, 0.7, low ? 6 : 10.5, 6),
      trunkMat: makeWindMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }, wind),
      canopyMat: makeWindMaterial(
        { vertexColors: true, alphaMap: sprigTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 },
        { ...wind, leaves: true },
      ),
      depthMat: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: sprigTex, alphaTest: 0.5 }),
    };
  }, [low]);

  useEffect(
    () => () => {
      Object.values(assets).forEach((a) => (a as { dispose?: () => void }).dispose?.());
    },
    [assets],
  );
  useEffect(
    () => () => {
      Object.values(pine).forEach((a) => a.dispose());
    },
    [pine],
  );

  return (
    <group>
      <InstancedSet items={scatter.pines} geometry={pine.trunkGeo} material={pine.trunkMat} colors={["#ffffff"]} castShadow={!low} />
      <InstancedSet items={scatter.pines} geometry={pine.canopyGeo} material={pine.canopyMat} colors={PALETTES.pine} castShadow={!low} depthMaterial={pine.depthMat} />
      <InstancedSet items={scatter.roundTrees} geometry={assets.roundTrunkGeo} material={assets.trunkMat} colors={["#ffffff"]} castShadow={!low} />
      <InstancedSet items={scatter.roundTrees} geometry={assets.roundGeo} material={assets.roundMat} colors={PALETTES.round} castShadow={!low} depthMaterial={assets.foliageDepthMat} />
      <InstancedSet items={scatter.blossoms} geometry={assets.blossomTrunkGeo} material={assets.blossomTrunkMat} colors={["#ffffff"]} castShadow={!low} />
      <InstancedSet items={scatter.blossoms} geometry={assets.blossomGeo} material={assets.blossomMat} colors={PALETTES.blossom} castShadow={!low} depthMaterial={assets.foliageDepthMat} />
      <InstancedSet items={scatter.rocks} geometry={assets.rockGeo} material={assets.rockMat} colors={PALETTES.rock} castShadow={!low} />
      <InstancedSet items={scatter.cliffRocks} geometry={assets.cliffGeo} material={assets.rockMat} colors={PALETTES.cliff} scaleY={1.3} />
      {/* Things the car drives through: drawn after it, so they never trigger its see-through outline. */}
      <group renderOrder={DRAW_ORDER.clutter}>
        <InstancedSet items={scatter.bushes} geometry={assets.bushGeo} material={assets.bushMat} colors={PALETTES.bush} depthMaterial={assets.foliageDepthMat} castShadow={!low} />
        <InstancedSet items={scatter.grass} geometry={assets.grassGeo} material={assets.grassMat} colors={PALETTES.grass} count={low ? 3000 : undefined} />
        <InstancedSet items={scatter.grassClumps} geometry={assets.clumpGeo} material={assets.clumpMat} colors={PALETTES.clump} count={low ? 6000 : undefined} />
        <InstancedSet items={scatter.leaves} geometry={assets.leafGeo} material={assets.leafMat} colors={PALETTES.leaf} count={low ? 3000 : undefined} />
        <InstancedSet items={scatter.pebbles} geometry={assets.pebbleGeo} material={assets.rockMat} colors={PALETTES.pebble} />
        <InstancedSet items={scatter.flowers} geometry={assets.stemGeo} material={assets.stemMat} colors={["#ffffff"]} count={low ? 600 : undefined} />
        <InstancedSet items={scatter.flowers} geometry={assets.headGeo} material={assets.headMat} colors={PALETTES.flower} count={low ? 600 : undefined} />
        <InstancedSet items={scatter.mushrooms} geometry={assets.mushGeo} material={assets.mushMat} colors={PALETTES.mushroom} />
      </group>
    </group>
  );
}
