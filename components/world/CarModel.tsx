"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paint } from "./materials";

/**
 * Lifted four-door off-roader: tall red body on a long wheelbase, raked and
 * tapered cabin with a black rear quarter, trapezoid black flares over fat
 * tyres, thick black rockers, a tapered hood and round amber lamps. Proportions
 * are measured off the reference turnaround (5 m body, wheelbase = 3 tyre
 * diameters). Every part is a flat-shaded primitive, extruded side profile or
 * eight-corner hull (z forward, y up) with its colour baked into vertex
 * colours, then merged per material, so the body draws in five calls and each
 * wheel in one.
 */

export const WHEEL_R = 0.55;
const WHEEL_X = 1.18;
const WHEEL_Z = 1.66;
const TYRE_HALF = 0.29;
const RIM_R = 0.32;
const ARCH_R = 0.7;
/** Bottom of the red body; the lift leaves the frame and axles in view below it. */
const SILL = 0.95;
const BODY_W = 2.2;
/** Body side plane; side-mounted parts are placed relative to it. */
const HW = BODY_W / 2;
const NOSE_Z = 2.19;
const TAIL_Z = -2.45;

/**
 * Hood: a wedge on the front of the body from the windscreen (HOOD_Z0) to the
 * nose. It stands proud of the belt and narrows by HOOD_TAPER per side towards
 * the nose, widening back to the full body width at the windscreen.
 */
const HOOD_Z0 = 1.0;
const HOOD_BASE = 1.4;
const HOOD_BACK_Y = 1.8;
const HOOD_FRONT_Y = 1.78;
const HOOD_TAPER = 0.14;
const HOOD_TILT = Math.atan((HOOD_BACK_Y - HOOD_FRONT_Y) / (NOSE_Z - HOOD_Z0));
const hoodY = (z: number) => lerp(HOOD_BACK_Y, HOOD_FRONT_Y, (z - HOOD_Z0) / (NOSE_Z - HOOD_Z0));

/** Cabin hull: bottom and top rings. The windscreen rakes back ~25°, the sides lean in. */
const CAB = { yB: 1.62, yT: 2.4, hwB: 0.94, hwT: 0.82, zFB: 1.1, zFT: 0.74, zBB: -2.36, zBT: -2.3 };
/** Behind the rear doors the cabin is black. */
const QUARTER_Z = -1.47;
const ROOF_Y = CAB.yT + 0.06;

const C = {
  red: "#e5332a",
  black: "#2a2229",
  deep: "#17121a",
  steel: "#4a4248",
  plate: "#3b2c33",
  tyre: "#2b2228",
  lug: "#221b20",
  rim: "#d92b26",
  amber: "#ffd05a",
  amberCore: "#fff3c2",
  fog: "#ffb43c",
  ember: "#ff4a36",
};

type V3 = [number, number, number];
type Bucket = "paint" | "trim" | "glass" | "glow" | "brake";
const SIDES = [1, -1] as const;
const lerp = THREE.MathUtils.lerp;
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function box(size: V3, pos: V3, rot?: V3) {
  const g = new THREE.BoxGeometry(...size);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  g.translate(...pos);
  return g;
}

/** Cylinder between two points, for axles, arms and shocks. */
function tube(a: V3, b: V3, r: number, seg = 6) {
  const va = vec(...a);
  const vb = vec(...b);
  const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), vb.clone().sub(va).normalize()));
  const m = va.add(vb).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Disc facing along x, for rim faces and hubs. */
