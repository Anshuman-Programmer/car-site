"use client";

import { profile } from "@/data/profile";

/**
 * There are no large assets to measure — the island is generated in the
 * browser — so this shows the real stage rather than a made-up percentage.
 */
export function LoadingScreen({ stage, visible }: { stage: "engine" | "world"; visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#ffc6a8_0%,#b49ae0_38%,#241a31_78%)] transition-opacity duration-700 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <svg viewBox="0 0 120 70" className="w-32 drop-shadow-lg" aria-hidden>
        <ellipse cx="60" cy="58" rx="52" ry="8" fill="#5fd4c4" opacity="0.55" />
        <path d="M14 52 Q20 30 42 28 Q54 18 70 24 Q96 22 106 50 Z" fill="#7fb862" />
        <path d="M14 52 L106 50 L96 60 L24 61 Z" fill="#c99766" />
        <path d="M38 30 l5 -14 l5 14 Z M48 27 l4 -11 l4 11 Z M76 26 l5 -12 l5 12 Z" fill="#2f6b4f" />
        <circle cx="66" cy="22" r="5" fill="#ff8fab" />
        <rect x="56" y="38" width="10" height="5" rx="2" fill="#ff6b4a" />
      </svg>
      <p className="mt-6 font-display text-2xl font-bold text-cream">{profile.name}</p>
      <p className="mt-1 text-sm text-cream/75" role="status" aria-live="polite">
        {stage === "engine" ? "Loading the 3D engine…" : "Raising the island and planting trees…"}
      </p>
      <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-cream/15" aria-hidden>
        <div className="h-full w-1/3 animate-shimmer rounded-full bg-cream/80" />
      </div>
      <a href="/portfolio" className="mt-8 text-xs font-semibold text-cream/80 underline underline-offset-4 hover:text-cream">
        Skip to the classic portfolio
      </a>
    </div>
  );
}
