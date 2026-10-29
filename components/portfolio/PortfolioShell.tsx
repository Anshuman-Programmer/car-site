"use client";

import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePortfolio } from "@/lib/store";
import { vehicle } from "@/lib/vehicleState";
import { audio } from "@/lib/audio";
import { useDrivingControls } from "@/hooks/useDrivingControls";
import { TopBar, DrivingHUD } from "./DrivingHUD";
import { IntroScreen, DriveTips } from "./IntroScreen";
import { LoadingScreen } from "./LoadingScreen";
import { Panels } from "./Panels";
import { DestinationMap } from "./DestinationMap";
import { MobileControls } from "./MobileControls";
import { ContentView } from "./ContentView";
import { SlowNotice } from "./SlowNotice";
import type { LocationId } from "@/lib/types";

const loadCanvas = () => import("@/components/world/PortfolioCanvas");
const PortfolioCanvas = dynamic(loadCanvas, { ssr: false });

const STORAGE_KEY = "drive-portfolio:discovered";

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") console.error("3D scene failed:", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    // Release the probe context so it doesn't count against the browser's limit.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function guessQuality(): "high" | "low" {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if ((coarse && small) || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) return "low";
  return "high";
}

export function PortfolioShell() {
  const phase = usePortfolio((s) => s.phase);
  const sceneReady = usePortfolio((s) => s.sceneReady);
  const webglFailed = usePortfolio((s) => s.webglFailed);
  const activePanel = usePortfolio((s) => s.activePanel);
  const isTouch = usePortfolio((s) => s.isTouch);
  const discovered = usePortfolio((s) => s.discovered);
  const support = usePortfolio((s) => s.webgl);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const [tips, setTips] = useState(false);

  useDrivingControls();

  // Environment, capability and saved progress — client only.
  useEffect(() => {
    const s = usePortfolio.getState();
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const env = () => s.setEnv({ reducedMotion: rm.matches, isTouch: window.matchMedia("(pointer: coarse)").matches });
    env();
    rm.addEventListener("change", env);
    const guess = guessQuality();
    s.setAutoCeiling(guess);
    s.setEffectiveQuality(guess);
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as LocationId[];
      if (Array.isArray(saved)) s.setDiscovered(saved);
    } catch {
      // Storage can be unavailable (private mode); progress just won't persist.
    }
    if (process.env.NODE_ENV !== "production") {
      // Dev-only handle for automated checks (read vehicle state, drive the store).
      (window as unknown as { __drive?: unknown }).__drive = { vehicle, store: usePortfolio };
    }
    const ok = hasWebGL();
    s.setWebgl(ok ? "ok" : "none");
    if (ok) loadCanvas().then(() => setEngineLoaded(true)).catch(() => s.setWebglFailed());
    return () => {
      rm.removeEventListener("change", env);
      audio.dispose();
      usePortfolio.getState().setSound(false);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(discovered));
    } catch {}
  }, [discovered]);

  // Hide the tips once the visitor gets going.
  useEffect(() => {
    if (!tips) return;
    const t = window.setTimeout(() => setTips(false), 9000);
    let id = 0;
    const watch = () => {
      if (Math.abs(vehicle.speed) > 4) setTips(false);
      else id = requestAnimationFrame(watch);
    };
    id = requestAnimationFrame(watch);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [tips]);

  const start = useCallback(() => {
    usePortfolio.getState().setPhase("driving");
    setTips(true);
    // Move focus off the (now unmounted) start button so keys go to the page.
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  const onSceneError = useCallback(() => usePortfolio.getState().setWebglFailed(), []);

  if (support === "none" || webglFailed) {
    return (
      <ContentView
        showDriveLink={false}
        notice={
          <div className="rounded-2xl border border-gold/30 bg-gold/[0.07] p-4 text-sm text-cream/85" role="status">
            {webglFailed
              ? "The 3D island stopped rendering on this device, so here's the full portfolio instead."
              : "Your browser doesn't support WebGL, so the drivable island can't load — here's the full portfolio instead."}{" "}
            {webglFailed && (
              <button type="button" className="font-semibold text-gold underline" onClick={() => window.location.reload()}>
                Try the island again
              </button>
            )}
          </div>
        }
      />
    );
  }

  const driving = phase === "driving";
  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      {support === "ok" && (
        <SceneBoundary onError={onSceneError}>
          <PortfolioCanvas />
        </SceneBoundary>
      )}

      {phase !== "driving" && <IntroScreen onStart={start} />}
      <TopBar />
      {driving && <DrivingHUD />}
      {driving && tips && !activePanel && <DriveTips touch={isTouch} onDone={() => setTips(false)} />}
      {driving && isTouch && !activePanel && <MobileControls />}
      {sceneReady && <SlowNotice />}
      <DestinationMap />
      <Panels />

      <LoadingScreen stage={engineLoaded ? "world" : "engine"} visible={!sceneReady} />
      <noscript>
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink p-6 text-center">
          <p>
            The drivable island needs JavaScript. <a href="/portfolio" className="text-gold underline">Open the classic portfolio</a>.
          </p>
        </div>
      </noscript>
    </div>
  );
}
