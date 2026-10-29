import { addCircle } from "./colliders";
import { addBreakable } from "./breakables";
import { COURSE } from "./layout";
import { mulberry32, smoothstep } from "./noise";
import { getWorld, heightAt, addSurfaceOverlay, type RoadSample } from "./terrain";

/**
 * The off-road park. Drivable features (whoops, logs, a tabletop jump, a rock
 * garden) are analytic height profiles laid over the terrain, so the wheels
 * ride exactly what the meshes show. Big boulders are solid colliders.
 */

export type FeatureKind = "mound" | "table" | "log" | "rock";

export interface Feature {
  kind: FeatureKind;
  x: number;
  z: number;
  /** Ground height under the feature's centre. */
  y: number;
  /** Unit axis along the track (u); across is (-tz, tx) (v). */
  tx: number;
  tz: number;
  /** Half extents along u and v, and peak height. */
  a: number;
  b: number;
  h: number;
  tint: number;
}

export interface Boulder {
  x: number;
  z: number;
  y: number;
  r: number;
  h: number;
  rot: number;
  tint: number;
}

export interface CourseProp {
  kind: "cone" | "crate";
  index: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
}

export interface Course {
  features: Feature[];
  boulders: Boulder[];
  props: CourseProp[];
}

const TABLE_TOP = 1.2;

/** Height above the feature's base at local (u, v); <= 0 means off the feature. */
export function featureProfile(f: Feature, u: number, v: number) {
  switch (f.kind) {
    case "mound": {
      const d = Math.hypot(u / f.a, v / f.b);
      if (d >= 1) return 0;
      const c = Math.cos((Math.PI / 2) * d);
      return f.h * c * c;
    }
    case "rock": {
      const d2 = (u / f.a) ** 2 + (v / f.b) ** 2;
      return d2 >= 1 ? 0 : f.h * (1 - d2) * (1.15 - 0.15 * d2);
    }
    case "log": {
      // A log of radius `a` lying across the track, bedded in so 1.4 radii show.
      if (Math.abs(v) > f.b || Math.abs(u) >= f.a) return 0;
      return f.a * 0.4 + Math.sqrt(f.a * f.a - u * u);
    }
    case "table": {
      // Ramp up, flat top, ramp down; sides rounded off over the last 0.6 m.
      const au = Math.abs(u);
      if (au >= f.a || Math.abs(v) >= f.b) return 0;
      const ramp = au <= TABLE_TOP ? 1 : 1 - (au - TABLE_TOP) / (f.a - TABLE_TOP);
      return f.h * ramp * smoothstep(f.b, f.b - 0.6, Math.abs(v));
    }
  }
}

/** Radius of the feature's footprint, for culling. */
const reach = (f: Feature) => Math.max(f.a, f.b);

let cached: Course | null = null;

