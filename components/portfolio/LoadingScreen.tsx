"use client";

import { profile } from "@/data/profile";

const DOTS = ["#ff7a59", "#ffd166", "#7ee0b5", "#5fd4c4", "#7fb7ff", "#9b8cff", "#ff8fab"];
const SPECTRUM = `linear-gradient(90deg, ${[...DOTS, DOTS[0]].join(", ")})`;

/**
 * There are no large assets to measure — the island is generated in the
 * browser — so this shows the real stage rather than a made-up percentage.
 */
export function LoadingScreen({ stage, visible }: { stage: "engine" | "world"; visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink px-4 font-sans transition-opacity duration-700 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 blur-3xl" aria-hidden>
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-coral/50" />
        <div className="absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-violet/50" />
        <div className="absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-sea/40" />
        <div className="absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-gold/35" />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="flex h-8 items-end gap-2.5" aria-hidden>
          {DOTS.map((c, i) => (
            <span
              key={c}
              className="block h-3.5 w-3.5 animate-hop rounded-full"
              style={{ backgroundColor: c, animationDelay: `${i * 0.1}s`, boxShadow: `0 0 16px ${c}80` }}
            />
          ))}
        </div>

        <p
          className="mt-8 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl"
          style={{ backgroundImage: SPECTRUM, backgroundSize: "200% 100%" }}
        >
          {profile.name}
        </p>
        <p className="mt-2 text-sm text-cream/70" role="status" aria-live="polite">
          {stage === "engine" ? "Loading the 3D engine…" : "Raising the island and planting trees…"}
        </p>

        <div className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-cream/10" aria-hidden>
          <div className="h-full w-full animate-spectrum rounded-full" style={{ backgroundImage: SPECTRUM, backgroundSize: "200% 100%" }} />
        </div>

        <a href="/portfolio" className="mt-10 text-xs font-medium text-cream/60 underline underline-offset-4 hover:text-cream">
          Skip to the classic portfolio
        </a>
      </div>
    </div>
  );
}
