import { projects } from "@/data/projects";
import { skillCategories } from "@/data/skills";
import { experience } from "@/data/experience";
import { addBox, addCircle } from "./colliders";
import { addBreakable } from "./breakables";
import { COURSE } from "./layout";
import { addSurfaceOverlay, getWorld, heightAt, type RoadSample } from "./terrain";

/** Placement of hand-built structures. Yaw uses three.js rotation.y (model front = +z). */

export const CABIN = { x: -13, z: 80, yaw: Math.PI, hw: 4, hd: 3.6 };
export const GARAGE = { x: 100, z: -6, yaw: -Math.PI / 2 };
export const GROVE = { x: 22, z: -87, radius: 8.5 };
export const TOWER = { x: -68, z: -73, yaw: 0.4 };
export const LIGHTHOUSE = { x: -126, z: 4 };
export const TERMINAL = { x: -31, z: -102, yaw: 0.35 };
export const DOCK = { x: 4, z: 20, yaw: 0.1 };

const KIOSK_CENTER = { x: 86, z: -6 };
export const KIOSKS = projects.slice(0, 6).map((p, i) => {
  const side = i < 3 ? -1 : 1;
  const k = i % 3;
  const x = KIOSK_CENTER.x - 7 + k * 7;
  const z = KIOSK_CENTER.z + side * (k === 1 ? 11 : 9.5);
  const yaw = Math.atan2(KIOSK_CENTER.x - x, KIOSK_CENTER.z - z);
  return { project: p, x, z, yaw };
});

/** One monolith per skill category, arranged in a horseshoe that opens to the south. */
export const MONOLITHS = skillCategories.map((c, i) => {
  const n = skillCategories.length;
  const a = Math.PI * 0.5 + 0.55 + (i / (n - 1)) * (Math.PI * 2 - 1.1);
  const x = GROVE.x + Math.cos(a) * GROVE.radius;
  const z = GROVE.z + Math.sin(a) * GROVE.radius;
  return { category: c, x, z, yaw: Math.atan2(GROVE.x - x, GROVE.z - z) };
});

function roadById(id: string) {
  return getWorld().roads.find((r) => r.def.id === id)!;
}

function offsetSample(s: RoadSample, lateral: number) {
  // Left of travel = (tz, -tx) rotated; we use the right-hand normal (-tz, tx).
  return { x: s.x - s.tz * lateral, z: s.z + s.tx * lateral };
}

/** Career milestones lining the road up to the tower, oldest at the bottom. */
export function milestones() {
  const road = roadById("tower");
  const roles = [...experience].reverse();
  const n = roles.length;
  return roles.map((e, i) => {
    const s = road.samples[Math.min(road.samples.length - 1, 3 + Math.round((i / (n - 1)) * (road.samples.length - 6)))];
    const side = i % 2 ? 1 : -1;
    const p = offsetSample(s, side * (road.def.width / 2 + 1.3));
    return { entry: e, x: p.x, z: p.z, yaw: Math.atan2(s.tx, s.tz) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) };
  });
}

