import * as THREE from "three";
import { GRID, getWorld } from "@/lib/world/terrain";
import { LAKE_CENTER, LAKE_LEVEL, lakeRadius, WORLD_HALF } from "@/lib/world/layout";
import { fbm, smoothstep } from "@/lib/world/noise";
import { palette } from "./materials";

export interface Ground {
  /** Linear RGB per grid vertex, the colour the terrain mesh is painted. */
  colors: Float32Array;
  /** 0..1 per grid vertex: how much the ground reads as grass. */
  grassy: Float32Array;
}

let cached: Ground | null = null;

/** Terrain colour, baked once and shared by the terrain mesh and the grass field. */
export function getGround(): Ground {
  if (cached) return cached;
  const { heights, roadEdge } = getWorld();
  const cell = (WORLD_HALF * 2) / (GRID - 1);
  const colors = new Float32Array(GRID * GRID * 3);
  const grassy = new Float32Array(GRID * GRID);
  const c = new THREE.Color();
  const tmp = new THREE.Color();

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const k = j * GRID + i;
      const x = i * cell - WORLD_HALF;
      const z = j * cell - WORLD_HALF;
      const h = heights[k];

      const hx = heights[j * GRID + Math.min(GRID - 1, i + 1)] - heights[j * GRID + Math.max(0, i - 1)];
      const hz = heights[Math.min(GRID - 1, j + 1) * GRID + i] - heights[Math.max(0, j - 1) * GRID + i];
      const slope = Math.hypot(hx, hz) / (2 * cell);

      // Grass with two-scale variation; drier meadows in the south.
      const n1 = fbm(x * 0.04, z * 0.04, 2, 31) * 0.5 + 0.5;
      const n2 = fbm(x * 0.012 + 9, z * 0.012, 2, 33) * 0.5 + 0.5;
      c.copy(palette.grassB).lerp(palette.grassA, n1);
      c.lerp(palette.meadow, smoothstep(0.55, 0.85, n2) * smoothstep(-20, 60, z) * 0.6);
      c.lerp(palette.forestFloor, smoothstep(0.2, 0.8, -z / 120) * 0.45);

      // Dusty shoulders along the roads.
      const re = roadEdge[k];
      c.lerp(palette.dirt, (1 - smoothstep(-0.5, 2.6, re)) * 0.55);

      // Sand on the lake shore and the beach.
      const ldx = x - LAKE_CENTER[0];
      const ldz = z - LAKE_CENTER[1];
      const ls = Math.hypot(ldx, ldz) / lakeRadius(Math.atan2(ldz, ldx));
      const sandy = Math.max(1 - smoothstep(1.0, 1.18, ls), 1 - smoothstep(LAKE_LEVEL - 0.4, 2.2, h));
      c.lerp(palette.sand, sandy);
      c.lerp(palette.underwater, smoothstep(0.97, 0.55, ls) * 0.9);

      // Layered sandstone on steep faces.
      const rock = smoothstep(0.8, 1.3, slope);
      if (rock > 0) {
        const band = Math.floor(h * 0.55 + fbm(x * 0.05, z * 0.05, 1, 41) * 0.8);
        tmp.copy(band % 2 === 0 ? palette.rockA : palette.rockB);
        if (band % 3 === 0) tmp.lerp(palette.rockC, 0.55);
        c.lerp(tmp, rock);
      }

      // Fade under the waterline so the shallows read as depth.
      if (h < 0.2) c.lerp(palette.underwater, smoothstep(0.2, -4, h) * 0.85);

      colors[k * 3] = c.r;
      colors[k * 3 + 1] = c.g;
      colors[k * 3 + 2] = c.b;
      grassy[k] = smoothstep(0.3, 1.6, re) * (1 - sandy) * (1 - rock) * smoothstep(0.6, 1.4, h);
    }
  }

  cached = { colors, grassy };
  return cached;
}
