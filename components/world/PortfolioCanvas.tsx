"use client";

import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { initWorld } from "@/lib/world";
import { usePortfolio } from "@/lib/store";
import { IslandTerrain } from "./IslandTerrain";
import { Roads } from "./Roads";
import { Water } from "./Water";
import { Vegetation } from "./Vegetation";
import { Grass } from "./Grass";
import { Buildings } from "./Buildings";
import { Props } from "./Props";
import { Course } from "./Course";
import { Debris } from "./Debris";
import { PostFX } from "./PostFX";
import { Vehicle } from "./Vehicle";
import { CameraRig } from "./CameraRig";
import { LocationMarkers, LocationSystem } from "./Locations";
import { EnvironmentEffects } from "./Effects";
import { FOG_COLOR, Lighting, Sky } from "./Atmosphere";

/**
 * Some GPUs/drivers refuse MSAA or the high-performance hint. Rather than
 * failing outright, step down through safer context attributes.
 */
function createRenderer(defaults: { canvas: unknown }, antialias: boolean) {
  const attempts: THREE.WebGLRendererParameters[] = [
    { antialias, powerPreference: "high-performance" },
    { antialias: false, powerPreference: "high-performance" },
    { antialias: false, powerPreference: "default" },
  ];
  let lastError: unknown;
  for (const a of attempts) {
    try {
      // Stencil for the car's see-through outline (xray.ts).
      const r = new THREE.WebGLRenderer({ ...(defaults as THREE.WebGLRendererParameters), canvas: defaults.canvas as HTMLCanvasElement, stencil: true, ...a });
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1;
      return r;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function Ready() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // Wait for two frames so the first visible frame is fully drawn.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => usePortfolio.getState().setSceneReady());
    });
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      usePortfolio.getState().setWebglFailed();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(id);
      canvas.removeEventListener("webglcontextlost", lost);
    };
  }, [gl]);
  return null;
}

function World() {
  const quality = usePortfolio((s) => s.effectiveQuality);
  return (
    <>
      <Sky />
      <fog attach="fog" args={[FOG_COLOR, 140, 520]} />
      <Lighting quality={quality} />
      <IslandTerrain />
      <Roads />
      <Water quality={quality} />
      <Vegetation quality={quality} />
      <Grass quality={quality} />
      <Buildings />
      <Props />
      <Course />
      <Debris />
      <LocationMarkers />
      <LocationSystem />
      <Vehicle />
      <EnvironmentEffects quality={quality} />
      <CameraRig />
      {quality === "high" && <PostFX />}
    </>
  );
}

export default function PortfolioCanvas() {
  // Bake once, synchronously, before the first frame.
  initWorld();
  const quality = usePortfolio((s) => s.effectiveQuality);
  const qualityMode = usePortfolio((s) => s.quality);
  const setEffective = usePortfolio((s) => s.setEffectiveQuality);

  return (
    <div className="absolute inset-0 touch-none">
      <Canvas
        shadows={quality === "high" ? "percentage" : false}
        dpr={quality === "high" ? [1, 1.75] : [0.85, 1.15]}
        gl={(defaults) => createRenderer(defaults, quality === "high")}
        camera={{ fov: 40, near: 0.3, far: 1200, position: [40, 30, 100] }}
        aria-hidden
      >
        {qualityMode === "auto" && (
          <PerformanceMonitor flipflops={2} onDecline={() => setEffective("low")} onIncline={() => setEffective(usePortfolio.getState().autoCeiling)} />
        )}
        <Suspense fallback={null}>
          <World />
          <Ready />
        </Suspense>
      </Canvas>
    </div>
  );
}