function disc(r: number, depth: number, x: number, seg: number) {
  const g = new THREE.CylinderGeometry(r, r, depth, seg);
  g.rotateZ(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

/** Disc facing along z, for round lamps. */
function discZ(r: number, depth: number, x: number, y: number, z: number, seg: number) {
  const g = new THREE.CylinderGeometry(r, r, depth, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/**
 * Box with its eight corners placed explicitly, indexed x | y << 1 | z << 2
 * (bit set = positive side). Mirrored corner sets are flipped so faces stay outward.
 */
function hex(c: THREE.Vector3[]) {
  const e1 = c[1].clone().sub(c[0]);
  const e2 = c[2].clone().sub(c[0]);
  if (e1.cross(e2).dot(c[4].clone().sub(c[0])) < 0) c = c.map((_, k) => c[k ^ 1]);
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const k = (p.getX(i) > 0 ? 1 : 0) | (p.getY(i) > 0 ? 2 : 0) | (p.getZ(i) > 0 ? 4 : 0);
    p.setXYZ(i, c[k].x, c[k].y, c[k].z);
  }
  g.computeVertexNormals();
  return g;
}

type Ring = { y: number; hw: number; zf: number; zb: number };
/** Hull between a bottom and top rectangle, for the tapered cabin and roof. */
function frustum(b: Ring, t: Ring) {
  return hex(
    Array.from({ length: 8 }, (_, k) => {
      const r = k & 2 ? t : b;
      return vec((k & 1 ? 1 : -1) * r.hw, r.y, k & 4 ? r.zf : r.zb);
    }),
  );
}

/** Slab laid on a planar quad (u0v0, u1v0, u0v1, u1v1), lifted `off` along `n`. */
function panel(q: THREE.Vector3[], n: THREE.Vector3, off: number, t: number) {
  return hex(Array.from({ length: 8 }, (_, k) => q[k & 3].clone().addScaledVector(n, k & 4 ? off + t : off)));
}

/** Points and normals on the cabin's faces; v runs 0 at the belt to 1 at the roof. */
const cab = {
  zF: (v: number) => lerp(CAB.zFB, CAB.zFT, v),
  zR: (v: number) => lerp(CAB.zBB, CAB.zBT, v),
  vAt: (y: number) => (y - CAB.yB) / (CAB.yT - CAB.yB),
  side: (s: number, z: number, v: number) => vec(s * lerp(CAB.hwB, CAB.hwT, v), lerp(CAB.yB, CAB.yT, v), z),
  front: (u: number, v: number) => vec(u * lerp(CAB.hwB, CAB.hwT, v), lerp(CAB.yB, CAB.yT, v), cab.zF(v)),
  rear: (u: number, v: number) => vec(u * lerp(CAB.hwB, CAB.hwT, v), lerp(CAB.yB, CAB.yT, v), cab.zR(v)),
  sideN: (s: number) => vec(s * (CAB.yT - CAB.yB), CAB.hwB - CAB.hwT, 0).normalize(),
  frontN: vec(0, CAB.zFB - CAB.zFT, CAB.yT - CAB.yB).normalize(),
  rearN: vec(0, CAB.zBT - CAB.zBB, CAB.yB - CAB.yT).normalize(),
};
/** v per metre along the cabin's slanted faces. */
const V_PER_M = 1 / Math.hypot(CAB.yT - CAB.yB, CAB.hwB - CAB.hwT);

/** Quad on a cabin side between two z edges (functions of v), optionally grown outward. */
function sideQuad(s: number, zf: (v: number) => number, zb: (v: number) => number, v0: number, v1: number, grow = 0) {
  const a = v0 - grow * V_PER_M;
  const b = v1 + grow * V_PER_M;
  return [cab.side(s, zf(a) + grow, a), cab.side(s, zb(a) - grow, a), cab.side(s, zf(b) + grow, b), cab.side(s, zb(b) - grow, b)];
}

/** Quad across the windscreen (front) or rear glass, optionally grown outward. */
function endQuad(face: "front" | "rear", hu: number, v0: number, v1: number, grow = 0) {
  const at = cab[face];
  const [a, b, u] = [v0 - grow * 1.4, v1 + grow * 1.4, hu + grow];
  return [at(-u, a), at(u, a), at(-u, b), at(u, b)];
}

/** Collects painted parts per material and merges each set into one geometry. */
function createKit() {
  const parts: Record<Bucket, THREE.BufferGeometry[]> = { paint: [], trim: [], glass: [], glow: [], brake: [] };
  return {
    add(bucket: Bucket, color: THREE.ColorRepresentation, ...geos: THREE.BufferGeometry[]) {
      for (const g of geos) parts[bucket].push(paint(g, color));
    },
    addPainted(bucket: Bucket, ...geos: THREE.BufferGeometry[]) {
      parts[bucket].push(...geos);
    },
    build() {
      const out = {} as Record<Bucket, THREE.BufferGeometry>;
      for (const key of Object.keys(parts) as Bucket[]) {
        out[key] = mergeGeometries(parts[key])!;
        parts[key].forEach((g) => g.dispose());
      }
      return out;
    },
  };
}

/** Extrude a side profile across the car, centred on x = 0. */
function extrudeAcross(shape: THREE.Shape, width: number, bevel = 0.04, curveSegments = 5) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments,
  });
  // Shape x -> world z, extrusion depth -> world -x.
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  return g;
}

