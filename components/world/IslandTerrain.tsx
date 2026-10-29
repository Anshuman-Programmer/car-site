"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { GRID, getWorld } from "@/lib/world/terrain";
import { WORLD_HALF } from "@/lib/world/layout";
import { getGround } from "./groundColors";

/** The heightfield as a flat-shaded, vertex-coloured mesh. */
export function IslandTerrain() {
  const geometry = useMemo(() => {
    const { heights } = getWorld();
    const cell = (WORLD_HALF * 2) / (GRID - 1);
    const pos = new Float32Array(GRID * GRID * 3);

    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const k = j * GRID + i;
        pos[k * 3] = i * cell - WORLD_HALF;
        pos[k * 3 + 1] = heights[k];
        pos[k * 3 + 2] = j * cell - WORLD_HALF;
      }
    }

    const index: number[] = [];
    for (let j = 0; j < GRID - 1; j++) {
      for (let i = 0; i < GRID - 1; i++) {
        const a = j * GRID + i;
        const b = a + 1;
        const d = a + GRID;
        const e = d + 1;
        // Alternate the diagonal for a less regular low-poly look.
        if ((i + j) % 2 === 0) index.push(a, d, b, b, d, e);
        else index.push(a, d, e, a, e, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(getGround().colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}