export function getCourse(): Course {
  if (cached) return cached;
  const road = getWorld().roads.find((r) => r.def.id === "offroad");
  if (!road) return (cached = { features: [], boulders: [], props: [] });
  const half = road.def.width / 2;
  const n = road.samples.length;
  const rand = mulberry32(4242);
  /** Track sample at fraction `f` of the lap, plus `ahead` metres (samples are 1 m apart). */
  const at = (f: number, ahead = 0) => road.samples[(((Math.floor(f * n) + Math.round(ahead)) % n) + n) % n];
  /** Point `lateral` metres to the right of travel. */
  const offset = (s: RoadSample, lateral: number) => ({ x: s.x - s.tz * lateral, z: s.z + s.tx * lateral });
  /** +1 if the right-hand side of travel faces away from the course centre. */
  const outward = (s: RoadSample) => (Math.sign((-s.tz) * (s.x - COURSE.x) + s.tx * (s.z - COURSE.z)) || 1);

  const features: Feature[] = [];
  const feature = (kind: FeatureKind, s: RoadSample, lateral: number, a: number, b: number, h: number) => {
    const p = offset(s, lateral);
    features.push({ kind, ...p, y: heightAt(p.x, p.z), tx: s.tx, tz: s.tz, a, b, h, tint: rand() });
  };

  // Two logs across the track.
  for (const ahead of [0, 3]) feature("log", at(0.12, ahead), 0, 0.22, half + 0.4, 0);
  // Whoops: a run of rounded dirt rollers.
  for (let i = 0; i < 3; i++) feature("mound", at(0.23, i * 3.8), 0, 1.9, half + 0.8, 0.4);
  // Tabletop jump across the full width; the track curves, so it is kept short.
  feature("table", at(0.45), 0, 4.8, half + 0.6, 1.1);
  // Rock garden: lumpy stones scattered over the full width.
  for (let i = 0; i < 9; i++) {
    const r = 0.8 + rand() * 0.7;
    feature("rock", at(0.6, (i - 4) * 1.6 + (rand() - 0.5)), (rand() - 0.5) * (half * 2 - 1), r, r * (0.8 + rand() * 0.4), 0.22 + rand() * 0.22);
  }

  // Boulders: a ring of big stones lining the outside, and a cluster in the infield.
  const boulders: Boulder[] = [];
  const boulder = (x: number, z: number, r: number) =>
    boulders.push({ x, z, y: heightAt(x, z), r, h: r * (0.9 + rand() * 0.5), rot: rand() * Math.PI * 2, tint: rand() });
  for (let i = 0; i < 11; i++) {
    const s = at(0.08 + i * 0.083 + rand() * 0.02);
    const r = 1.2 + rand() * 1.3;
    const p = offset(s, outward(s) * (half + 1.8 + r + rand() * 1.5));
    boulder(p.x, p.z, r);
  }
  // A few right at the track edge, on the inside of corners, to clip.
  for (const f of [0.33, 0.52, 0.71, 0.9]) {
    const s = at(f);
    const r = 0.9 + rand() * 0.5;
    const p = offset(s, -outward(s) * (half + r * 0.6));
    boulder(p.x, p.z, r);
  }
  boulder(COURSE.x + 1, COURSE.z - 1, 3.4);
  boulder(COURSE.x - 3.5, COURSE.z + 3, 2.4);
  boulder(COURSE.x + 4, COURSE.z + 3.5, 1.8);

  // Smashables: a cone slalom down one straight, and crates stacked on a corner.
  const props: CourseProp[] = [];
  for (let i = 0; i < 6; i++) {
    const p = offset(at(0.7, i * 3.2), (i % 2 ? 1 : -1) * 1.4);
    props.push({ kind: "cone", index: i, ...p, y: heightAt(p.x, p.z), yaw: rand() * Math.PI });
  }
  for (const [f, side] of [[0.92, 1], [0.18, -1]] as const) {
    for (let i = 0; i < 4; i++) {
      const s = at(f, Math.floor(i / 2) * 1.2);
      const yaw = Math.atan2(s.tx, s.tz);
      const p = offset(s, side * outward(s) * (half - 0.9 - (i % 2) * 1.1));
      props.push({ kind: "crate", index: props.filter((q) => q.kind === "crate").length, ...p, y: heightAt(p.x, p.z), yaw: yaw + (rand() - 0.5) * 0.3 });
    }
  }

  cached = { features, boulders, props };
  return cached;
}

/** Highest feature surface at (x, z), or -Infinity off every feature. */
function courseSurface(x: number, z: number) {
  let best = -Infinity;
  for (const f of getCourse().features) {
    const dx = x - f.x;
    const dz = z - f.z;
    const r = reach(f);
    if (dx * dx + dz * dz > r * r * 1.5) continue;
    const h = featureProfile(f, dx * f.tx + dz * f.tz, -dx * f.tz + dz * f.tx);
    if (h > 0) best = Math.max(best, f.y + h);
  }
  return best;
}

let registered = false;
export function registerCourse() {
  if (registered) return;
  registered = true;
  const c = getCourse();
  for (const b of c.boulders) addCircle(b.x, b.z, b.r * 0.85);
  for (const p of c.props) addBreakable(p.kind, p.index, p.x, p.z, p.yaw);
  const pad = 8;
  const xs = c.features.map((f) => f.x);
  const zs = c.features.map((f) => f.z);
  if (!xs.length) return;
  addSurfaceOverlay({
    fn: courseSurface,
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minZ: Math.min(...zs) - pad,
    maxZ: Math.max(...zs) + pad,
  });
}
