/** Static 2D colliders (top-down) in a spatial hash. The car is a pair of circles. */

interface CircleCollider {
  kind: "circle";
  x: number;
  z: number;
  r: number;
}

interface BoxCollider {
  kind: "box";
  x: number;
  z: number;
  hw: number;
  hd: number;
  cos: number;
  sin: number;
}

export type Collider = CircleCollider | BoxCollider;

const CELL = 8;
/** Largest circle resolveCircle is asked about. Colliders are filed this much wider, so one cell lookup sees everything it could touch. */
const QUERY_R = 1;
const grid = new Map<number, Collider[]>();
const key = (i: number, j: number) => (i + 512) * 1024 + (j + 512);

function insert(c: Collider, extent: number) {
  extent += QUERY_R;
  const i0 = Math.floor((c.x - extent) / CELL);
  const i1 = Math.floor((c.x + extent) / CELL);
  const j0 = Math.floor((c.z - extent) / CELL);
  const j1 = Math.floor((c.z + extent) / CELL);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      const list = grid.get(k);
      if (list) list.push(c);
      else grid.set(k, [c]);
    }
}

export function addCircle(x: number, z: number, r: number) {
  insert({ kind: "circle", x, z, r }, r);
}

/** Box with half extents (hw along local x, hd along local z), rotated by `yaw`. */
export function addBox(x: number, z: number, hw: number, hd: number, yaw: number) {
  insert({ kind: "box", x, z, hw, hd, cos: Math.cos(yaw), sin: Math.sin(yaw) }, Math.hypot(hw, hd));
}

export function clearColliders() {
  grid.clear();
}

export interface Contact {
  x: number;
  z: number;
  nx: number;
  nz: number;
  depth: number;
}

/** Push a circle out of any colliders. Returns the corrected centre and the deepest contact normal. */
export function resolveCircle(x: number, z: number, r: number): Contact | null {
  const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return null;
  let hit: Contact | null = null;
  for (const c of list) {
    let nx = 0;
    let nz = 0;
    let depth = 0;
    if (c.kind === "circle") {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = r + c.r;
      if (d >= min) continue;
      nx = d > 1e-4 ? dx / d : 1;
      nz = d > 1e-4 ? dz / d : 0;
      depth = min - d;
    } else {
      // Into box space: local x = (cos, -sin), local z = (sin, cos) — matches three.js rotation.y.
      const dx = x - c.x;
      const dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin;
      const lz = dx * c.sin + dz * c.cos;
      const cx = Math.max(-c.hw, Math.min(c.hw, lx));
      const cz = Math.max(-c.hd, Math.min(c.hd, lz));
      let ox = lx - cx;
      let oz = lz - cz;
      let d = Math.hypot(ox, oz);
      if (d >= r) continue;
      if (d < 1e-4) {
        // Centre inside the box: push out along the shallowest axis.
        const px = c.hw - Math.abs(lx);
        const pz = c.hd - Math.abs(lz);
        if (px < pz) {
          ox = Math.sign(lx) || 1;
          oz = 0;
          d = -px;
        } else {
          ox = 0;
          oz = Math.sign(lz) || 1;
          d = -pz;
        }
      } else {
        ox /= d;
        oz /= d;
      }
      depth = r - d;
      nx = ox * c.cos + oz * c.sin;
      nz = -ox * c.sin + oz * c.cos;
    }
    x += nx * depth;
    z += nz * depth;
    if (!hit || depth > hit.depth) hit = { x, z, nx, nz, depth };
  }
  if (hit) {
    hit.x = x;
    hit.z = z;
  }
  return hit;
}
