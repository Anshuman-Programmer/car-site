"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GRID, getWorld } from "@/lib/world/terrain";
import { WORLD_HALF } from "@/lib/world/layout";
import { getGrassDensity, getGround } from "./groundColors";
import { sharedUniforms } from "./materials";

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
    geo.setAttribute("aGrass", new THREE.BufferAttribute(getGrassDensity(), 1));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, []);

  const material = useMemo(() => makeTerrainMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

/**
 * Inside the dense grass field the ground under the blades goes dark, so the
 * carpet reads as deep and self-shadowed. It fades out with the field's edge,
 * leaving distant meadows their normal colour.
 */
function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uField = sharedUniforms.uField;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGrass;\nvarying float vGrass;\nvarying vec2 vGroundXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrass = aGrass;\nvGroundXZ = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uField;\nvarying float vGrass;\nvarying vec2 vGroundXZ;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (uField.z > 0.0) {
          float inField = 1.0 - smoothstep(uField.z * 0.7, uField.z * 0.95, distance(vGroundXZ, uField.xy));
          diffuseColor.rgb *= mix(1.0, 0.16, smoothstep(0.0, 0.6, vGrass) * inField);
        }`,
      );
  };
  return mat;
}