/** Flat bar between two points in a plane facing z, for the spare-cover emblem. */
function bar2d(a: [number, number], b: [number, number], z: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return box([len + 0.025, 0.03, 0.015], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])]);
}

/**
 * Lower body with both wheel arches cut out of the sill line. The front arch
 * runs out through the nose (the bumper covers below it); the hood wedge sits
 * on the low front deck.
 */
function bodyGeometry() {
  const s = new THREE.Shape();
  const a = Math.asin((SILL - WHEEL_R) / ARCH_R);
  const dz = Math.cos(a) * ARCH_R;
  const noseArc = Math.acos((NOSE_Z - 0.02 - WHEEL_Z) / ARCH_R);
  s.moveTo(TAIL_Z, SILL);
  s.lineTo(-WHEEL_Z - dz, SILL);
  s.absarc(-WHEEL_Z, WHEEL_R, ARCH_R, Math.PI - a, a, true);
  s.lineTo(WHEEL_Z - dz, SILL);
  s.absarc(WHEEL_Z, WHEEL_R, ARCH_R, Math.PI - a, noseArc, true);
  s.lineTo(NOSE_Z, HOOD_BASE);
  s.lineTo(HOOD_Z0, HOOD_BASE);
  s.lineTo(HOOD_Z0, CAB.yB);
  s.lineTo(TAIL_Z + 0.03, CAB.yB);
  s.lineTo(TAIL_Z, CAB.yB - 0.04);
  s.closePath();
  return extrudeAcross(s, BODY_W, 0.035, 10);
}

/** Hood wedge: full width at the windscreen, narrower at the nose, flush with the front face. */
function hoodGeometry() {
  const zFront = NOSE_Z + 0.03;
  return hex(
    Array.from({ length: 8 }, (_, k) => {
      const top = (k & 2) !== 0;
      const front = (k & 4) !== 0;
      const hw = top && front ? HW - HOOD_TAPER : HW;
      const y = !top ? HOOD_BASE : front ? HOOD_FRONT_Y : HOOD_BACK_Y;
      return vec((k & 1 ? 1 : -1) * hw, y, front ? zFront : HOOD_Z0);
    }),
  );
}

/** Flare profile around the axle: flat top, chamfered shoulders, ends just above the axle. */
const FLARE: [number, number][] = [
  [0.8, 0.1],
  [0.78, 0.5],
  [0.44, 0.93],
];
const FLARE_CHAMFER = Math.atan2(FLARE[2][1] - FLARE[1][1], FLARE[1][0] - FLARE[2][0]);

function flareGeometry() {
  const lip = Math.asin(FLARE[0][1] / ARCH_R);
  const s = new THREE.Shape();
  s.moveTo(...FLARE[0]);
  s.lineTo(...FLARE[1]);
  s.lineTo(...FLARE[2]);
  s.lineTo(-FLARE[2][0], FLARE[2][1]);
  s.lineTo(-FLARE[1][0], FLARE[1][1]);
  s.lineTo(-FLARE[0][0], FLARE[0][1]);
  s.absarc(0, 0, ARCH_R, Math.PI - lip, lip, true);
  s.closePath();
  return extrudeAcross(s, 0.36, 0.03, 12);
}

