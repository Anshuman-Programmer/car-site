"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { heightAt } from "@/lib/world/terrain";
import { LAKE_LEVEL } from "@/lib/world/layout";
import {
  CABIN,
  DOCK,
  GARAGE,
  GROVE,
  KIOSKS,
  LIGHTHOUSE,
  milestones,
  MONOLITHS,
  TERMINAL,
  TOWER,
} from "@/lib/world/structures";
import { usePortfolio } from "@/lib/store";
import { palette } from "./materials";

const FONT = "/fonts/bricolage-700.woff";

type V3 = [number, number, number];

function B({ p, s, c, r, e, ei = 1.5, cast = true }: { p: V3; s: V3; c: THREE.ColorRepresentation; r?: V3; e?: string; ei?: number; cast?: boolean }) {
  return (
    <mesh position={p} rotation={r} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        roughness={0.85}
        emissive={e ?? "#000000"}
        emissiveIntensity={e ? ei : 0}
        toneMapped={!e}
        flatShading
      />
    </mesh>
  );
}

function prism(w: number, h: number, len: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

/** Wall-coloured gable with two roof slabs; ridge runs along local z. */
function GableRoof({ w, h, len, y, wall, roof }: { w: number; h: number; len: number; y: number; wall: THREE.ColorRepresentation; roof: THREE.ColorRepresentation }) {
  const geo = useMemo(() => prism(w, h, len), [w, h, len]);
  const angle = Math.atan2(h, w / 2);
  const slant = Math.hypot(w / 2, h) + 0.45;
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={wall} roughness={0.9} flatShading />
      </mesh>
      {[1, -1].map((side) => (
        <mesh
          key={side}
          position={[(side * w) / 4 + side * 0.08, h / 2 + 0.14, 0]}
          rotation={[0, 0, -side * angle]}
          castShadow
        >
          <boxGeometry args={[slant, 0.22, len + 0.9]} />
          <meshStandardMaterial color={roof} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Label({ text, p, size = 0.5, color = "#fff7ea", r, maxWidth }: { text: string; p: V3; size?: number; color?: string; r?: V3; maxWidth?: number }) {
  return (
    <Text font={FONT} fontSize={size} color={color} position={p} rotation={r} anchorX="center" anchorY="middle" maxWidth={maxWidth} textAlign="center">
      {text}
    </Text>
  );
}

// ------------------------------------------------------------------ Home Base

function Smoke({ origin }: { origin: V3 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 9;
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const life = (t * 0.16 + i / count) % 1;
      const s = 0.35 + life * 1.2;
      m.makeScale(s, s, s);
      m.setPosition(origin[0] + Math.sin(life * 4 + i) * 0.5 + life * 1.8, origin[1] + life * 7, origin[2] + Math.cos(life * 3 + i) * 0.4);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#e9e4ee" transparent opacity={0.42} depthWrite={false} flatShading />
    </instancedMesh>
  );
}

function Cabin() {
  const y = heightAt(CABIN.x, CABIN.z);
  const wall = "#b0744a";
  const log = "#80502f";
  return (
    <group position={[CABIN.x, y, CABIN.z]} rotation={[0, CABIN.yaw, 0]}>
      <B p={[0, 0.25, 0]} s={[7.2, 0.6, 6.6]} c="#9b9187" />
      <B p={[0, 1.95, 0]} s={[6.4, 2.9, 5.8]} c={wall} />
      {[0.9, 1.6, 2.3, 3.0].map((ly) => (
        <group key={ly}>
          <B p={[3.22, ly, 0]} s={[0.06, 0.14, 5.8]} c={log} cast={false} />
          <B p={[-3.22, ly, 0]} s={[0.06, 0.14, 5.8]} c={log} cast={false} />
        </group>
      ))}
      <GableRoof w={6.6} h={2.4} len={5.8} y={3.4} wall={wall} roof={palette.roof} />
      {/* front: door, windows, round gable window */}
      <B p={[0, 1.35, 2.92]} s={[1.1, 2.0, 0.1]} c="#5a3420" />
      <B p={[-2.05, 1.95, 2.92]} s={[1.1, 0.9, 0.1]} c="#ffd28a" e="#ffb347" ei={1.4} />
      <B p={[2.05, 1.95, 2.92]} s={[1.1, 0.9, 0.1]} c="#ffd28a" e="#ffb347" ei={1.4} />
      <mesh position={[0, 4.35, 2.92]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.1, 10]} />
        <meshStandardMaterial color="#ffd28a" emissive="#ffb347" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {[3.22, -3.22].map((x) => (
        <B key={x} p={[x, 1.95, 0.6]} s={[0.1, 0.9, 1.2]} c="#ffd28a" e="#ffb347" ei={1.2} />
      ))}
      {/* porch */}
      <B p={[0, 0.42, 3.9]} s={[5.6, 0.22, 2.0]} c={palette.wood} />
      {[2.6, -2.6].map((x) => (
        <B key={x} p={[x, 1.6, 4.75]} s={[0.2, 2.4, 0.2]} c={palette.woodDark} />
      ))}
      <B p={[0, 2.85, 4.1]} s={[6.0, 0.18, 2.3]} r={[0.14, 0, 0]} c={palette.roof} />
      {/* lantern by the door */}
      <B p={[0.95, 2.1, 3.05]} s={[0.22, 0.32, 0.22]} c="#ffe2a8" e="#ffb347" ei={2.5} />
      {/* chimney */}
      <B p={[-1.6, 5.2, -1.6]} s={[0.9, 2.6, 0.9]} c="#8f8378" />
      <Smoke origin={[-1.6, 6.6, -1.6]} />
      {/* log pile + bench */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[3.9, 0.35 + i * 0.36, -1.2 + (i % 2) * 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 1.8, 7]} />
          <meshStandardMaterial color="#8a5a3a" flatShading />
        </mesh>
      ))}
      <B p={[-2.0, 0.75, 4.3]} s={[1.4, 0.12, 0.45]} c={palette.wood} />
      {/* name board */}
      <group position={[4.6, 0, 6.2]} rotation={[0, -0.5, 0]}>
        <B p={[-0.9, 0.9, 0]} s={[0.14, 1.8, 0.14]} c={palette.woodDark} />
        <B p={[0.9, 0.9, 0]} s={[0.14, 1.8, 0.14]} c={palette.woodDark} />
        <B p={[0, 1.55, 0]} s={[2.4, 0.75, 0.12]} c={palette.cream} />
        <Label text="HOME BASE" p={[0, 1.6, 0.08]} size={0.3} color="#3b2a20" />
        <Label text="about me" p={[0, 1.33, 0.08]} size={0.17} color="#7a5a44" />
      </group>
      {/* fence */}
      {Array.from({ length: 7 }, (_, i) => (
        <B key={i} p={[-5.2, 0.55, -2.6 + i * 1.2]} s={[0.12, 1.1, 0.12]} c={palette.woodDark} />
      ))}
      <B p={[-5.2, 0.85, 1]} s={[0.08, 0.1, 7.4]} c={palette.wood} cast={false} />
    </group>
  );
}

// ------------------------------------------------------------------ Project Garage

const neonMaterial = (color: string) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false });

