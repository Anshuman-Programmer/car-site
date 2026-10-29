"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { vehicle } from "@/lib/vehicleState";

/** Late-afternoon sun: warm key from the west, cool sky fill, peach haze on the horizon. */
export const SUN_DIR = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();
export const FOG_COLOR = "#f1bfae";

export function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uSun: { value: SUN_DIR },
          uTop: { value: new THREE.Color("#3c4f9e") },
          uMid: { value: new THREE.Color("#b49ae0") },
          uHorizon: { value: new THREE.Color("#ffc6a8") },
          uBelow: { value: new THREE.Color(FOG_COLOR) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
            gl_Position.z = gl_Position.w; // always at the far plane
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun, uTop, uMid, uHorizon, uBelow;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 col = mix(uHorizon, uMid, smoothstep(0.02, 0.35, h));
            col = mix(col, uTop, smoothstep(0.3, 0.95, h));
            col = mix(col, uBelow, smoothstep(0.02, -0.15, h));
            float sd = max(dot(normalize(vDir), normalize(uSun)), 0.0);
            col += vec3(1.0, 0.75, 0.45) * pow(sd, 18.0) * 0.55;
            col += vec3(1.0, 0.93, 0.8) * smoothstep(0.9985, 0.9995, sd);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[800, 32, 16]} />
    </mesh>
  );
}

export function Lighting({ quality }: { quality: "high" | "low" }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);

  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    // Shadow frustum follows the car so a small shadow map stays sharp.
    target.position.set(vehicle.x, vehicle.y, vehicle.z);
    l.position.set(vehicle.x + SUN_DIR.x * 120, vehicle.y + SUN_DIR.y * 120, vehicle.z + SUN_DIR.z * 120);
    l.target = target;
  });

  const shadows = quality === "high";
  const size = shadows ? 2048 : 1024;
  return (
    <>
      <hemisphereLight args={["#cfe0ff", "#8a6a4f", 1.05]} />
      <ambientLight intensity={0.18} color="#ffd9c2" />
      <directionalLight
        ref={sun}
        color="#ffd7a3"
        intensity={2.7}
        castShadow={shadows}
        shadow-mapSize={[size, size]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {/* soft cool rim from the opposite side */}
      <directionalLight color="#8fa8ff" intensity={0.35} position={[80, 60, -90]} />
    </>
  );
}
