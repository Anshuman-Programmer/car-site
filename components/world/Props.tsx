"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { benches } from "@/lib/world/structures";
import { heightAt } from "@/lib/world/terrain";
import type { Instance } from "@/lib/world/scatter";
import { paint } from "./materials";
import { InstancedSet } from "./Vegetation";
import { breakKey } from "@/lib/world/breakables";
import { useBrokenProps } from "./useBreakables";

const WOOD = "#c8875a";
const FRAME = "#3d4a6b";
const STONE = "#7a7e89";

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, tilt = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (tilt) g.rotateX(tilt);
  g.translate(x, y, z);
  return paint(g, color);
}

/** Park bench, front = +z: three seat slats, a tilted two-slat back, painted iron ends. */
function benchGeometry() {
  const parts = [
    ...[0.15, 0, -0.15].map((z) => box(1.8, 0.06, 0.13, 0, 0.48, z, WOOD)),
    ...[0.72, 0.9].map((y) => box(1.8, 0.12, 0.05, 0, y, -0.27 - (y - 0.72) * 0.15, WOOD, -0.15)),
  ];
  for (const x of [0.8, -0.8]) {
    parts.push(
      box(0.07, 0.48, 0.07, x, 0.24, 0.17, FRAME),
      box(0.07, 0.98, 0.07, x, 0.49, -0.27, FRAME, -0.15),
      box(0.07, 0.06, 0.5, x, 0.44, -0.03, FRAME),
      box(0.08, 0.05, 0.52, x, 0.67, -0.03, FRAME),
      box(0.06, 0.2, 0.06, x, 0.57, 0.17, FRAME),
    );
  }
  return mergeGeometries(parts)!;
}

/** Ground lantern body: stone plinth, iron corner posts and a pyramid cap. */
function lanternGeometry() {
  const cap = new THREE.ConeGeometry(0.26, 0.2, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(0, 0.66, 0);
  const parts = [box(0.36, 0.14, 0.36, 0, 0.07, 0, STONE), box(0.28, 0.04, 0.28, 0, 0.16, 0, FRAME), paint(cap, FRAME)];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(box(0.04, 0.42, 0.04, x * 0.12, 0.37, z * 0.12, FRAME));
  return mergeGeometries(parts)!;
}

export function Props() {
  const broken = useBrokenProps();
  const items = useMemo(() => {
    const seats: Instance[] = [];
    const lanterns: Instance[] = [];
    // Broken ones collapse to zero scale; Debris draws their pieces.
    benches().forEach((b, i) => {
      seats.push({ x: b.x, y: heightAt(b.x, b.z), z: b.z, s: broken.has(breakKey("bench", i)) ? 0 : 1, rot: b.yaw, tint: 0 });
      lanterns.push({ x: b.lantern.x, y: heightAt(b.lantern.x, b.lantern.z), z: b.lantern.z, s: broken.has(breakKey("lantern", i)) ? 0 : 1, rot: b.yaw, tint: 0 });
    });
    return { seats, lanterns, glow: lanterns.map((l) => ({ ...l, y: l.y + 0.37 })) };
  }, [broken]);

  const assets = useMemo(() => {
    const flat = { vertexColors: true, flatShading: true, roughness: 0.75 };
    return {
      benchGeo: benchGeometry(),
      lanternGeo: lanternGeometry(),
      lightGeo: new THREE.BoxGeometry(0.2, 0.36, 0.2),
      haloGeo: new THREE.SphereGeometry(0.7, 10, 8),
      propMat: new THREE.MeshStandardMaterial(flat),
      lightMat: new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffb85c", emissiveIntensity: 1.6, toneMapped: false }),
      haloMat: new THREE.MeshBasicMaterial({ color: "#ffb366", transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(assets).forEach((a) => a.dispose());
    },
    [assets],
  );

  const white = ["#ffffff"];
  return (
    <group>
      <InstancedSet items={items.seats} geometry={assets.benchGeo} material={assets.propMat} colors={white} castShadow />
      <InstancedSet items={items.lanterns} geometry={assets.lanternGeo} material={assets.propMat} colors={white} castShadow />
      <InstancedSet items={items.glow} geometry={assets.lightGeo} material={assets.lightMat} colors={white} />
      <InstancedSet items={items.glow} geometry={assets.haloGeo} material={assets.haloMat} colors={white} />
    </group>
  );
}
