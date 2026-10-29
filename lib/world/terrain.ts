import {
  beachFactor,
  HILLS,
  islandRadius,
  LAKE_CENTER,
  LAKE_LEVEL,
  lakeRadius,
  LAND_BASE,
  PADS,
  ROADS,
  SEA_LEVEL,
  STREAM_POINTS,
  WORLD_HALF,
  type RoadDef,
} from "./layout";
import { clamp, fbm, lerp, smoothstep } from "./noise";

/**
 * Bakes the island into a heightfield once. The terrain mesh, the car, the
 * scatter and the water shader all read the same grid, so what you see is
 * exactly what you drive on.
 */

export const GRID = 257; // vertices per side
const CELL = (WORLD_HALF * 2) / (GRID - 1);

export interface RoadSample {
  x: number;
  z: number;
  y: number;
  /** Unit tangent. */
  tx: number;
  tz: number;
  s: number;
  bridge: boolean;
}

export interface Road {
  def: RoadDef;
  samples: RoadSample[];
  length: number;
}

export interface StreamSample {
  x: number;
  z: number;
  /** Water surface height. */
  y: number;
  tx: number;
  tz: number;
}

export interface World {
  heights: Float32Array;
  /** Signed distance to the nearest road edge (negative = on a road). */
  roadEdge: Float32Array;
  roads: Road[];
  stream: StreamSample[];
  /** Index in `stream` where the water leaves the cliff. */
  fallIndex: number;
  /** Height of the drawn water surface over each cell: the sea, or the lake and stream where they are. */
  water: Float32Array;
  bridge: { samples: RoadSample[]; halfWidth: number; minX: number; maxX: number; minZ: number; maxZ: number } | null;
}

// ------------------------------------------------------------------ splines

/** Uniform Catmull-Rom through the control points, resampled by arc length. */
export function sampleSpline(points: [number, number][], closed: boolean, spacing = 1) {
  const n = points.length;
  const get = (i: number) =>
    closed ? points[((i % n) + n) % n] : points[clamp(i, 0, n - 1)];
  const dense: [number, number][] = [];
  const segs = closed ? n : n - 1;
  const steps = 24;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (closed) dense.push([...dense[0]]);
  else dense.push([...points[n - 1]]);

  const out: { x: number; z: number; tx: number; tz: number; s: number }[] = [];
  let acc = 0;
  let next = 0;
  for (let i = 0; i < dense.length - 1; i++) {
    const [ax, az] = dense[i];
    const [bx, bz] = dense[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    while (next <= acc + len) {
      const u = (next - acc) / len;
      out.push({ x: ax + (bx - ax) * u, z: az + (bz - az) * u, tx, tz, s: next });
      next += spacing;
    }
    acc += len;
  }
  // Smooth tangents a little so ribbons don't kink at dense-polyline joints.
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 2)];
    const b = out[Math.min(out.length - 1, i + 2)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    out[i].tx = dx / l;
    out[i].tz = dz / l;
  }
  return { samples: out, length: acc };
}

// ------------------------------------------------------------------ base height

export function coastT(x: number, z: number) {
  const theta = Math.atan2(z, x);
  return { t: Math.hypot(x, z) / islandRadius(theta), b: beachFactor(theta) };
}

function baseHeight(x: number, z: number) {
  const { t, b } = coastT(x, z);
  let land = LAND_BASE + fbm(x * 0.018, z * 0.018, 3, 3) * 2.0 + fbm(x * 0.07, z * 0.07, 2, 5) * 0.3;
  for (const [hx, hz, hh, hr] of HILLS) {
    const d2 = (x - hx) ** 2 + (z - hz) ** 2;
    land += hh * Math.exp(-d2 / (hr * hr));
  }
  const cs = lerp(0.93, 0.8, b);
  const cliff = smoothstep(cs, cs + 0.055, t);
  const ledge = smoothstep(cs + 0.02, cs + 0.035, t) * (1 - smoothstep(cs + 0.04, cs + 0.07, t));
  const face = fbm(x * 0.12, z * 0.12, 2, 11) * 1.6 * cliff * (1 - cliff) * 4;
  const cliffH = lerp(land, -9, cliff) + face + ledge * 1.2;
  const beachH = lerp(land, -3, smoothstep(cs, 1.05, t));
  let h = lerp(cliffH, beachH, b);
  h = Math.min(h, lerp(h, -16, smoothstep(1.08, 1.6, t)));
  return h;
}