function Kiosk({ k }: { k: (typeof KIOSKS)[number] }) {
  const y = heightAt(k.x, k.z);
  const [hover, setHover] = useState(false);
  const color = k.project.color;
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (screenMat.current) screenMat.current.emissiveIntensity = (hover ? 0.75 : 0.32) + Math.sin(clock.elapsedTime * 2 + k.x) * 0.05;
  });
  const open = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    usePortfolio.getState().openPanel("projects", k.project.id);
  };
  return (
    <group
      position={[k.x, y, k.z]}
      rotation={[0, k.yaw, 0]}
      onClick={open}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.15, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hover ? 0.9 : 0.55} toneMapped={false} />
      </mesh>
      <B p={[0, 0.6, 0]} s={[0.8, 1.2, 0.55]} c={palette.charcoal} />
      <group position={[0, 1.75, 0.05]} rotation={[-0.2, 0, 0]}>
        <B p={[0, 0, -0.06]} s={[1.9, 1.15, 0.08]} c={palette.charcoal} />
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.75, 1.0, 0.04]} />
          <meshStandardMaterial ref={screenMat} color="#14121c" emissive={color} emissiveIntensity={0.35} roughness={0.3} toneMapped={false} />
        </mesh>
        <Label text={k.project.name} p={[0, 0.12, 0.04]} size={0.17} maxWidth={1.6} />
        <Label text={k.project.kind.toUpperCase()} p={[0, -0.3, 0.04]} size={0.09} color={color} />
      </group>
    </group>
  );
}

