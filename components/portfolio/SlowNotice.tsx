"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { usePortfolio } from "@/lib/store";

/**
 * If the frame rate stays very low even on Low quality, offer the classic
 * view instead of leaving the visitor with a stuttering scene.
 */
export function SlowNotice() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    let frames = 0;
    let slowWindows = 0;
    let t0 = performance.now();
    let id = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - t0 >= 2000) {
        const fps = (frames * 1000) / (now - t0);
        const low = usePortfolio.getState().effectiveQuality === "low";
        slowWindows = fps < 14 && low && !document.hidden ? slowWindows + 1 : 0;
        if (slowWindows >= 3) setShow(true);
        frames = 0;
        t0 = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [dismissed]);

  if (!show || dismissed) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-3">
      <div role="status" className="glass pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 text-sm">
        <span>
          The island is running slowly on this device.{" "}
          <a href="/portfolio" className="font-semibold text-gold underline underline-offset-4">
            Open the classic view
          </a>
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-cream/60 hover:bg-cream/10 hover:text-cream"
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