// ------------------------------------------------------------------ bake

let cached: World | null = null;

export function getWorld(): World {
  if (!cached) cached = bake();
  return cached;
}

const idx = (i: number, j: number) => j * GRID + i;
const toGrid = (v: number) => (v + WORLD_HALF) / CELL;
const fromGrid = (i: number) => i * CELL - WORLD_HALF;

function sampleGrid(arr: Float32Array, x: number, z: number) {
  const gx = clamp(toGrid(x), 0, GRID - 1.001);
  const gz = clamp(toGrid(z), 0, GRID - 1.001);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const a = arr[idx(i, j)];
  const b = arr[idx(i + 1, j)];
  const c = arr[idx(i, j + 1)];
  const d = arr[idx(i + 1, j + 1)];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Visit grid cells within `radius` of (x, z). */
function forCells(x: number, z: number, radius: number, fn: (k: number, d: number) => void) {
  const i0 = Math.max(0, Math.floor(toGrid(x - radius)));
  const i1 = Math.min(GRID - 1, Math.ceil(toGrid(x + radius)));
  const j0 = Math.max(0, Math.floor(toGrid(z - radius)));
  const j1 = Math.min(GRID - 1, Math.ceil(toGrid(z + radius)));
  for (let j = j0; j <= j1; j++) {
    const cz = fromGrid(j);
    for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(fromGrid(i) - x, cz - z);
      if (d <= radius) fn(idx(i, j), d);
    }
  }
}

function smoothArray(v: number[], window: number, passes: number, closed: boolean, pinStart: boolean) {
  const n = v.length;
  let cur = v.slice();
  for (let p = 0; p < passes; p++) {
    const nxt = cur.slice();
    for (let i = 0; i < n; i++) {
      if (pinStart && i === 0) continue;
      let sum = 0;
      let cnt = 0;
      for (let k = -window; k <= window; k++) {
        let j = i + k;
        if (closed) j = ((j % n) + n) % n;
        else if (j < 0 || j >= n) continue;
        sum += cur[j];
        cnt++;
      }
      nxt[i] = sum / cnt;
    }
    cur = nxt;
  }
  return cur;
}

