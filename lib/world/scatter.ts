import { addCircle } from "./colliders";
import { CABIN, exclusionZones, GROVE, LIGHTHOUSE } from "./structures";
import { LAKE_CENTER, LAKE_LEVEL, lakeRadius, PADS, STREAM_POINTS } from "./layout";
import { coastT, getWorld, heightAt, roadEdgeAt, surfaceAt } from "./terrain";
import { fbm, mulberry32 } from "./noise";

/** Deterministic placement of everything instanced. Seeded, so the island never reshuffles. */

export interface Instance {
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
  /** 0..1 used for colour variation. */
  tint: number;
}

export interface Scatter {
  pines: Instance[];
  roundTrees: Instance[];
  blossoms: Instance[];
  bushes: Instance[];
  rocks: Instance[];
  cliffRocks: Instance[];
  grass: Instance[];
  /** Dense tufts clustered into clumps, drawn after the even carpet. */
  grassClumps: Instance[];
  flowers: Instance[];
  mushrooms: Instance[];
  /** Fallen leaves lying flat, on verges and under the broadleaf trees. */
  leaves: Instance[];
  pebbles: Instance[];
}

let cached: Scatter | null = null;

function slopeAt(x: number, z: number) {
  const e = 1.2;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

function lakeS(x: number, z: number) {
  const dx = x - LAKE_CENTER[0];
  const dz = z - LAKE_CENTER[1];
  return Math.hypot(dx, dz) / lakeRadius(Math.atan2(dz, dx));
}

function streamDist(x: number, z: number) {
  const w = getWorld();
  let d = Infinity;
  for (let i = 0; i < w.stream.length; i += 2) d = Math.min(d, Math.hypot(w.stream[i].x - x, w.stream[i].z - z));
  // Cheap guard for the dense part of the stream near the cliff.
  for (const [sx, sz] of STREAM_POINTS) d = Math.min(d, Math.hypot(sx - x, sz - z) + 2);
  return d;
}

export function getScatter(): Scatter {
  if (cached) return cached;
  const rand = mulberry32(20260729);
  const zones = exclusionZones();
  const out: Scatter = {
    pines: [],
    roundTrees: [],
    blossoms: [],
    bushes: [],
    rocks: [],
    cliffRocks: [],
    grass: [],
    grassClumps: [],
    flowers: [],
    mushrooms: [],
    leaves: [],
    pebbles: [],
  };

  const blocked = (x: number, z: number, margin: number) =>
    zones.some(([zx, zz, r]) => (x - zx) ** 2 + (z - zz) ** 2 < (r + margin) ** 2) ||
    PADS.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + margin) ** 2);

  const landOk = (x: number, z: number, roadClear: number) => {
    const { t } = coastT(x, z);
    if (t > 0.9) return false;
    const h = heightAt(x, z);
    if (h < LAKE_LEVEL + 0.5) return false;
    if (roadEdgeAt(x, z) < roadClear) return false;
    if (lakeS(x, z) < 1.12) return false;
    return true;
  };

  // ---- trees on a jittered grid
  const step = 4.2;
  for (let gx = -150; gx < 150; gx += step) {
    for (let gz = -150; gz < 150; gz += step) {
      const x = gx + (rand() - 0.5) * step * 0.9;
      const z = gz + (rand() - 0.5) * step * 0.9;
      const r1 = rand();
      const r2 = rand();
      const r3 = rand();
      if (!landOk(x, z, 3.2)) continue;
      if (blocked(x, z, 2.5)) continue;
      if (streamDist(x, z) < 6) continue;
      if (slopeAt(x, z) > 0.55) continue;

      // Forest mask: denser in the north and west, open meadows in the south.
      const n = fbm(x * 0.022 + 4, z * 0.022 - 7, 3, 21);
      const northBias = Math.max(0, -z / 140) * 0.35 + Math.max(0, -x / 160) * 0.15;
      const forest = n + northBias;
      const nearHome = Math.hypot(x - CABIN.x, z - CABIN.z) < 34;
      const nearLake = lakeS(x, z) < 1.7;
      const nearGrove = Math.hypot(x - GROVE.x, z - GROVE.z) < 24;
      const nearLight = Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 26;

      const y = heightAt(x, z);
      const base = { x, y, z, rot: r2 * Math.PI * 2, tint: r3 };

      if ((nearHome || nearLake || nearGrove) && r1 < 0.32) {
        out.blossoms.push({ ...base, s: 0.85 + r3 * 0.5 });
        addCircle(x, z, 0.55);
      } else if (forest > 0.12 && !nearLight) {
        if (r1 < 0.78) {
          out.pines.push({ ...base, s: 0.75 + r3 * 0.75 });
          addCircle(x, z, 0.9 * (0.75 + r3 * 0.75));
        } else {
          out.roundTrees.push({ ...base, s: 0.8 + r3 * 0.6 });
          addCircle(x, z, 0.55);
        }
      } else if (forest > -0.12 && r1 < 0.16 && !nearLight) {
        if (r2 < 0.5) {
          out.roundTrees.push({ ...base, s: 0.8 + r3 * 0.6 });
          addCircle(x, z, 0.55);
        } else if (r2 < 0.65) {
          out.blossoms.push({ ...base, s: 0.8 + r3 * 0.5 });
          addCircle(x, z, 0.55);
        } else {
          out.pines.push({ ...base, s: 0.7 + r3 * 0.6 });
          addCircle(x, z, 0.9 * (0.7 + r3 * 0.6));
        }
      } else if (r1 < 0.12) {
        out.bushes.push({ ...base, s: 0.6 + r3 * 0.8 });
      }
    }
  }

  // ---- small stuff, rejection-sampled
  const sampleMany = (count: number, roadClear: number, fn: (x: number, z: number, r: () => number) => void) => {
    let tries = 0;
    let placed = 0;
    while (placed < count && tries < count * 6) {
      tries++;
      const x = (rand() - 0.5) * 290;
      const z = (rand() - 0.5) * 290;
      if (!landOk(x, z, roadClear)) continue;
      if (blocked(x, z, 0.5)) continue;
      fn(x, z, rand);
      placed++;
    }
  };

  sampleMany(9000, 0.6, (x, z, r) => {
    out.grass.push({ x, y: heightAt(x, z), z, s: 0.6 + r() * 0.8, rot: r() * Math.PI * 2, tint: r() });
  });
  sampleMany(1800, 1.2, (x, z, r) => {
    out.flowers.push({ x, y: heightAt(x, z), z, s: 0.7 + r() * 0.6, rot: r() * Math.PI * 2, tint: r() });
  });
  sampleMany(260, 2.5, (x, z, r) => {
    const s = 0.4 + r() * r() * 1.8;
    out.rocks.push({ x, y: heightAt(x, z) - 0.15 * s, z, s, rot: r() * Math.PI * 2, tint: r() });
    if (s > 0.9) addCircle(x, z, 0.7 * s);
  });
  // Mushrooms hide under the pines.
  for (const p of out.pines) {
    if (rand() < 0.12) {
      const a = rand() * Math.PI * 2;
      const d = 1.6 + rand() * 1.5;
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      out.mushrooms.push({ x, y: heightAt(x, z), z, s: 0.6 + rand() * 0.7, rot: rand() * 6.28, tint: rand() });
    }
  }

  // ---- chunky rocks along the cliff line
  for (let i = 0; i < 260; i++) {
    const theta = (i / 260) * Math.PI * 2 + (rand() - 0.5) * 0.02;
    const t = 0.94 + rand() * 0.09;
    const { b } = coastT(Math.cos(theta), Math.sin(theta));
    if (b > 0.45) continue; // keep the beach open
    // Coast parameter is linear in radius along a ray, so one division finds it.
    const r0 = (60 * t) / coastT(Math.cos(theta) * 60, Math.sin(theta) * 60).t;
    const x = Math.cos(theta) * r0;
    const z = Math.sin(theta) * r0;
    const s = 2.2 + rand() * 3.8;
    out.cliffRocks.push({ x, y: Math.max(heightAt(x, z), -6) - s * 0.3, z, s, rot: rand() * 6.28, tint: rand() });
  }

  scatterDetail(out, landOk, blocked);

  cached = out;
  return out;
}

