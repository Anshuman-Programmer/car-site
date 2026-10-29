import { projects } from "@/data/projects";
import { skillCategories } from "@/data/skills";
import { experience } from "@/data/experience";
import { addBox, addCircle } from "./colliders";
import { getWorld, type RoadSample } from "./terrain";

/** Placement of hand-built structures. Yaw uses three.js rotation.y (model front = +z). */

export const CABIN = { x: -13, z: 80, yaw: Math.PI, hw: 4, hd: 3.6 };
export const GARAGE = { x: 100, z: -6, yaw: -Math.PI / 2, hw: 6.5, hd: 5 };
export const GROVE = { x: 22, z: -87, radius: 8.5 };
export const TOWER = { x: -68, z: -73, yaw: 0.4, half: 2.2 };
export const LIGHTHOUSE = { x: -126, z: 4, r: 3.2 };
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
    ...KIOSKS.map((k) => [k.x, k.z, 3] as [number, number, number]),
    ...benches().map((b) => [b.x, b.z, 1.6] as [number, number, number]),
  ];
}

let registered = false;
export function registerStructureColliders() {
  if (registered) return;
  registered = true;
  addBox(CABIN.x, CABIN.z, CABIN.hw, CABIN.hd, CABIN.yaw);
  addBox(GARAGE.x, GARAGE.z, GARAGE.hw, GARAGE.hd, GARAGE.yaw);
  addBox(TOWER.x, TOWER.z, TOWER.half, TOWER.half, TOWER.yaw);
  addCircle(LIGHTHOUSE.x, LIGHTHOUSE.z, LIGHTHOUSE.r);
  addBox(TERMINAL.x, TERMINAL.z, 1.6, 1.3, TERMINAL.yaw);
  addCircle(GROVE.x, GROVE.z, 1.3); // campfire
  for (const m of MONOLITHS) addBox(m.x, m.z, 0.8, 0.6, m.yaw);
  for (const k of KIOSKS) addCircle(k.x, k.z, 0.9);
  for (const l of lampPosts()) addCircle(l.x, l.z, 0.3);
  for (const b of benches()) {
    addBox(b.x, b.z, 0.95, 0.35, b.yaw);
    addCircle(b.lantern.x, b.lantern.z, 0.25);
  }
  for (const s of signposts()) addCircle(s.x, s.z, 0.3);
  for (const m of milestones()) addCircle(m.x, m.z, 0.35);
}