function bake(): World {
  const heights = new Float32Array(GRID * GRID);
  const roadEdge = new Float32Array(GRID * GRID).fill(50);

  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) heights[idx(i, j)] = baseHeight(fromGrid(i), fromGrid(j));

  // Flat pads for buildings.
  for (const p of PADS) {
    const target = sampleGrid(heights, p.x, p.z);
    forCells(p.x, p.z, p.r + p.blend, (k, d) => {
      const w = 1 - smoothstep(p.r, p.r + p.blend, d);
      heights[k] = lerp(heights[k], target, w);
    });
  }

  // Roads: main loop first so spurs inherit its height at the junction.
  const roads: Road[] = [];
  const loopDef = ROADS.find((r) => r.id === "loop")!;
  const ordered = [loopDef, ...ROADS.filter((r) => r !== loopDef)];
  for (const def of ordered) {
    let pts = def.points;
    if (def.snapStart && roads[0]) {
      const [sx, sz] = pts[0];
      let best = roads[0].samples[0];
      let bd = Infinity;
      for (const s of roads[0].samples) {
        const d = (s.x - sx) ** 2 + (s.z - sz) ** 2;
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      pts = [[best.x, best.z], ...pts.slice(1)];
    }
    const { samples, length } = sampleSpline(pts, def.closed, 1);
    const raw = samples.map((s) => Math.max(sampleGrid(heights, s.x, s.z), LAKE_LEVEL + 1.0));
    const smooth = smoothArray(raw, 6, 4, def.closed, !!def.snapStart);
    // Ease spurs out of the junction so the loop keeps its height there.
    if (def.snapStart) for (let i = 1; i < smooth.length; i++) smooth[i] = lerp(smooth[0], smooth[i], smoothstep(0, 12, i));
    const half = def.width / 2;
    const blend = def.kind === "dirt" ? 3 : 6;

    const bestD = new Float32Array(GRID * GRID).fill(Infinity);
    const bestT = new Float32Array(GRID * GRID);
    samples.forEach((s, n) => {
      forCells(s.x, s.z, half + blend, (k, d) => {
        if (d < bestD[k]) {
          bestD[k] = d;
          bestT[k] = smooth[n];
        }
      });
    });
    for (let k = 0; k < bestD.length; k++) {
      const d = bestD[k];
      if (d === Infinity) continue;
      const w = 1 - smoothstep(half + 0.6, half + blend, d);
      heights[k] = lerp(heights[k], bestT[k], w);
      roadEdge[k] = Math.min(roadEdge[k], d - half);
    }
    roads.push({
      def,
      length,
      samples: samples.map((s, n) => ({ ...s, y: smooth[n], bridge: false })),
    });
  }

  // Lake basin.
  const [lx, lz] = LAKE_CENTER;
  const shoreH = LAKE_LEVEL - 0.35;
  forCells(lx, lz, 45, (k) => {
    const i = k % GRID;
    const j = Math.floor(k / GRID);
    const dx = fromGrid(i) - lx;
    const dz = fromGrid(j) - lz;
    const s = Math.hypot(dx, dz) / lakeRadius(Math.atan2(dz, dx));
    if (s >= 1.4) return;
    const target = s < 1 ? lerp(-1.4, shoreH, s * s) : lerp(shoreH, heights[k], smoothstep(1, 1.4, s));
    heights[k] = Math.min(heights[k], target);
  });

  // Stream channel from the lake to the cliff.
  const streamSpline = sampleSpline(STREAM_POINTS, false, 1).samples;
  let fallIndex = streamSpline.length - 1;
  for (let n = 0; n < streamSpline.length; n++) {
    const { t, b } = coastT(streamSpline[n].x, streamSpline[n].z);
    if (t >= lerp(0.93, 0.8, b) + 0.005) {
      fallIndex = n;
      break;
    }
  }
  const stream: StreamSample[] = streamSpline.map((s, n) => ({
    x: s.x,
    z: s.z,
    tx: s.tx,
    tz: s.tz,
    y: lerp(LAKE_LEVEL - 0.12, 0.9, Math.min(1, n / fallIndex)),
  }));
  {
    const bestD = new Float32Array(GRID * GRID).fill(Infinity);
    const bestY = new Float32Array(GRID * GRID);
    for (let n = 0; n <= Math.min(fallIndex + 3, stream.length - 1); n++) {
      const s = stream[n];
      forCells(s.x, s.z, 6, (k, d) => {
        if (d < bestD[k]) {
          bestD[k] = d;
          bestY[k] = s.y;
        }
      });
    }
    for (let k = 0; k < bestD.length; k++) {
      if (bestD[k] === Infinity) continue;
      const bottom = bestY[k] - 0.9;
      const target = lerp(bottom, heights[k], smoothstep(1.8, 5.5, bestD[k]));
      heights[k] = Math.min(heights[k], target);
    }
  }

  // Water the car stops at, matching the meshes in Water.tsx: the lake disc reaches 1.12 radii, the stream ribbon 3.25 m each side.
  const water = new Float32Array(GRID * GRID).fill(SEA_LEVEL);
  forCells(lx, lz, 45, (k) => {
    const dx = fromGrid(k % GRID) - lx;
    const dz = fromGrid(Math.floor(k / GRID)) - lz;
    if (Math.hypot(dx, dz) < lakeRadius(Math.atan2(dz, dx)) * 1.12) water[k] = LAKE_LEVEL;
  });
  for (let n = 0; n <= fallIndex; n++) {
    const s = stream[n];
    forCells(s.x, s.z, 3.25 + CELL / 2, (k) => {
      water[k] = Math.max(water[k], s.y);
    });
  }

  // Bridge where the loop crosses the stream.
  let bridge: World["bridge"] = null;
  const loop = roads[0];
  const near: number[] = [];
  loop.samples.forEach((s, n) => {
    let dmin = Infinity;
    for (let m = 0; m <= fallIndex; m++) dmin = Math.min(dmin, Math.hypot(stream[m].x - s.x, stream[m].z - s.z));
    if (dmin < 10.5) near.push(n);
  });
  if (near.length) {
    const bs = near.map((n) => loop.samples[n]);
    // Deck follows the smoothed road profile with a gentle arch.
    bs.forEach((s, k) => {
      s.bridge = true;
      s.y += 0.35 * Math.sin((Math.PI * (k + 0.5)) / bs.length);
    });
    bridge = {
      samples: bs,
      halfWidth: loop.def.width / 2,
      minX: Math.min(...bs.map((s) => s.x)) - 6,
      maxX: Math.max(...bs.map((s) => s.x)) + 6,
      minZ: Math.min(...bs.map((s) => s.z)) - 6,
      maxZ: Math.max(...bs.map((s) => s.z)) + 6,
    };
  }

  // Non-bridge road samples sit on the final terrain.
  for (const r of roads) for (const s of r.samples) if (!s.bridge) s.y = sampleGrid(heights, s.x, s.z);

  return { heights, roadEdge, roads, stream, fallIndex, water, bridge };
}