/**
 * Ground clutter: grass clumps, fallen leaves and pebbles. Uses its own seed
 * so adding detail never reshuffles the trees and rocks placed above.
 */
function scatterDetail(
  out: Scatter,
  landOk: (x: number, z: number, roadClear: number) => boolean,
  blocked: (x: number, z: number, margin: number) => boolean,
) {
  const rand = mulberry32(20261029);
  const free = (x: number, z: number, roadClear: number) => landOk(x, z, roadClear) && !blocked(x, z, 0.3);

  // Clumps: a dense core of tall tufts that thins toward the rim.
  let centres = 0;
  for (let tries = 0; centres < 450 && tries < 8000; tries++) {
    const cx = (rand() - 0.5) * 290;
    const cz = (rand() - 0.5) * 290;
    if (!free(cx, cz, 1.4)) continue;
    centres++;
    const radius = 1.6 + rand() * 3.2;
    const n = Math.round(radius * radius * 2.2);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const f = Math.pow(rand(), 0.75);
      const x = cx + Math.cos(a) * f * radius;
      const z = cz + Math.sin(a) * f * radius;
      const s = (0.75 + rand() * 0.6) * (1.25 - f * 0.55);
      const rot = rand() * Math.PI * 2;
      const tint = rand();
      if (!free(x, z, 0.5)) continue;
      out.grassClumps.push({ x, y: heightAt(x, z), z, s, rot, tint });
    }
  }

  const leafAt = (x: number, z: number) => {
    // Skip the bridge deck and water; ride on top of the road surface.
    if (surfaceAt(x, z) - heightAt(x, z) > 0.2) return;
    if (!landOk(x, z, -20)) return;
    const onRoad = roadEdgeAt(x, z) < 0.4;
    out.leaves.push({ x, y: heightAt(x, z) + (onRoad ? 0.1 : 0.045), z, s: 1.4 + rand() * 1.2, rot: rand() * Math.PI * 2, tint: rand() });
  };

  // Under the broadleaf trees, falling off with distance from the trunk.
  for (const t of [...out.roundTrees, ...out.blossoms]) {
    const n = 10 + Math.floor(rand() * 12);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 4.5 * t.s;
      leafAt(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d);
    }
  }
  // Blown along the roads, mostly on the verges.
  const roads = getWorld().roads.filter((r) => !r.def.hidden);
  for (let i = 0; i < 4200; i++) {
    const road = roads[Math.floor(rand() * roads.length)];
    const sm = road.samples[Math.floor(rand() * road.samples.length)];
    const side = rand() < 0.5 ? -1 : 1;
    const lateral = side * (road.def.width / 2 + (rand() - 0.65) * 4);
    leafAt(sm.x - sm.tz * lateral + (rand() - 0.5), sm.z + sm.tx * lateral + (rand() - 0.5));
  }

  // Pale pebbles scattered along the road shoulders.
  for (let i = 0; i < 1100; i++) {
    const road = roads[Math.floor(rand() * roads.length)];
    const sm = road.samples[Math.floor(rand() * road.samples.length)];
    const side = rand() < 0.5 ? -1 : 1;
    const lateral = side * (road.def.width / 2 + 0.8 + rand() * 3.5);
    const x = sm.x - sm.tz * lateral;
    const z = sm.z + sm.tx * lateral;
    if (!free(x, z, 0.2) || surfaceAt(x, z) - heightAt(x, z) > 0.2) continue;
    const s = 0.1 + rand() * rand() * 0.28;
    out.pebbles.push({ x, y: heightAt(x, z) + s * 0.25, z, s, rot: rand() * Math.PI * 2, tint: rand() });
  }
}