/** Lamp posts along the loop, alternating sides, skipping bridges and junctions. */
export function lampPosts() {
  const w = getWorld();
  const loop = w.roads[0];
  const junctions = w.roads.slice(1).map((r) => r.samples[0]);
  const out: { x: number; z: number; yaw: number }[] = [];
  let side = 1;
  for (let i = 0; i < loop.samples.length; i += 22) {
    const s = loop.samples[i];
    if (s.bridge) continue;
    if (junctions.some((j) => Math.hypot(j.x - s.x, j.z - s.z) < 12)) continue;
    const p = offsetSample(s, side * (loop.def.width / 2 + 1.5));
    out.push({ ...p, yaw: Math.atan2(s.tx, s.tz) + (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
    side = -side;
  }
  return out;
}

/**
 * Benches facing the loop, set back further than the lamps and halfway
 * between them, each with a ground lantern at one end.
 */
export function benches() {
  const w = getWorld();
  const loop = w.roads[0];
  const junctions = w.roads.slice(1).map((r) => r.samples[0]);
  const out: { x: number; z: number; yaw: number; lantern: { x: number; z: number } }[] = [];
  let side = -1;
  for (let i = 11; i < loop.samples.length; i += 44) {
    const s = loop.samples[i];
    if (s.bridge) continue;
    if (junctions.some((j) => Math.hypot(j.x - s.x, j.z - s.z) < 14)) continue;
    const lateral = side * (loop.def.width / 2 + 2.3);
    const p = offsetSample(s, lateral);
    const lantern = { x: p.x + s.tx * 1.5, z: p.z + s.tz * 1.5 };
    out.push({ ...p, yaw: Math.atan2(s.tx, s.tz) + (side > 0 ? Math.PI / 2 : -Math.PI / 2), lantern });
    side = -side;
  }
  return out;
}

/** Signposts where spurs leave the loop. */
export function signposts() {
  const w = getWorld();
  const labels: Record<string, string> = {
    garage: "PROJECTS",
    skills: "SKILLS",
    tower: "EXPERIENCE",
    lighthouse: "CONTACT",
    "offroad-spur": "OFF-ROAD",
  };
  return w.roads
    .filter((r) => labels[r.def.id])
    .map((r) => {
      const s = r.samples[Math.min(4, r.samples.length - 1)];
      const p = offsetSample(s, r.def.width / 2 + 1.4);
      return { label: labels[r.def.id], x: p.x, z: p.z, yaw: Math.atan2(-s.tx, -s.tz) };
    });
}

/** Circles the scatter must keep clear of. */
export function exclusionZones(): [number, number, number][] {
  return [
    [CABIN.x, CABIN.z, 9],
    [GARAGE.x, GARAGE.z, 10],
    [GROVE.x, GROVE.z, 13],
    [TOWER.x, TOWER.z, 7],
    [LIGHTHOUSE.x, LIGHTHOUSE.z, 8],
    [TERMINAL.x, TERMINAL.z, 5],
    [COURSE.x, COURSE.z, COURSE.radius],
    ...KIOSKS.map((k) => [k.x, k.z, 3] as [number, number, number]),
    ...benches().map((b) => [b.x, b.z, 1.6] as [number, number, number]),
  ];
}

type Placed = { x: number; z: number; yaw: number };

/** (lx, lz) in a structure's own frame (three.js rotation.y), to world. */
function toWorld(p: Placed, lx: number, lz: number) {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c };
}

/** Box collider placed in a structure's frame; dimensions match the meshes in Buildings.tsx. */
function addPartBox(p: Placed, lx: number, lz: number, hw: number, hd: number, yaw = 0) {
  const w = toWorld(p, lx, lz);
  addBox(w.x, w.z, hw, hd, p.yaw + yaw);
}

/** Garage: solid walls with an open front you can drive through, onto the raised floor slab. */
function registerGarage() {
  addPartBox(GARAGE, 0, -4.85, 6.5, 0.2); // back wall
  for (const s of [1, -1]) {
    addPartBox(GARAGE, s * 6.3, 0, 0.2, 5); // side walls
    addPartBox(GARAGE, s * 5.3, 4.8, 1.2, 0.2); // front pillars
  }
  addPartBox(GARAGE, -4.4, -3.6, 1.5, 0.6); // workbench
  addPartBox(GARAGE, 4.5, -1, 0.85, 2); // lift rails
  const floor = heightAt(GARAGE.x, GARAGE.z) + 0.3;
  const c = Math.cos(GARAGE.yaw);
  const s = Math.sin(GARAGE.yaw);
  const reach = Math.hypot(6.7, 5.2);
  addSurfaceOverlay({
    fn: (x, z) => {
      const dx = x - GARAGE.x;
      const dz = z - GARAGE.z;
      return Math.abs(dx * c - dz * s) < 6.7 && Math.abs(dx * s + dz * c) < 5.2 ? floor : -Infinity;
    },
    minX: GARAGE.x - reach,
    maxX: GARAGE.x + reach,
    minZ: GARAGE.z - reach,
    maxZ: GARAGE.z + reach,
  });
}

let registered = false;
export function registerStructureColliders() {
  if (registered) return;
  registered = true;
  addBox(CABIN.x, CABIN.z, CABIN.hw, CABIN.hd, CABIN.yaw);
  registerGarage();
  // Tower: four legs and the ladder; there's room to drive between the legs.
  for (const [lx, lz] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) {
    const w = toWorld(TOWER, lx, lz);
    addCircle(w.x, w.z, 0.3);
  }
  addPartBox(TOWER, 0, 2.35, 0.45, 0.08);
  // Lighthouse: the square plinth, and the keeper's hut beside it.
  addBox(LIGHTHOUSE.x, LIGHTHOUSE.z, 3, 3, 0);
  addPartBox({ ...LIGHTHOUSE, yaw: 0 }, 4.4, 2.6, 1.4, 1.2, -0.6);
  addBox(TERMINAL.x, TERMINAL.z, 1.6, 1.3, TERMINAL.yaw);
  addCircle(GROVE.x, GROVE.z, 1.3); // campfire
  // Four-sided pillars stand corner-on: a square turned 45 degrees.
  for (const m of MONOLITHS) addBox(m.x, m.z, 0.6, 0.6, m.yaw + Math.PI / 4);
  for (const k of KIOSKS) addCircle(k.x, k.z, 0.9);
  // Street furniture is breakable rather than solid.
  lampPosts().forEach((l, i) => addBreakable("lamp", i, l.x, l.z, l.yaw));
  benches().forEach((b, i) => {
    addBreakable("bench", i, b.x, b.z, b.yaw);
    addBreakable("lantern", i, b.lantern.x, b.lantern.z, b.yaw);
  });
  signposts().forEach((s, i) => addBreakable("sign", i, s.x, s.z, s.yaw));
  for (const m of milestones()) addCircle(m.x, m.z, 0.35);
}