/** Round, fat tyre: bulged lathe sidewall, staggered tread blocks and shoulder lugs, axle along x. */
function tyreParts() {
  const R = WHEEL_R;
  const w = TYRE_HALF;
  const profile = [
    [RIM_R, -w + 0.05],
    [RIM_R + 0.05, -w],
    [R - 0.11, -w - 0.01],
    [R - 0.045, -w + 0.035],
    [R - 0.01, -w + 0.09],
    [R, -w + 0.13],
    [R, w - 0.13],
    [R - 0.01, w - 0.09],
    [R - 0.045, w - 0.035],
    [R - 0.11, w + 0.01],
    [RIM_R + 0.05, w],
    [RIM_R, w - 0.05],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(profile, 26);
  lathe.rotateZ(Math.PI / 2);
  const parts = [paint(lathe, C.tyre)];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 0.5) / n) * Math.PI * 2;
    for (const [x, ang] of [
      [0.075, a],
      [-0.075, b],
    ]) {
      const tread = new THREE.BoxGeometry(0.125, 0.045, 0.12);
      tread.translate(x, R + 0.01, 0);
      tread.rotateX(ang);
      parts.push(paint(tread, C.lug));
    }
    for (const [x, ang] of [
      [w - 0.05, b],
      [-(w - 0.05), a],
    ]) {
      const lug = new THREE.BoxGeometry(0.09, 0.065, 0.11);
      lug.rotateZ(Math.sign(x) * -0.5);
      lug.translate(x, R - 0.035, 0);
      lug.rotateX(ang);
      parts.push(paint(lug, C.lug));
    }
  }
  return parts;
}

/** Red disc rim with eight dark holes, square lip and dark centre, facing +x. */
function rimParts() {
  const w = TYRE_HALF;
  const lip = new THREE.TorusGeometry(RIM_R - 0.022, 0.032, 4, 20);
  lip.rotateY(Math.PI / 2);
  lip.translate(w - 0.045, 0, 0);
  const parts = [
    paint(disc(RIM_R, 0.04, w - 0.13, 20), C.deep),
    paint(lip, C.rim),
    paint(disc(RIM_R - 0.03, 0.04, w - 0.085, 20), C.rim),
    paint(disc(0.1, 0.05, w - 0.06, 8), C.deep),
    paint(disc(0.04, 0.03, w - 0.03, 6), C.rim),
  ];
  for (let i = 0; i < 8; i++) {
    const hole = new THREE.BoxGeometry(0.02, 0.055, 0.055);
    hole.translate(w - 0.062, 0.19, 0);
    hole.rotateX((i / 8) * Math.PI * 2);
    parts.push(paint(hole, C.deep));
  }
  return parts;
}

