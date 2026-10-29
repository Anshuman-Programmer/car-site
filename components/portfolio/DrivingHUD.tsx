"use client";

import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Keyboard,
  Map as MapIcon,
  Menu,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { usePortfolio } from "@/lib/store";
import { vehicle } from "@/lib/vehicleState";
import { destinationById, destinations } from "@/data/locations";
import { profile } from "@/data/profile";
import { audio } from "@/lib/audio";
import type { PanelId, QualityMode } from "@/lib/types";

/** Blur after a mouse click so Space (handbrake) can't re-trigger the button. */
const blurOnMouse = (e: React.MouseEvent<HTMLElement>) => {
  if (e.detail > 0) e.currentTarget.blur();
};

function IconButton({
  label,
  onClick,
  pressed,
  children,
  shortcut,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed}
      title={shortcut ? `${label} · ${shortcut}` : label}
      onClick={(e) => {
        onClick();
        blurOnMouse(e);
      }}
      className={`grid size-10 place-items-center rounded-xl border transition ${
        pressed ? "border-gold/50 bg-gold/15 text-gold" : "border-cream/10 bg-ink/40 text-cream/85 hover:bg-cream/10 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

export const NAV: { label: string; panel: PanelId }[] = [
  { label: "About", panel: "about" },
  { label: "Projects", panel: "projects" },
  { label: "Experience", panel: "experience" },
  { label: "Skills", panel: "skills" },
  { label: "Contact", panel: "contact" },
];

export function SoundToggle() {
  const soundOn = usePortfolio((s) => s.soundOn);
  const setSound = usePortfolio((s) => s.setSound);
  return (
    <IconButton
      label={soundOn ? "Mute sound" : "Turn sound on"}
      pressed={soundOn}
      onClick={() => {
        const next = !soundOn;
        setSound(next);
        void audio.setEnabled(next);
      }}
    >
      {soundOn ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
    </IconButton>
  );
}

/** Top bar: name, conventional navigation, and utility toggles. */
export function TopBar() {
  const phase = usePortfolio((s) => s.phase);
  const openPanel = usePortfolio((s) => s.openPanel);
  const mapOpen = usePortfolio((s) => s.mapOpen);
  const setMapOpen = usePortfolio((s) => s.setMapOpen);
  const hudHidden = usePortfolio((s) => s.hudHidden);
  const setHudHidden = usePortfolio((s) => s.setHudHidden);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const driving = phase === "driving";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <a href="/portfolio" className="glass-light hidden rounded-xl px-3 py-2 sm:block" aria-label={`${profile.name} — classic portfolio view`}>
          <span className="block font-display text-sm font-bold leading-none">{profile.name}</span>
          <span className="mt-1 block text-[11px] leading-none text-cream/60">{profile.headline}</span>
        </a>
        <nav aria-label="Portfolio sections" className={`${hudHidden && driving ? "hidden" : "hidden md:block"}`}>
          <ul className="glass-light flex items-center gap-0.5 rounded-xl p-1">
            {NAV.map((n) => (
              <li key={n.panel}>
                <button
                  type="button"
                  onClick={(e) => {
                    openPanel(n.panel);
                    blurOnMouse(e);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-cream/80 transition hover:bg-cream/10 hover:text-cream"
                >
                  {n.label}
                </button>
              </li>
            ))}
            <li>
              <a
                href={profile.resumePath}
                download="Anshuman-Talukdar-resume.pdf"
                className="block rounded-lg px-3 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/10"
              >
                Résumé
              </a>
            </li>
          </ul>
        </nav>
        <div className="relative md:hidden">
          <IconButton label={menu ? "Close menu" : "Open menu"} pressed={menu} onClick={() => setMenu(!menu)}>
            {menu ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </IconButton>
          {menu && (
            <nav aria-label="Portfolio sections" className="glass absolute left-0 top-12 w-56 animate-rise rounded-2xl p-2">
              <ul>
                {NAV.map((n) => (
                  <li key={n.panel}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-cream/10"
                      onClick={() => {
                        openPanel(n.panel);
                        setMenu(false);
                      }}
                    >
                      {n.label}
                    </button>
                  </li>
                ))}
                <li>
                  <a href={profile.resumePath} download="Anshuman-Talukdar-resume.pdf" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10">
                    Download résumé
                  </a>
                </li>
                <li>
                  <a href="/portfolio" className="block rounded-lg px-3 py-2.5 text-sm text-cream/75 hover:bg-cream/10">
                    Classic portfolio view
                  </a>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl p-1 glass-light">
        <SoundToggle />
        {driving && (
          <>
            <IconButton label="Map & destinations" shortcut="M" pressed={mapOpen} onClick={() => setMapOpen(!mapOpen)}>
              <MapIcon className="size-5" aria-hidden />
            </IconButton>
            <IconButton label="Reset car to the road" shortcut="R" onClick={() => (vehicle.resetRequested = true)}>
              <RotateCcw className="size-5" aria-hidden />
            </IconButton>
            <IconButton label={hudHidden ? "Show interface" : "Hide interface"} pressed={hudHidden} onClick={() => setHudHidden(!hudHidden)}>
              {hudHidden ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </IconButton>
          </>
        )}
        <div className="relative">
          <IconButton label="Graphics quality" pressed={settings} onClick={() => setSettings(!settings)}>
            <Settings2 className="size-5" aria-hidden />
          </IconButton>
          {settings && <QualityMenu onClose={() => setSettings(false)} />}
        </div>
      </div>
    </header>
  );
}

function QualityMenu({ onClose }: { onClose: () => void }) {
  const quality = usePortfolio((s) => s.quality);
  const effective = usePortfolio((s) => s.effectiveQuality);
  const setQuality = usePortfolio((s) => s.setQuality);
  const setEffective = usePortfolio((s) => s.setEffectiveQuality);
  const options: { id: QualityMode; label: string; hint: string }[] = [
    { id: "auto", label: "Auto", hint: "Adapts to your device's frame rate" },
    { id: "high", label: "High", hint: "Shadows, full foliage, antialiasing" },
    { id: "low", label: "Low", hint: "Faster on laptops and phones" },
  ];
  return (
    <div role="group" aria-label="Graphics quality" className="glass absolute right-0 top-12 w-64 animate-rise rounded-2xl p-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={quality === o.id}
          onClick={() => {
            setQuality(o.id);
            if (o.id !== "auto") setEffective(o.id);
            onClose();
          }}
          className={`w-full rounded-xl px-3 py-2 text-left transition hover:bg-cream/10 ${quality === o.id ? "bg-cream/10" : ""}`}
        >
          <span className="block text-sm font-semibold">
            {o.label}
            {o.id === "auto" && quality === "auto" && <span className="ml-1 text-xs font-normal text-cream/55">(now {effective})</span>}
          </span>
          <span className="block text-xs text-cream/55">{o.hint}</span>
        </button>
      ))}
      <a href="/portfolio" className="mt-1 block rounded-xl px-3 py-2 text-xs text-cream/65 hover:bg-cream/10">
        Prefer no 3D? Open the classic view →
      </a>
    </div>
  );
}

/** Speed in km/h from the actual simulated forward velocity, updated without React renders. */
function Speedometer() {
  const num = useRef<HTMLSpanElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let id = 0;
    const C = 2 * Math.PI * 34 * 0.75;
    const tick = () => {
      const kmh = Math.round(Math.abs(vehicle.speed) * 3.6);
      if (num.current) num.current.textContent = String(kmh);
      if (arc.current) arc.current.style.strokeDashoffset = String(C - (Math.min(kmh, 90) / 90) * C);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  const C = 2 * Math.PI * 34 * 0.75;
  return (
    <div className="glass-light relative grid size-[92px] place-items-center rounded-full" role="img" aria-label="Speedometer">
      <svg viewBox="0 0 80 80" className="absolute inset-0 rotate-[135deg]" aria-hidden>
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(255 246 234 / 0.1)" strokeWidth="5" strokeDasharray={`${C} 999`} strokeLinecap="round" />
        <circle
          ref={arc}
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="url(#spd)"
          strokeWidth="5"
          strokeDasharray={`${C} 999`}
          strokeDashoffset={C}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="spd" x1="0" x2="1">
            <stop offset="0" stopColor="#ffd166" />
            <stop offset="1" stopColor="#ff7a59" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative text-center">
        <span ref={num} className="block font-mono text-2xl font-bold leading-none">
          0
        </span>
        <span className="text-[10px] uppercase tracking-widest text-cream/55">km/h</span>
      </div>
    </div>
  );
}

function Discovery() {
  const discovered = usePortfolio((s) => s.discovered);
  const main = destinations.filter((d) => !d.hidden);
  const count = main.filter((d) => discovered.includes(d.id)).length;
  const secret = discovered.includes("secret");
  return (
    <div className="glass-light rounded-2xl px-3 py-2" aria-label={`Discovered ${count} of ${main.length} places`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/55">Discovered</p>
      <div className="mt-1 flex items-center gap-1.5">
        {main.map((d) => (
          <span
            key={d.id}
            title={d.name}
            className="size-2.5 rounded-full transition"
            style={{ background: discovered.includes(d.id) ? d.color : "rgb(255 246 234 / 0.15)" }}
          />
        ))}
        <span className="ml-1 font-mono text-xs text-cream/80">
          {count}/{main.length}
        </span>
        {secret && <span className="ml-1 text-xs text-[#7dffb0]" title="Hidden terminal found">+1 secret</span>}
      </div>
    </div>
  );
}

function ControlsCard() {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-light rounded-2xl p-3 text-xs">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-6 font-semibold text-cream/80"
        aria-expanded={open}
        onClick={(e) => {
          setOpen(!open);
          blurOnMouse(e);
        }}
      >
        <span className="flex items-center gap-2">
          <Keyboard className="size-4" aria-hidden /> Controls
        </span>
        <span className="text-cream/45">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-cream/75">
          <dt className="flex gap-1">
            <span className="kbd">W</span>
            <span className="kbd">↑</span>
          </dt>
          <dd>Accelerate</dd>
          <dt className="flex gap-1">
            <span className="kbd">S</span>
            <span className="kbd">↓</span>
          </dt>
          <dd>Brake / reverse</dd>
          <dt className="flex gap-1">
            <span className="kbd">A</span>
            <span className="kbd">D</span>
          </dt>
          <dd>Steer</dd>
          <dt>
            <span className="kbd">Space</span>
          </dt>
          <dd>Handbrake</dd>
          <dt>
            <span className="kbd">E</span>
          </dt>
          <dd>Enter a place</dd>
          <dt>
            <span className="kbd">R</span>
          </dt>
          <dd>Reset car</dd>
          <dt>
            <span className="kbd">M</span>
          </dt>
          <dd>Map</dd>
        </dl>
      )}
    </div>
  );
}

function InteractionPrompt() {
  const nearby = usePortfolio((s) => s.nearby);
  const active = usePortfolio((s) => s.activePanel);
  const openPanel = usePortfolio((s) => s.openPanel);
  const isTouch = usePortfolio((s) => s.isTouch);
  const stuck = usePortfolio((s) => s.stuck);
  if (active) return null;
  if (nearby) {
    const d = destinationById[nearby];
    return (
      <button
        type="button"
        onClick={(e) => {
          openPanel(d.panel);
          audio.chime("open");
          blurOnMouse(e);
        }}
        className="glass pointer-events-auto flex animate-rise items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5 text-left"
        style={{ boxShadow: `0 0 0 1px ${d.color}55, 0 12px 40px -12px ${d.color}` }}
      >
        <span className="kbd !h-9 !min-w-9 !text-sm" style={{ borderColor: d.color, color: d.color }}>
          {isTouch ? "Tap" : "E"}
        </span>
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: d.color }}>
            {d.name}
          </span>
          <span className="block text-sm font-semibold">{d.cta}</span>
        </span>
      </button>
    );
  }
  if (stuck) {
    return (
      <button
        type="button"
        onClick={(e) => {
          vehicle.resetRequested = true;
          blurOnMouse(e);
        }}
        className="glass pointer-events-auto animate-rise rounded-2xl px-4 py-2.5 text-sm"
      >
        Stuck? <span className="kbd mx-1">R</span> or tap here to hop back onto the road.
      </button>
    );
  }
  return null;
}

function WaypointInfo() {
  const waypoint = usePortfolio((s) => s.waypoint);
  const setWaypoint = usePortfolio((s) => s.setWaypoint);
  const dist = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!waypoint) return;
    const d = destinationById[waypoint];
    let id = 0;
    const tick = () => {
      const dx = d.position[0] - vehicle.x;
      const dz = d.position[1] - vehicle.z;
      if (dist.current) dist.current.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
      // Bearing relative to the car's heading; positive = to the left (heading grows anticlockwise).
      let rel = Math.atan2(dx, dz) - vehicle.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (arrow.current) arrow.current.style.transform = `rotate(${-rel}rad)`;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [waypoint]);
  if (!waypoint) return null;
  const d = destinationById[waypoint];
  return (
    <div className="glass pointer-events-auto flex animate-rise items-center gap-3 rounded-2xl py-2 pl-3 pr-2 text-sm">
      <span ref={arrow} className="inline-block text-lg leading-none" style={{ color: d.color }} aria-hidden>
        ▲
      </span>
      <span>
        Heading to <strong style={{ color: d.color }}>{d.name}</strong> · <span ref={dist} className="font-mono" />
      </span>
      <button type="button" onClick={() => setWaypoint(null)} className="rounded-lg p-1 text-cream/60 hover:bg-cream/10 hover:text-cream" aria-label="Clear destination">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function DrivingHUD() {
  const hudHidden = usePortfolio((s) => s.hudHidden);
  const isTouch = usePortfolio((s) => s.isTouch);
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-3">
        <WaypointInfo />
      </div>
      <div
        className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-3 ${isTouch ? "bottom-40" : "bottom-6"}`}
        aria-live="polite"
      >
        <InteractionPrompt />
      </div>
      {!hudHidden && (
        <>
          <div className={`pointer-events-none fixed z-20 ${isTouch ? "left-3 top-20" : "bottom-5 left-5"}`}>
            <Speedometer />
          </div>
          <div className={`pointer-events-auto fixed z-20 flex flex-col items-end gap-2 ${isTouch ? "right-3 top-20" : "bottom-5 right-5"}`}>
            <Discovery />
            {!isTouch && <ControlsCard />}
          </div>
        </>
      )}
    </>
  );
}
