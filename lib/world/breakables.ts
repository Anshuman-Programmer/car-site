/**
 * Props the car can smash. Physics tests the car against the intact ones;
 * a hard enough hit marks one broken and queues a burst of debris for the
 * renderer. Broken props quietly rebuild once the car is far away.
 */

export type BreakKind = "lamp" | "bench" | "lantern" | "sign" | "cone" | "crate";

interface KindSpec {
  /** Collision radius, metres. */
  r: number;
  /** Closing speed (m/s) needed to break it; slower bumps treat it as solid. */
  breakSpeed: number;
  /** Mass relative to the car: how much speed the car loses smashing through. */
  mass: number;
}

export const BREAK_KINDS: Record<BreakKind, KindSpec> = {
  lamp: { r: 0.3, breakSpeed: 2.5, mass: 0.06 },
  bench: { r: 0.9, breakSpeed: 2.5, mass: 0.05 },
  lantern: { r: 0.25, breakSpeed: 1.2, mass: 0.01 },
  sign: { r: 0.3, breakSpeed: 2.0, mass: 0.03 },
  cone: { r: 0.3, breakSpeed: 0, mass: 0.004 },
  crate: { r: 0.55, breakSpeed: 1.5, mass: 0.03 },
};

export interface Breakable {
  kind: BreakKind;
  index: number;
  x: number;
  z: number;
  yaw: number;
  r: number;
  broken: boolean;
  brokenAt: number;
}

export interface DebrisBurst {
  kind: BreakKind;
  x: number;
  z: number;
  yaw: number;
  /** Velocity of the car where it struck, m/s. */
  vx: number;
  vz: number;
}

const CELL = 8;
const items = new Map<string, Breakable>();
const grid = new Map<number, Breakable[]>();
const cellKey = (i: number, j: number) => (i + 512) * 1024 + (j + 512);

/** Bursts waiting for the debris renderer to pick up. */
export const debrisQueue: DebrisBurst[] = [];

export const breakKey = (kind: BreakKind, index: number) => `${kind}:${index}`;

/** Keys of the broken props; replaced (never mutated) on every change, so it works as a React snapshot. */
let brokenSet: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const notify = () => {
  brokenSet = new Set([...items.entries()].filter(([, b]) => b.broken).map(([k]) => k));
  for (const l of listeners) l();
};

export function subscribeBreakables(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const brokenProps = () => brokenSet;

export function addBreakable(kind: BreakKind, index: number, x: number, z: number, yaw: number) {
  const b: Breakable = { kind, index, x, z, yaw, r: BREAK_KINDS[kind].r, broken: false, brokenAt: 0 };
  items.set(breakKey(kind, index), b);
  // Filed wider than the prop by the largest query circle, so one cell lookup sees everything it could touch.
  const e = b.r + 1;
  const i0 = Math.floor((x - e) / CELL);
  const i1 = Math.floor((x + e) / CELL);
  const j0 = Math.floor((z - e) / CELL);
  const j1 = Math.floor((z + e) / CELL);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const k = cellKey(i, j);
      const list = grid.get(k);
      if (list) list.push(b);
      else grid.set(k, [b]);
    }
}

/** Intact props overlapping a circle. */
export function breakablesNear(x: number, z: number, r: number, out: Breakable[]) {
  out.length = 0;
  const list = grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return out;
  for (const b of list) {
    if (b.broken) continue;
    if ((b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + r) ** 2) out.push(b);
  }
  return out;
}

export function smash(b: Breakable, vx: number, vz: number, now: number) {
  b.broken = true;
  b.brokenAt = now;
  debrisQueue.push({ kind: b.kind, x: b.x, z: b.z, yaw: b.yaw, vx, vz });
  notify();
}

/** Rebuild props that have been broken a while, but only out of the driver's sight. */
export function restoreBreakables(carX: number, carZ: number, now: number, after = 45, minDist = 45) {
  let changed = false;
  for (const b of items.values()) {
    if (!b.broken || now - b.brokenAt < after) continue;
    if ((b.x - carX) ** 2 + (b.z - carZ) ** 2 < minDist * minDist) continue;
    b.broken = false;
    changed = true;
  }
  if (changed) notify();
}
