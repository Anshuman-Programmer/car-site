"use client";

import { useEffect } from "react";
import { clearInput, input, vehicle } from "@/lib/vehicleState";
import { drivingEnabled, usePortfolio } from "@/lib/store";
import { destinationById } from "@/data/locations";
import { audio } from "@/lib/audio";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

const DRIVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

/** Keyboard driving + shortcuts. Never intercepts typing, and releases everything on blur. */
export function useDrivingControls() {
  useEffect(() => {
    const held = new Set<string>();

    const sync = () => {
      input.keyThrottle = held.has("KeyW") || held.has("ArrowUp") ? 1 : 0;
      input.keyBrake = held.has("KeyS") || held.has("ArrowDown") ? 1 : 0;
      const left = held.has("KeyA") || held.has("ArrowLeft");
      const right = held.has("KeyD") || held.has("ArrowRight");
      input.keySteer = (right ? 1 : 0) - (left ? 1 : 0);
      input.keyHandbrake = held.has("Space");
    };

    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = usePortfolio.getState();
      const driving = drivingEnabled();

      if (DRIVE_KEYS.has(e.code)) {
        if (!driving) return;
        // Stop arrows/space from scrolling or re-clicking a focused HUD button.
        e.preventDefault();
        held.add(e.code);
        sync();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyE" && driving && s.nearby) {
        e.preventDefault();
        s.openPanel(destinationById[s.nearby].panel);
        audio.chime("open");
      } else if (e.code === "KeyR" && driving) {
        vehicle.resetRequested = true;
      } else if (e.code === "KeyM" && s.phase === "driving" && !s.activePanel) {
        s.setMapOpen(!s.mapOpen);
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (held.delete(e.code)) sync();
    };

    const release = () => {
      held.clear();
      clearInput();
    };
    const onVisibility = () => {
      if (document.hidden) {
        release();
        audio.suspend();
      } else audio.resume();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibility);
    // Opening a panel lets go of the pedals.
    const unsub = usePortfolio.subscribe((s, prev) => {
      if (s.activePanel && !prev.activePanel) release();
    });
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibility);
      unsub();
      release();
    };
  }, []);
}