function wheelGeometry() {
  const parts = [...tyreParts(), ...rimParts()];
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

function buildBody() {
  const k = createKit();

  // ---- lifted chassis: ladder frame, floor, beam axles, diffs, arms, coilovers
  k.add("trim", C.deep, box([BODY_W - 0.2, 0.08, 4.6], [0, SILL - 0.02, -0.12]));
  for (const s of SIDES) k.add("trim", C.deep, box([0.14, 0.16, 4.8], [s * 0.5, 0.8, -0.1]));
  for (const z of [2.0, 0.6, -0.8, -2.3]) k.add("trim", C.deep, box([0.9, 0.1, 0.12], [0, 0.8, z]));
  for (const z of [WHEEL_Z, -WHEEL_Z]) {
    k.add("trim", C.steel, tube([-0.94, WHEEL_R, z], [0.94, WHEEL_R, z], 0.06));
    const diff = new THREE.IcosahedronGeometry(0.15, 0);
    diff.translate(0.14, WHEEL_R, z);
    k.add("trim", C.steel, diff);
    const toFrame = z > 0 ? -0.7 : 0.7;
    for (const s of SIDES) {
      k.add("trim", C.deep, tube([s * 0.56, WHEEL_R - 0.04, z], [s * 0.5, 0.78, z + toFrame], 0.035));
      // coilover: dark shock body inside a red spring
      const zc = z - Math.sign(z) * 0.24;
      k.add("trim", C.deep, tube([s * 0.72, WHEEL_R + 0.02, zc], [s * 0.72, SILL - 0.04, zc], 0.033));
      for (let i = 0; i < 4; i++) {
        const coil = new THREE.TorusGeometry(0.07, 0.017, 4, 10);
        coil.rotateX(Math.PI / 2);
        coil.translate(s * 0.72, WHEEL_R + 0.09 + i * 0.07, zc);
        k.add("paint", C.red, coil);
      }
    }
  }
  k.add("trim", C.black, box([0.7, 0.2, 0.8], [-0.15, 0.78, -0.4]));
  k.add("trim", C.steel, tube([0.32, 0.72, 0.9], [0.32, 0.72, -2.55], 0.045));

  // ---- shell: lower body, red cabin, black rear quarter
  k.add("paint", C.red, bodyGeometry(), hoodGeometry());
  k.add(
    "paint",
    C.red,
    frustum({ y: CAB.yB, hw: CAB.hwB, zf: CAB.zFB, zb: QUARTER_Z }, { y: CAB.yT, hw: CAB.hwT, zf: CAB.zFT, zb: QUARTER_Z }),
  );
  k.add(
    "trim",
    C.black,
    frustum({ y: CAB.yB, hw: CAB.hwB, zf: QUARTER_Z, zb: CAB.zBB }, { y: CAB.yT, hw: CAB.hwT, zf: QUARTER_Z, zb: CAB.zBT }),
  );

  // ---- glass with black surrounds
  const glass = (q: THREE.Vector3[], qFrame: THREE.Vector3[], n: THREE.Vector3) => {
    k.add("trim", C.deep, panel(qFrame, n, 0, 0.014));
    k.add("glass", C.deep, panel(q, n, 0.006, 0.016));
  };
  const vHood = cab.vAt(HOOD_BACK_Y + 0.03);
  glass(endQuad("front", 0.82, vHood, 0.93), endQuad("front", 0.82, vHood, 0.93, 0.04), cab.frontN);
  glass(endQuad("rear", 0.66, 0.3, 0.86), endQuad("rear", 0.66, 0.3, 0.86, 0.04), cab.rearN);
  // Windows run 1.72-2.13 m, leaving a thick red band under the roof.
  const [vW0, vW1] = [cab.vAt(1.72), cab.vAt(2.13)];
  const windows: [(v: number) => number, (v: number) => number][] = [
    [(v) => lerp(0.7, 0.6, (v - vW0) / (vW1 - vW0)), () => -0.15],
    [() => -0.4, () => -1.16],
    [() => -1.6, (v) => cab.zR(v) + 0.38],
  ];
  for (const s of SIDES)
    for (const [zf, zb] of windows) glass(sideQuad(s, zf, zb, vW0, vW1), sideQuad(s, zf, zb, vW0, vW1, 0.035), cab.sideN(s));

  // cowl and wipers at the base of the windscreen
  k.add("trim", C.black, box([CAB.hwB * 2 - 0.06, 0.05, 0.1], [0, HOOD_BACK_Y + 0.02, HOOD_Z0 + 0.07]));
  for (const x of [-0.34, 0.3]) k.add("trim", C.deep, box([0.52, 0.02, 0.03], [x, HOOD_BACK_Y + 0.05, HOOD_Z0 + 0.11], [0, 0, 0.1]));

  // ---- roof: red panel with black rear section, sunroof, rack, light bar
  const roofRing = (y: number, g: number): Ring => ({ y, hw: CAB.hwT + g, zf: CAB.zFT + g, zb: CAB.zBT - g });
  k.add("paint", C.red, frustum(roofRing(CAB.yT - 0.02, 0.04), roofRing(ROOF_Y, 0.02)));
  k.add("trim", C.black, box([CAB.hwT * 2 + 0.06, 0.08, 0.84], [0, ROOF_Y - 0.035, -1.88]));
  k.add("trim", C.deep, box([0.82, 0.03, 1.2], [0, ROOF_Y + 0.012, -0.5]));
  k.add("glass", C.deep, box([0.7, 0.02, 1.08], [0, ROOF_Y + 0.028, -0.5]));
  const rackX = CAB.hwT - 0.04;
  // rack stands on posts, clear of the roof
  const rackY = ROOF_Y + 0.11;
  for (const s of SIDES) {
    k.add("trim", C.black, box([0.12, 0.1, 2.7], [s * rackX, rackY, -0.92]));
    for (const z of [0.3, -0.6, -1.5, -2.2]) k.add("trim", C.black, box([0.08, 0.12, 0.08], [s * rackX, ROOF_Y + 0.04, z]));
    for (let i = 0; i < 7; i++) k.add("trim", C.deep, box([0.14, 0.04, 0.2], [s * rackX, rackY + 0.065, 0.12 - i * 0.36]));
  }
  k.add("trim", C.black, box([rackX * 2, 0.08, 0.12], [0, rackY, -2.22]));
  for (let i = 0; i < 6; i++) k.add("trim", C.deep, box([0.13, 0.04, 0.14], [-0.55 + i * 0.22, rackY + 0.055, -2.22]));
  k.add("trim", C.black, box([rackX * 2 + 0.1, 0.16, 0.18], [0, rackY + 0.04, 0.44]));
  for (const x of [-0.48, -0.16, 0.16, 0.48]) {
    k.add("glow", C.amber, box([0.2, 0.09, 0.03], [x, rackY + 0.04, 0.54]));
    k.add("glow", C.amberCore, box([0.1, 0.04, 0.01], [x, rackY + 0.04, 0.557]));
  }
  for (const x of [-0.32, 0, 0.32]) k.add("glow", C.fog, box([0.06, 0.06, 0.03], [x, rackY + 0.04, 0.54]));
  k.add("brake", C.red, box([0.5, 0.045, 0.03], [0, CAB.yT - 0.06, cab.zR(0.92) - 0.02]));

  // ---- sides: mirrors, seams, handles, thick rockers
  for (const s of SIDES) {
    k.add("trim", C.black, box([0.2, 0.06, 0.08], [s * (HW - 0.07), 1.68, 0.8]));
    k.add("trim", C.black, box([0.28, 0.24, 0.26], [s * (HW + 0.12), 1.76, 0.8]));
    k.add("trim", C.deep, box([0.24, 0.18, 0.012], [s * (HW + 0.12), 1.76, 0.67]));
    for (const z of [1.03, -0.25]) k.add("trim", C.deep, box([0.012, 0.66, 0.02], [s * (HW + 0.006), 1.3, z]));
    k.add("trim", C.deep, box([0.012, 0.16, 0.02], [s * (HW + 0.006), 1.55, -1.45]));
    k.add("trim", C.deep, panel(sideQuad(s, () => -0.24, () => -0.26, 0, 1), cab.sideN(s), 0, 0.01));
    for (const z of [0.02, -0.9]) k.add("trim", C.black, box([0.045, 0.06, 0.22], [s * (HW + 0.012), 1.48, z]));
    k.add("trim", C.black, box([0.16, 0.37, 1.84], [s * (HW - 0.02), 0.765, 0]));
    k.add("trim", C.deep, box([0.02, 0.06, 1.36], [s * (HW + 0.06), 0.65, 0]));
  }

  // ---- flares with markers on the chamfered shoulders
  for (const z of [WHEEL_Z, -WHEEL_Z])
    for (const s of SIDES) {
      const f = flareGeometry();
      f.translate(s * (HW + 0.11), WHEEL_R, z);
      k.add("trim", C.black, f);
    }
  const cz = (FLARE[1][0] + FLARE[2][0]) / 2 + Math.sin(FLARE_CHAMFER) * 0.04;
  const cy = WHEEL_R + (FLARE[1][1] + FLARE[2][1]) / 2 + Math.cos(FLARE_CHAMFER) * 0.04;
  for (const s of SIDES) {
    k.add("glow", C.amber, box([0.12, 0.08, 0.015], [s * (HW + 0.12), cy, WHEEL_Z + cz], [-(Math.PI / 2 - FLARE_CHAMFER), 0, 0]));
    k.add("brake", C.red, box([0.12, 0.08, 0.015], [s * (HW + 0.12), cy, -WHEEL_Z - cz], [Math.PI / 2 - FLARE_CHAMFER, 0, 0]));
  }

  // ---- hood: black scoop and lip vent
  const scoopZ = (HOOD_Z0 + NOSE_Z) / 2 + 0.02;
  k.add("trim", C.black, box([0.57, 0.1, 0.7], [0, hoodY(scoopZ) + 0.04, scoopZ], [HOOD_TILT, 0, 0]));
  k.add("trim", C.deep, box([0.46, 0.04, 0.02], [0, hoodY(1.95) + 0.05, 1.95]));

  // ---- nose: slatted grille, round headlamps, lip vent
  const NOSE = NOSE_Z + 0.05;
  k.add("trim", C.deep, box([0.92, 0.32, 0.04], [0, 1.36, NOSE]));
  for (let i = 0; i < 6; i++) k.add("paint", C.red, box([0.055, 0.26, 0.03], [-0.325 + i * 0.13, 1.36, NOSE + 0.025]));
  k.add("trim", C.deep, box([0.5, 0.05, 0.03], [0, 1.64, NOSE]));
  for (const s of SIDES) {
    const x = s * (HW - 0.32);
    k.add("trim", C.black, discZ(0.19, 0.05, x, 1.42, NOSE, 18));
    k.add("glow", C.amber, discZ(0.145, 0.03, x, 1.42, NOSE + 0.03, 18));
    k.add("glow", C.amberCore, discZ(0.07, 0.01, x, 1.42, NOSE + 0.047, 12));
  }

  // ---- front bumper: wraps into the flares, fogs, glow strip, plate, tow hooks, skid plate
  const BUMP = 2.4;
  k.add("trim", C.black, box([BODY_W - 0.08, 0.45, 0.34], [0, 0.95, BUMP]));
  for (const s of SIDES) {
    k.add("trim", C.black, box([0.26, 0.38, 0.3], [s * (HW + 0.02), 0.97, BUMP - 0.02]));
    k.add("trim", C.deep, box([0.24, 0.22, 0.03], [s * (HW - 0.28), 0.92, BUMP + 0.17]));
    k.add("glow", C.fog, box([0.18, 0.17, 0.03], [s * (HW - 0.28), 0.92, BUMP + 0.18]));
    k.add("paint", C.red, box([0.07, 0.12, 0.12], [s * 0.36, 0.7, BUMP + 0.12]));
  }
  k.add("glow", C.ember, box([0.8, 0.03, 0.012], [0, 1.13, BUMP + 0.176]));
  k.add("trim", C.plate, box([0.5, 0.15, 0.03], [0, 0.9, BUMP + 0.175]));
  k.add("trim", C.steel, box([1.3, 0.05, 0.46], [0, 0.66, 2.24], [-0.4, 0, 0]));

  // ---- rear: bracket tail lamps wrapping the corners, bumper, reflectors
  const TAIL = TAIL_Z - 0.05;
  k.add("trim", C.black, box([BODY_W - 0.08, 0.34, 0.2], [0, 0.82, TAIL_Z - 0.06]));
  for (const s of SIDES) {
    k.add("trim", C.deep, box([0.22, 0.5, 0.02], [s * (HW - 0.16), 1.36, TAIL + 0.01]));
    k.add(
      "brake",
      C.red,
      box([0.07, 0.44, 0.04], [s * (HW - 0.09), 1.36, TAIL]),
      box([0.13, 0.06, 0.04], [s * (HW - 0.155), 1.55, TAIL]),
      box([0.13, 0.06, 0.04], [s * (HW - 0.155), 1.17, TAIL]),
      box([0.012, 0.36, 0.08], [s * (HW + 0.006), 1.36, TAIL_Z + 0.04]),
      box([0.14, 0.07, 0.02], [s * (HW - 0.26), 0.84, TAIL_Z - 0.17]),
    );
    k.add("trim", C.black, box([0.26, 0.38, 0.24], [s * (HW + 0.02), 0.86, TAIL_Z - 0.04]));
  }

  // ---- tailgate spare with a black cover and glowing mountain badge
  const SPARE_Y = 1.27;
  const SPARE_Z = TAIL_Z - 0.3;
  const spare = new THREE.Matrix4()
    .makeTranslation(0, SPARE_Y, SPARE_Z)
    .multiply(new THREE.Matrix4().makeScale(0.89, 0.89, 0.6))
    .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  k.addPainted("trim", ...tyreParts().map((g) => g.applyMatrix4(spare)));
  k.add("trim", C.deep, box([0.26, 0.26, 0.16], [0, SPARE_Y, TAIL_Z - 0.08]));
  const cover = new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20);
  cover.rotateX(Math.PI / 2);
  cover.translate(0, SPARE_Y, SPARE_Z - 0.17);
  k.add("trim", C.black, cover);
  const badge: [number, number][][] = [
    [[-0.22, -0.09], [-0.09, 0.05]],
    [[-0.09, 0.05], [-0.03, -0.02]],
    [[-0.06, -0.09], [0.06, 0.11]],
    [[0.06, 0.11], [0.22, -0.09]],
  ];
  for (const [a, b] of badge) k.add("glow", C.ember, bar2d([a[0], a[1] + SPARE_Y], [b[0], b[1] + SPARE_Y], SPARE_Z - 0.2));

  return k.build();
}