function Garage() {
  const y = heightAt(GARAGE.x, GARAGE.z);
  const wall = "#3b3546";
  const pink = useMemo(() => neonMaterial("#ff5d8f"), []);
  const violet = useMemo(() => neonMaterial("#8b7bff"), []);
  const blue = useMemo(() => neonMaterial("#4cc9f0"), []);
  return (
    <group>
      <group position={[GARAGE.x, y, GARAGE.z]} rotation={[0, GARAGE.yaw, 0]}>
        <B p={[0, 0.15, 0]} s={[13.4, 0.3, 10.4]} c="#6f6a75" />
        {/* back + sides */}
        <B p={[0, 2.8, -4.85]} s={[13, 5.3, 0.4]} c={wall} />
        <B p={[6.3, 2.8, 0]} s={[0.4, 5.3, 10]} c={wall} />
        <B p={[-6.3, 2.8, 0]} s={[0.4, 5.3, 10]} c={wall} />
        {/* front pillars + lintel */}
        <B p={[5.3, 2.8, 4.8]} s={[2.4, 5.3, 0.4]} c={wall} />
        <B p={[-5.3, 2.8, 4.8]} s={[2.4, 5.3, 0.4]} c={wall} />
        <B p={[0, 4.75, 4.8]} s={[8.4, 1.4, 0.4]} c={wall} />
        {/* roof with sawtooth skylights */}
        <B p={[0, 5.6, 0.2]} s={[13.8, 0.35, 11]} c="#2d2836" />
        {[-3, 1].map((z) => (
          <mesh key={z} position={[0, 5.75, z]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <primitive object={prism(2.6, 1.4, 12.6)} attach="geometry" />
            <meshStandardMaterial color="#47405a" flatShading />
          </mesh>
        ))}
        {/* neon trim (reference B's edge lighting, used sparingly) */}
        <mesh position={[0, 5.42, 5.05]} material={violet}>
          <boxGeometry args={[13.6, 0.08, 0.08]} />
        </mesh>
        {[6.85, -6.85].map((x) => (
          <mesh key={x} position={[x, 2.8, 5.05]} material={blue}>
            <boxGeometry args={[0.08, 5.2, 0.08]} />
          </mesh>
        ))}
        <Text font={FONT} fontSize={0.78} position={[0, 4.75, 5.03]} anchorX="center" anchorY="middle" material={pink}>
          PROJECT GARAGE
        </Text>
        {/* interior: floor stripe, workbench, tool wall, lift */}
        <B p={[0, 0.32, 1]} s={[3.2, 0.03, 7]} c="#f2c14e" cast={false} />
        <B p={[-4.4, 0.95, -3.6]} s={[3, 1.2, 1.2]} c={palette.wood} />
        <B p={[-4.4, 2.6, -4.55]} s={[3.2, 1.8, 0.1]} c="#4a4458" />
        {[-5.4, -4.7, -4.0, -3.3].map((x, i) => (
          <B key={x} p={[x, 2.6 + (i % 2) * 0.3, -4.45]} s={[0.15, 0.7, 0.08]} c={["#ff5d8f", "#4cc9f0", "#ffd166", "#7ee0b5"][i]} cast={false} />
        ))}
        <B p={[3.8, 0.45, -1]} s={[0.3, 0.6, 4]} c="#e4572e" />
        <B p={[5.2, 0.45, -1]} s={[0.3, 0.6, 4]} c="#e4572e" />
        <mesh position={[0, 5.2, 0]} material={violet}>
          <boxGeometry args={[0.15, 0.06, 8]} />
        </mesh>
      </group>
      {KIOSKS.map((k) => (
        <Kiosk key={k.project.id} k={k} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ Skills Grove

function Campfire({ p }: { p: V3 }) {
  const flame = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (flame.current) flame.current.scale.set(1 + Math.sin(t * 9) * 0.06, 1 + Math.sin(t * 13 + 1) * 0.12, 1 + Math.cos(t * 8) * 0.06);
    if (inner.current) inner.current.scale.y = 1 + Math.sin(t * 15) * 0.15;
  });
  return (
    <group position={p}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1]} castShadow>
            <dodecahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial color="#8f877f" flatShading />
          </mesh>
        );
      })}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, (i / 3) * Math.PI]}>
          <cylinderGeometry args={[0.1, 0.12, 1.5, 6]} />
          <meshStandardMaterial color="#6b4630" flatShading />
        </mesh>
      ))}
      <mesh ref={flame} position={[0, 0.75, 0]}>
        <coneGeometry args={[0.45, 1.3, 6]} />
        <meshBasicMaterial color="#ff8c42" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh ref={inner} position={[0, 0.6, 0]}>
        <coneGeometry args={[0.25, 0.8, 5]} />
        <meshBasicMaterial color="#ffe08a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[2.2, 12, 8]} />
        <meshBasicMaterial color="#ff9f43" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Monolith({ m }: { m: (typeof MONOLITHS)[number] }) {
  const y = heightAt(m.x, m.z);
  const gem = useRef<THREE.Mesh>(null);
  const runeMat = useMemo(() => neonMaterial(m.category.color), [m.category.color]);
  useFrame(({ clock }) => {
    if (gem.current) {
      gem.current.position.y = 4.1 + Math.sin(clock.elapsedTime * 1.4 + m.x) * 0.18;
      gem.current.rotation.y = clock.elapsedTime * 0.8;
    }
  });
  return (
    <group position={[m.x, y, m.z]} rotation={[0, m.yaw, 0]}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.85, 3.2, 4, 1]} />
        <meshStandardMaterial color="#8e8a9c" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.7, 0.56]} material={runeMat}>
        <boxGeometry args={[0.08, 2.0, 0.04]} />
      </mesh>
      <Label text={m.category.title} p={[0, 3.55, 0.25]} size={0.26} maxWidth={2.4} />
      <Label text={m.category.title} p={[0, 3.55, -0.25]} r={[0, Math.PI, 0]} size={0.26} maxWidth={2.4} />
      <mesh ref={gem} position={[0, 4.1, 0]} material={runeMat}>
        <octahedronGeometry args={[0.24, 0]} />
      </mesh>
    </group>
  );
}