// ------------------------------------------------------------------ queries

export function heightAt(x: number, z: number) {
  return sampleGrid(getWorld().heights, x, z);
}

export function roadEdgeAt(x: number, z: number) {
  return sampleGrid(getWorld().roadEdge, x, z);
}

/** A raised drivable shape on top of the terrain (course rocks, logs, jumps, a garage floor), inside a bounding box. */
interface SurfaceOverlay {
  fn: (x: number, z: number) => number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const overlays: SurfaceOverlay[] = [];

export function addSurfaceOverlay(o: SurfaceOverlay) {
  overlays.push(o);
}

/** Drivable surface: terrain, the bridge deck where there is one, or a raised overlay. */
export function surfaceAt(x: number, z: number) {
  const w = getWorld();
  let h = sampleGrid(w.heights, x, z);
  for (const o of overlays) if (x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ) h = Math.max(h, o.fn(x, z));
  const b = w.bridge;
  if (b && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) {
    let best: RoadSample | null = null;
    let bd = Infinity;
    for (const s of b.samples) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) {
      const lateral = Math.abs((x - best.x) * best.tz - (z - best.z) * best.tx);
      const along = Math.abs((x - best.x) * best.tx + (z - best.z) * best.tz);
      if (lateral < b.halfWidth + 0.3 && along < 1.2) return Math.max(h, best.y);
    }
  }
  return h;
}

/** Height of the water surface: the sea, or the lake and stream where they are. */
export function waterAt(x: number, z: number) {
  return sampleGrid(getWorld().water, x, z);
}

export function nearestRoadSample(x: number, z: number, includeHidden = false) {
  let best: { road: Road; sample: RoadSample } | null = null;
  let bd = Infinity;
  for (const road of getWorld().roads) {
    if (road.def.hidden && !includeHidden) continue;
    for (const s of road.samples) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = { road, sample: s };
      }
    }
  }
  return best!;
}

export const GRID_CELL = CELL;
