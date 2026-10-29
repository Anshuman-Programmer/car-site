"use client";

import { ArrowRight, ChevronDown, Play } from "lucide-react";
import { profile } from "@/data/profile";
import { yearsLabel } from "./content";

export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <section
      aria-labelledby="intro-title"
      className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-ink/70 via-ink/10 to-transparent p-4 pb-8 sm:p-8 md:justify-center md:bg-gradient-to-r md:from-ink/65 md:via-ink/15"
    >
      <div className="pointer-events-auto max-w-xl animate-rise">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cream/15 bg-ink/40 px-3 py-1 text-xs font-medium text-cream/80 backdrop-blur">
          <span className="size-1.5 rounded-full bg-moss" aria-hidden />
          Interactive portfolio · {yearsLabel} shipping software
        </p>
        <h1 id="intro-title" className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
          {profile.name.split(" ")[0]}
          <br />
          <span className="bg-gradient-to-r from-gold via-coral to-blossom bg-clip-text text-transparent">{profile.name.split(" ").slice(1).join(" ")}</span>
        </h1>
        <p className="mt-4 text-lg font-semibold text-cream/90 sm:text-xl">{profile.headline}</p>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-cream/70">
          React, Next.js, Node.js &amp; Python — web, mobile and APIs. {profile.tagline}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            autoFocus
            className="group inline-flex items-center gap-3 rounded-2xl bg-coral px-6 py-4 font-display text-lg font-bold text-ink shadow-[0_14px_40px_-12px_#ff7a59] transition hover:-translate-y-0.5 hover:bg-[#ff8d70]"
          >
            <Play className="size-5 fill-ink" aria-hidden />
            Start driving
          </button>
          <a
            href="/portfolio"
            className="inline-flex items-center gap-2 rounded-2xl border border-cream/20 bg-ink/40 px-5 py-4 font-semibold text-cream backdrop-blur transition hover:bg-ink/60"
          >
            View portfolio <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
        <p className="mt-4 text-xs text-cream/50">Keyboard: WASD or arrows · Touch controls on phones · Sound is off until you turn it on</p>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center text-cream/70 md:flex">
        <span className="text-xs font-medium uppercase tracking-[0.25em]">Your ride is waiting</span>
        <ChevronDown className="mt-1 size-6 animate-nudge" aria-hidden />
      </div>
    </section>
  );
}

/** Short instructions shown when driving begins; dismissed on first throttle or after a few seconds. */
export function DriveTips({ touch, onDone }: { touch: boolean; onDone: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/4 z-20 flex justify-center px-4">
      <div className="glass pointer-events-auto max-w-md animate-rise rounded-3xl p-5 text-center" role="status">
        <p className="font-display text-xl font-bold">Explore the island</p>
        {touch ? (
          <p className="mt-2 text-sm text-cream/75">
            Drag the pad on the left to steer, hold the pedals on the right. Pull up to a glowing ring and tap the prompt to step
            inside.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-cream/75">
            <span className="kbd">W</span> <span className="kbd">A</span> <span className="kbd">S</span> <span className="kbd">D</span> or arrows to
            drive. Stop on a glowing ring and press <span className="kbd">E</span>. <span className="kbd">M</span> opens the map.
          </p>
        )}
        <button type="button" onClick={onDone} className="mt-3 text-xs font-semibold text-gold hover:underline">
          Got it
        </button>
      </div>
    </div>
  );
}