function SkillsGrove() {
  const y = heightAt(GROVE.x, GROVE.z);
  return (
    <group>
      {MONOLITHS.map((m) => (
        <Monolith key={m.category.id} m={m} />
      ))}
      <Campfire p={[GROVE.x, y, GROVE.z]} />
      <mesh position={[GROVE.x, y + 0.04, GROVE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[GROVE.radius - 0.4, GROVE.radius + 0.4, 48]} />
        <meshBasicMaterial color="#7ee0b5" transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ Experience Tower

function Tower() {
  const y = heightAt(TOWER.x, TOWER.z);
  const beacon = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (beacon.current) beacon.current.rotation.y += dt * 1.2;
  });
  const legs: V3[] = [
    [1.9, 0, 1.9],
    [-1.9, 0, 1.9],
    [1.9, 0, -1.9],
    [-1.9, 0, -1.9],
  ];
  const H = 9;
  return (
    <group position={[TOWER.x, y, TOWER.z]} rotation={[0, TOWER.yaw, 0]}>
      {legs.map(([x, , z], i) => (
        <mesh key={i} position={[x * 0.85, H / 2, z * 0.85]} rotation={[z * 0.03, 0, -x * 0.03]} castShadow>
          <cylinderGeometry args={[0.16, 0.24, H, 6]} />
          <meshStandardMaterial color={palette.woodDark} flatShading />
        </mesh>
      ))}
      {[2.2, 4.6, 7].map((by) => (
        <group key={by}>
          <B p={[0, by, 1.6]} s={[3.6, 0.16, 0.16]} c={palette.wood} />
          <B p={[0, by, -1.6]} s={[3.6, 0.16, 0.16]} c={palette.wood} />
          <B p={[1.6, by, 0]} s={[0.16, 0.16, 3.6]} c={palette.wood} />
          <B p={[-1.6, by, 0]} s={[0.16, 0.16, 3.6]} c={palette.wood} />
        </group>
      ))}
      <B p={[0, 3.4, 1.6]} s={[0.12, 4.6, 0.12]} r={[0, 0, 0.7]} c={palette.wood} />
      <B p={[0, 3.4, -1.6]} s={[0.12, 4.6, 0.12]} r={[0, 0, -0.7]} c={palette.wood} />
      <B p={[0, H, 0]} s={[4.8, 0.3, 4.8]} c={palette.wood} />
      {[2.3, -2.3].map((v) => (
        <group key={v}>
          <B p={[v, H + 0.6, 0]} s={[0.1, 0.1, 4.6]} c={palette.woodDark} />
          <B p={[0, H + 0.6, v]} s={[4.6, 0.1, 0.1]} c={palette.woodDark} />
        </group>
      ))}
      {legs.map(([x, , z], i) => (
        <B key={i} p={[x * 1.1, H + 1.2, z * 1.1]} s={[0.14, 2.4, 0.14]} c={palette.woodDark} />
      ))}
      <mesh position={[0, H + 3.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.6, 1.8, 4]} />
        <meshStandardMaterial color="#3d6e6a" flatShading />
      </mesh>
      {/* ladder */}
      <B p={[0.4, H / 2, 2.35]} s={[0.08, H, 0.08]} c={palette.woodDark} />
      <B p={[-0.4, H / 2, 2.35]} s={[0.08, H, 0.08]} c={palette.woodDark} />
      {Array.from({ length: 14 }, (_, i) => (
        <B key={i} p={[0, 0.5 + i * 0.62, 2.35]} s={[0.8, 0.06, 0.06]} c={palette.wood} cast={false} />
      ))}
      {/* antenna + rotating beacon */}
      <B p={[0, H + 4.6, 0]} s={[0.08, 2.0, 0.08]} c={palette.charcoal} />
      <group ref={beacon} position={[0, H + 5.7, 0]}>
        <mesh>
          <sphereGeometry args={[0.25, 10, 8]} />
          <meshBasicMaterial color="#ffd166" toneMapped={false} />
        </mesh>
        <mesh position={[0.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.5, 1.8, 10, 1, true]} />
          <meshBasicMaterial color="#ffd166" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position={[0, 0, 3.8]}>
        <B p={[0, 1.2, 0]} s={[2.8, 0.8, 0.12]} c={palette.cream} />
        <B p={[-1.2, 0.6, -0.05]} s={[0.12, 1.2, 0.12]} c={palette.woodDark} />
        <B p={[1.2, 0.6, -0.05]} s={[0.12, 1.2, 0.12]} c={palette.woodDark} />
        <Label text="EXPERIENCE TOWER" p={[0, 1.25, 0.07]} size={0.24} color="#3b2a20" />
      </group>
    </group>
  );
}

function Milestones() {
  const items = useMemo(() => milestones().map((m) => ({ ...m, y: heightAt(m.x, m.z) })), []);
  return (
    <group>
      {items.map((m) => (
        <group key={m.entry.id} position={[m.x, m.y, m.z]} rotation={[0, m.yaw, 0]}>
          <B p={[0, 0.8, 0]} s={[0.14, 1.6, 0.14]} c={palette.woodDark} />
          <B p={[0, 1.65, 0]} s={[1.9, 0.85, 0.1]} c="#2f2a3a" />
          <Label text={m.entry.start.slice(0, 4)} p={[0, 1.83, 0.06]} size={0.26} color="#ffd166" />
          <Label text={m.entry.company} p={[0, 1.5, 0.06]} size={0.15} maxWidth={1.75} />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ Contact Lighthouse

function Lighthouse() {
  const y = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
  const beam = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (beam.current) beam.current.rotation.y += dt * 0.6;
  });
  const bands = ["#f6efe6", "#d9483b", "#f6efe6", "#d9483b"];
  return (
    <group position={[LIGHTHOUSE.x, y, LIGHTHOUSE.z]}>
      <B p={[0, 0.3, 0]} s={[6, 0.6, 6]} c="#9b9187" />
      {bands.map((c, i) => {
        const r0 = 2.5 - i * 0.22;
        const r1 = 2.5 - (i + 1) * 0.22;
        return (
          <mesh key={i} position={[0, 0.6 + i * 3 + 1.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[r1, r0, 3, 12]} />
            <meshStandardMaterial color={c} roughness={0.7} flatShading />
          </mesh>
        );
      })}
      <mesh position={[0, 12.75, 0]} castShadow>
        <cylinderGeometry args={[2.4, 2.4, 0.3, 14]} />
        <meshStandardMaterial color={palette.charcoal} flatShading />
      </mesh>
      <mesh position={[0, 13.4, 0]}>
        <torusGeometry args={[2.25, 0.05, 4, 24]} />
        <meshStandardMaterial color={palette.charcoal} />
      </mesh>
      <mesh position={[0, 13.8, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 1.8, 10]} />
        <meshStandardMaterial color="#fff1c1" emissive="#ffd27a" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      <mesh position={[0, 15.3, 0]} castShadow>
        <coneGeometry args={[1.6, 1.4, 10]} />
        <meshStandardMaterial color="#d9483b" flatShading />
      </mesh>
      <group ref={beam} position={[0, 13.8, 0]}>
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * 14, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
            <coneGeometry args={[2.6, 28, 16, 1, true]} />
            <meshBasicMaterial color="#fff2c4" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {/* keeper's hut */}
      <group position={[4.4, 0, 2.6]} rotation={[0, -0.6, 0]}>
        <B p={[0, 1.3, 0]} s={[2.8, 2.6, 2.4]} c="#f6efe6" />
        <GableRoof w={3.0} h={1.2} len={2.4} y={2.6} wall="#f6efe6" roof="#3d6e6a" />
        <B p={[0, 0.9, 1.22]} s={[0.8, 1.6, 0.06]} c="#3d6e6a" />
      </group>
      <group position={[6.5, 0, -3]} rotation={[0, -1.3, 0]}>
        <B p={[0, 1.1, 0]} s={[2.6, 0.75, 0.12]} c={palette.cream} />
        <B p={[-1.1, 0.55, -0.05]} s={[0.12, 1.1, 0.12]} c={palette.woodDark} />
        <B p={[1.1, 0.55, -0.05]} s={[0.12, 1.1, 0.12]} c={palette.woodDark} />
        <Label text="CONTACT" p={[0, 1.12, 0.07]} size={0.28} color="#3b2a20" />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ Hidden terminal

function Terminal() {
  const y = heightAt(TERMINAL.x, TERMINAL.z);
  const screen = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#062b14", emissive: "#3dff8a", emissiveIntensity: 0.6, toneMapped: false }),
    [],
  );
  const cursor = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (cursor.current) cursor.current.visible = Math.floor(clock.elapsedTime * 2) % 2 === 0;
  });
  return (
    <group position={[TERMINAL.x, y, TERMINAL.z]} rotation={[0, TERMINAL.yaw, 0]}>
      {/* rocky alcove */}
      {[
        [-1.8, 1, -0.4, 1.5],
        [1.8, 1, -0.4, 1.4],
        [-1.2, 2.4, -0.8, 1.2],
        [1.1, 2.5, -0.8, 1.3],
        [0, 3.2, -1, 1.5],
        [0, 1.2, -1.8, 1.8],
      ].map(([x, yy, z, s], i) => (
        <mesh key={i} position={[x, yy, z]} castShadow>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#8d8478" flatShading />
        </mesh>
      ))}
      <B p={[0, 0.5, 0.2]} s={[1.6, 1.0, 0.8]} c={palette.wood} />
      <B p={[0, 1.4, 0.05]} s={[1.0, 0.8, 0.8]} c="#d8d0c0" />
      <mesh position={[0, 1.42, 0.46]} material={screen}>
        <boxGeometry args={[0.78, 0.56, 0.02]} />
      </mesh>
      <Label text={">_ hello, explorer"} p={[0, 1.5, 0.48]} size={0.075} color="#b9ffd2" />
      <mesh ref={cursor} position={[0.18, 1.33, 0.48]}>
        <planeGeometry args={[0.05, 0.08]} />
        <meshBasicMaterial color="#b9ffd2" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.4, 1]}>
        <sphereGeometry args={[1.4, 10, 8]} />
        <meshBasicMaterial color="#3dff8a" transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ Dock

function Dock() {
  const boat = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!boat.current) return;
    const t = clock.elapsedTime;
    boat.current.position.y = LAKE_LEVEL + 0.15 + Math.sin(t * 1.3) * 0.06;
    boat.current.rotation.z = Math.sin(t * 1.1) * 0.05;
  });
  return (
    <group position={[DOCK.x, 0, DOCK.z]} rotation={[0, DOCK.yaw, 0]}>
      {Array.from({ length: 9 }, (_, i) => (
        <B key={i} p={[0, LAKE_LEVEL + 0.45, -i * 0.9]} s={[2.2, 0.12, 0.8]} c={i % 2 ? palette.wood : palette.woodDark} />
      ))}
      {[1, -1].map((x) =>
        [0, -4, -7.5].map((z) => <B key={`${x}${z}`} p={[x * 1.05, LAKE_LEVEL - 0.2, z]} s={[0.18, 1.6, 0.18]} c={palette.woodDark} />),
      )}
      <group ref={boat} position={[2.3, LAKE_LEVEL + 0.15, -5]} rotation={[0, 0.3, 0]}>
        <mesh castShadow rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.7, 0.45, 3.2, 6, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#e86f4d" side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>
    </group>
  );
}

export function Buildings() {
  return (
    <group>
      <Cabin />
      <Garage />
      <SkillsGrove />
      <Tower />
      <Milestones />
      <Lighthouse />
      <Terminal />
      <Dock />
    </group>
  );
}

