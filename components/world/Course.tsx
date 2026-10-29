"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { featureProfile, getCourse, type Feature } from "@/lib/world/course";
import { breakKey } from "@/lib/world/breakables";
import { heightAt } from "@/lib/world/terrain";
import { paint } from "./materials";
import { rockGeometry } from "./Vegetation";
import { useBrokenProps } from "./useBreakables";

const DIRT = new THREE.Color("#a27a50");
const DIRT_TOP = new THREE.Color("#8a6440");
const ROCKS = ["#9d9488", "#b0a493", "#8a8379", "#a39a8c", "#7f786f"];
const BOULDERS = ["#b9a48b", "#a99880", "#c7a57d", "#9c8a75"];

/**
 * Mounds and the tabletop, meshed from the very profile the wheels ride on.
 * Edges tuck just under the dirt road ribbon so they blend into the track.
 */
function earthworksGeometry(features: Feature[]) {
  const parts: THREE.BufferGeometry[] = [];
  const step = 0.25;
  const c = new THREE.Color();
  for (const f of features) {
    if (f.kind !== "mound" && f.kind !== "table") continue;
    const nu = Math.ceil((f.a * 2) / step);
    const nv = Math.ceil((f.b * 2) / step);
    const pos: number[] = [];
    const col: number[] = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = -f.a + (i / nu) * f.a * 2;
        const v = -f.b + (j / nv) * f.b * 2;
        const x = f.x + f.tx * u - f.tz * v;
        const z = f.z + f.tz * u + f.tx * v;
        const p = featureProfile(f, u, v);
        const ground = heightAt(x, z);
        const y = p > 0.01 ? Math.max(ground, f.y + p) + 0.07 : ground + 0.02;
        pos.push(x, y, z);
        c.copy(DIRT).lerp(DIRT_TOP, Math.min(1, p / Math.max(f.h, 0.01)));
        col.push(c.r, c.g, c.b);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const b = a + nu + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(index);
    parts.push(g.toNonIndexed());
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return merged;
}

function coneGeometry() {
  return mergeGeometries([
    paint(new THREE.BoxGeometry(0.55, 0.05, 0.55).translate(0, 0.025, 0), "#2b2733"),
    paint(new THREE.ConeGeometry(0.24, 0.7, 10).translate(0, 0.4, 0), "#ff6b2c"),
    paint(new THREE.CylinderGeometry(0.15, 0.18, 0.12, 10).translate(0, 0.4, 0), "#fff7ea"),
  ])!;
}

function crateGeometry() {
  const parts = [paint(new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(0, 0.45, 0), "#b07a4a")];
  // Darker battens across each side face.
  for (const s of [1, -1]) {
    parts.push(paint(new THREE.BoxGeometry(0.94, 0.12, 0.04).translate(0, 0.45, s * 0.45), "#7d5233"));
    parts.push(paint(new THREE.BoxGeometry(0.04, 0.12, 0.94).translate(s * 0.45, 0.45, 0), "#7d5233"));
  }
  return mergeGeometries(parts)!;
}

/** Instanced mesh fed with ready-made matrices and colours. */
function MatrixSet({
  matrices,
  colors,
  geometry,
  material,
  castShadow = false,
}: {
  matrices: THREE.Matrix4[];
  colors?: THREE.Color[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, colors]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} castShadow={castShadow} receiveShadow />;
}

const pick = (list: string[], t: number) => new THREE.Color(list[Math.floor(t * list.length) % list.length]);

export function Course() {
  const course = getCourse();
  const broken = useBrokenProps();

  const assets = useMemo(() => {
    const flat = { vertexColors: true, flatShading: true, roughness: 0.9 };
    return {
      earthGeo: earthworksGeometry(course.features),
      earthMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      logGeo: paint(new THREE.CylinderGeometry(1, 1, 1, 10), "#7a5034"),
      rockGeo: rockGeometry(17),
      boulderGeo: rockGeometry(29),
      coneGeo: coneGeometry(),
      crateGeo: crateGeometry(),
      mat: new THREE.MeshStandardMaterial(flat),
    };
  }, [course]);
  useEffect(
    () => () => {
      Object.values(assets).forEach((a) => a?.dispose());
    },
    [assets],
  );

  const sets = useMemo(() => {
    const m = () => new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const logs: THREE.Matrix4[] = [];
    const rocks: THREE.Matrix4[] = [];
    const rockColors: THREE.Color[] = [];
    for (const f of course.features) {
      const yaw = Math.atan2(f.tx, f.tz);
      if (f.kind === "log") {
        // Cylinder axis (local y) laid across the track.
        q.setFromUnitVectors(up, new THREE.Vector3(-f.tz, 0, f.tx));
        logs.push(m().compose(new THREE.Vector3(f.x, f.y + f.a * 0.4, f.z), q, new THREE.Vector3(f.a, f.b * 2, f.a)));
      } else if (f.kind === "rock") {
        // The jittered rock is ~0.75 tall per unit scale; centred at the base, its dome shows.
        q.setFromAxisAngle(up, yaw);
        rocks.push(m().compose(new THREE.Vector3(f.x, f.y, f.z), q, new THREE.Vector3(f.b, f.h / 0.75, f.a)));
        rockColors.push(pick(ROCKS, f.tint));
      }
    }
    const boulders = course.boulders.map((b) =>
      m().compose(new THREE.Vector3(b.x, b.y - b.h * 0.15, b.z), q.setFromAxisAngle(up, b.rot), new THREE.Vector3(b.r, b.h / 0.75, b.r)),
    );
    const boulderColors = course.boulders.map((b) => pick(BOULDERS, b.tint));
    return { logs, rocks, rockColors, boulders, boulderColors };
  }, [course]);

  // Smashed cones and crates collapse to zero scale; Debris draws their pieces.
  const props = useMemo(() => {
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const of = (kind: "cone" | "crate") =>
      course.props
        .filter((p) => p.kind === kind)
        .map((p) => {
          const s = broken.has(breakKey(p.kind, p.index)) ? 0 : 1;
          return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.yaw), new THREE.Vector3(s, s, s));
        });
    return { cones: of("cone"), crates: of("crate") };
  }, [course, broken]);

  return (
    <group>
      {assets.earthGeo && <mesh geometry={assets.earthGeo} material={assets.earthMat} receiveShadow castShadow />}
      <MatrixSet matrices={sets.logs} geometry={assets.logGeo} material={assets.mat} castShadow />
      <MatrixSet matrices={sets.rocks} colors={sets.rockColors} geometry={assets.rockGeo} material={assets.mat} castShadow />
      <MatrixSet matrices={sets.boulders} colors={sets.boulderColors} geometry={assets.boulderGeo} material={assets.mat} castShadow />
      <MatrixSet matrices={props.cones} geometry={assets.coneGeo} material={assets.mat} castShadow />
      <MatrixSet matrices={props.crates} geometry={assets.crateGeo} material={assets.mat} castShadow />
    </group>
  );
}
