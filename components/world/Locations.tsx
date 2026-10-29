"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { destinations, destinationById } from "@/data/locations";
import { usePortfolio } from "@/lib/store";
import { vehicle } from "@/lib/vehicleState";
import { surfaceAt } from "@/lib/world/terrain";
import { audio } from "@/lib/audio";
import type { Destination, LocationId } from "@/lib/types";

/** Proximity: the nearest destination whose radius contains the car wins. */
export function LocationSystem() {
  const last = useRef<LocationId | null>(null);
  useFrame(() => {
    const s = usePortfolio.getState();
    if (s.phase !== "driving") {
      if (s.nearby) s.setNearby(null);
      return;
    }
    let best: LocationId | null = null;
    let bd = Infinity;
    for (const d of destinations) {
      const dist = Math.hypot(vehicle.x - d.position[0], vehicle.z - d.position[1]);
      if (dist < d.radius && dist < bd) {
        bd = dist;
        best = d.id;
      }
    }
    if (best !== last.current) {
      last.current = best;
      s.setNearby(best);
      if (best && !s.discovered.includes(best)) {
        s.discover(best);
        audio.chime("discover");
      }
    }
  });
  return null;
}

/** Glowing landing pad + floating gem for each destination (the "platform" from reference B). */
function Marker({ d }: { d: Destination }) {
  const y = useMemo(() => surfaceAt(d.position[0], d.position[1]), [d]);
  const ring = useRef<THREE.Mesh>(null);
  const gem = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const gemMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(d.color).multiplyScalar(1.6), toneMapped: false }),
    [d.color],
  );
  const padR = d.hidden ? 3 : 4.6;

  useFrame(({ clock }) => {
    const s = usePortfolio.getState();
    const t = clock.elapsedTime;
    const near = s.nearby === d.id;
    const calm = s.reducedMotion;
    if (ringMat.current) ringMat.current.opacity = (near ? 0.85 : 0.38) + (calm ? 0 : Math.sin(t * 2.4) * 0.08);
    if (ring.current) {
      const k = near ? 1.06 : 1 + (calm ? 0 : Math.sin(t * 1.6) * 0.025);
      ring.current.scale.set(k, k, k);
    }
    if (gem.current) {
      gem.current.position.y = y + 7.5 + (calm ? 0 : Math.sin(t * 1.3 + d.position[0]) * 0.35);
      gem.current.rotation.y = t * 0.9;
      gem.current.visible = !d.hidden || s.discovered.includes(d.id);
    }
  });

  return (
    <group>
      <mesh ref={ring} position={[d.position[0], y + 0.12, d.position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[padR - 0.35, padR, 48]} />
        <meshBasicMaterial ref={ringMat} color={d.color} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[d.position[0], y + 0.1, d.position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[padR - 0.35, 48]} />
        <meshBasicMaterial color={d.color} transparent opacity={0.1} depthWrite={false} toneMapped={false} />
      </mesh>
      {!d.hidden && (
        <mesh ref={gem} position={[d.position[0], y + 7.5, d.position[1]]} material={gemMat}>
          <octahedronGeometry args={[0.7, 0]} />
        </mesh>
      )}
    </group>
  );
}

export function LocationMarkers() {
  return (
    <group>
      {destinations.map((d) => (
        <Marker key={d.id} d={d} />
      ))}
      <Waypoint />
    </group>
  );
}

/** Beam of light at the chosen destination plus an arrow floating over the car. */
function Waypoint() {
  const beam = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Group>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const arrowMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const s = usePortfolio.getState();
    const wp = s.waypoint ? destinationById[s.waypoint] : null;
    const show = !!wp && s.phase === "driving";
    if (beam.current) beam.current.visible = show;
    if (arrow.current) arrow.current.visible = show;
    if (!wp || !show) return;
    const [x, z] = wp.position;
    const y = surfaceAt(x, z);
    if (beamMat.current) {
      beamMat.current.color.set(wp.color);
      beamMat.current.opacity = 0.2 + Math.sin(clock.elapsedTime * 3) * 0.05;
    }
    for (const m of arrowMats.current) m?.color.set(wp.color).multiplyScalar(1.5);
    beam.current!.position.set(x, y + 30, z);
    const a = arrow.current!;
    a.position.set(vehicle.x, vehicle.y + 3.4 + Math.sin(clock.elapsedTime * 3) * 0.12, vehicle.z);
    a.rotation.y = Math.atan2(x - vehicle.x, z - vehicle.z);
  });

  return (
    <>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[1.6, 2.4, 60, 16, 1, true]} />
        <meshBasicMaterial ref={beamMat} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <group ref={arrow} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.5]}>
          <coneGeometry args={[0.45, 1.0, 4]} />
          <meshBasicMaterial
            ref={(m) => {
              arrowMats.current[0] = m;
            }}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, -0.25]}>
          <boxGeometry args={[0.22, 0.12, 0.8]} />
          <meshBasicMaterial
            ref={(m) => {
              arrowMats.current[1] = m;
            }}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}