function useCarAssets() {
  const assets = useMemo(() => {
    const vc = { vertexColors: true, flatShading: true };
    return {
      geo: { ...buildBody(), wheel: wheelGeometry() },
      mat: {
        paint: new THREE.MeshStandardMaterial({ ...vc, roughness: 0.42, metalness: 0.12 }),
        trim: new THREE.MeshStandardMaterial({ ...vc, roughness: 0.82 }),
        glass: new THREE.MeshStandardMaterial({
          color: "#1a1224",
          flatShading: true,
          roughness: 0.22,
          metalness: 0.3,
          emissive: "#2d1850",
          emissiveIntensity: 0.45,
        }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      },
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(assets.geo).forEach((g) => g.dispose());
      Object.values(assets.mat).forEach((m) => m.dispose());
    },
    [assets],
  );
  return assets;
}

function Wheel({
  geometry,
  material,
  x,
  z,
  mountRef,
  spinRef,
  steerRef,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  x: number;
  z: number;
  mountRef: (m: THREE.Group | null) => void;
  spinRef: (m: THREE.Group | null) => void;
  steerRef?: (m: THREE.Group | null) => void;
}) {
  return (
    // The mount slides up and down with the suspension.
    <group position={[x, WHEEL_R, z]} ref={mountRef}>
      <group ref={steerRef}>
        <group ref={spinRef}>
          {/* Rim faces +x; mirror it for the left side. */}
          <mesh geometry={geometry} material={material} scale={[x > 0 ? 1 : -1, 1, 1]} castShadow />
        </group>
      </group>
    </group>
  );
}

export function CarModel({
  bodyRef,
  wheelMount,
  wheelSpin,
  wheelSteer,
  brakeMat,
}: {
  bodyRef: React.RefObject<THREE.Group | null>;
  /** Front-left, front-right, rear-left, rear-right. */
  wheelMount: React.RefObject<(THREE.Group | null)[]>;
  wheelSpin: React.RefObject<(THREE.Group | null)[]>;
  wheelSteer: React.RefObject<(THREE.Group | null)[]>;
  brakeMat: React.RefObject<(THREE.MeshStandardMaterial | null)[]>;
}) {
  const { geo, mat } = useCarAssets();
  const setMount = (i: number) => (m: THREE.Group | null) => {
    wheelMount.current[i] = m;
  };
  const setSpin = (i: number) => (m: THREE.Group | null) => {
    wheelSpin.current[i] = m;
  };
  const setSteer = (i: number) => (m: THREE.Group | null) => {
    wheelSteer.current[i] = m;
  };
  const setBrake = (i: number) => (m: THREE.MeshStandardMaterial | null) => {
    brakeMat.current[i] = m;
  };

  const wheel = { geometry: geo.wheel, material: mat.trim };
  return (
    <group>
      <Wheel {...wheel} x={WHEEL_X} z={WHEEL_Z} mountRef={setMount(0)} spinRef={setSpin(0)} steerRef={setSteer(0)} />
      <Wheel {...wheel} x={-WHEEL_X} z={WHEEL_Z} mountRef={setMount(1)} spinRef={setSpin(1)} steerRef={setSteer(1)} />
      <Wheel {...wheel} x={WHEEL_X} z={-WHEEL_Z} mountRef={setMount(2)} spinRef={setSpin(2)} />
      <Wheel {...wheel} x={-WHEEL_X} z={-WHEEL_Z} mountRef={setMount(3)} spinRef={setSpin(3)} />

      <group ref={bodyRef}>
        <mesh geometry={geo.paint} material={mat.paint} castShadow />
        <mesh geometry={geo.trim} material={mat.trim} castShadow />
        <mesh geometry={geo.glass} material={mat.glass} />
        <mesh geometry={geo.glow} material={mat.glow} />
        {/* Every red lamp shares one material, so braking is a single uniform change. */}
        <mesh geometry={geo.brake}>
          <meshStandardMaterial ref={setBrake(0)} color="#ff3b3b" emissive="#ff1a2a" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
