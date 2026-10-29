"use client";

import { create } from "zustand";
import type { LocationId, PanelId, Phase, QualityMode } from "./types";

interface PortfolioState {
  phase: Phase;
  sceneReady: boolean;
  webglFailed: boolean;
  webgl: "checking" | "ok" | "none";
  activePanel: PanelId | null;
  selectedProject: string | null;
  nearby: LocationId | null;
  discovered: LocationId[];
  waypoint: LocationId | null;
  soundOn: boolean;
  quality: QualityMode;
  effectiveQuality: "high" | "low";
  /** Best tier Auto may climb back to — set from the device guess. */
  autoCeiling: "high" | "low";
  mapOpen: boolean;
  hudHidden: boolean;
  stuck: boolean;
  reducedMotion: boolean;
  isTouch: boolean;

  setPhase: (p: Phase) => void;
  setSceneReady: () => void;
  setWebglFailed: () => void;
  setWebgl: (v: "ok" | "none") => void;
  openPanel: (p: PanelId, project?: string | null) => void;
  closePanel: () => void;
  selectProject: (id: string | null) => void;
  setNearby: (id: LocationId | null) => void;
  discover: (id: LocationId) => void;
  setDiscovered: (ids: LocationId[]) => void;
  setWaypoint: (id: LocationId | null) => void;
  setSound: (on: boolean) => void;
  setQuality: (q: QualityMode) => void;
  setEffectiveQuality: (q: "high" | "low") => void;
  setAutoCeiling: (q: "high" | "low") => void;
  setMapOpen: (open: boolean) => void;
  setHudHidden: (hidden: boolean) => void;
  setStuck: (stuck: boolean) => void;
  setEnv: (env: { reducedMotion: boolean; isTouch: boolean }) => void;
}

export const usePortfolio = create<PortfolioState>((set, get) => ({
  phase: "loading",
  sceneReady: false,
  webglFailed: false,
  webgl: "checking",
  activePanel: null,
  selectedProject: null,
  nearby: null,
  discovered: [],
  waypoint: null,
  soundOn: false,
  quality: "auto",
  effectiveQuality: "high",
  autoCeiling: "high",
  mapOpen: false,
  hudHidden: false,
  stuck: false,
  reducedMotion: false,
  isTouch: false,

  setPhase: (phase) => set({ phase }),
  setSceneReady: () => {
    if (get().sceneReady) return;
    set({ sceneReady: true, phase: get().phase === "loading" ? "intro" : get().phase });
  },
  setWebglFailed: () => set({ webglFailed: true }),
  setWebgl: (webgl) => set({ webgl }),
  openPanel: (activePanel, project = null) => set({ activePanel, selectedProject: project, mapOpen: false }),
  closePanel: () => set({ activePanel: null, selectedProject: null }),
  selectProject: (selectedProject) => set({ selectedProject }),
  setNearby: (nearby) => {
    if (get().nearby !== nearby) set({ nearby });
  },
  discover: (id) => {
    const d = get().discovered;
    if (!d.includes(id)) set({ discovered: [...d, id] });
    if (get().waypoint === id) set({ waypoint: null });
  },
  setDiscovered: (discovered) => set({ discovered }),
  setWaypoint: (waypoint) => set({ waypoint }),
  setSound: (soundOn) => set({ soundOn }),
  setQuality: (quality) => set({ quality }),
  setEffectiveQuality: (effectiveQuality) => set({ effectiveQuality }),
  setAutoCeiling: (autoCeiling) => set({ autoCeiling }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
  setHudHidden: (hudHidden) => set({ hudHidden }),
  setStuck: (stuck) => {
    if (get().stuck !== stuck) set({ stuck });
  },
  setEnv: (env) => set(env),
}));

/** The car only listens to the driver while driving with no dialog open. */
export function drivingEnabled() {
  const s = usePortfolio.getState();
  return s.phase === "driving" && s.activePanel === null;
}
