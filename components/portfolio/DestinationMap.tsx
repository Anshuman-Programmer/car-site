"use client";

import { useEffect, useMemo, useRef } from "react";
import { Info, Navigation, X } from "lucide-react";
import { usePortfolio } from "@/lib/store";
import { vehicle } from "@/lib/vehicleState";
import { destinations } from "@/data/locations";
import { islandRadius, lakeRadius, LAKE_CENTER, ROADS, STREAM_POINTS } from "@/lib/world/layout";
import { sampleSpline } from "@/lib/world/terrain";

function pathFrom(points: [number, number][], closed: boolean) {
  return points.map(([x, z], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${z.toFixed(1)}`).join(" ") + (closed ? " Z" : "");
}

/** North-up map drawn from the same layout data as the 3D world. */
export function DestinationMap() {
  const open = usePortfolio((s) => s.mapOpen);
  const setOpen = usePortfolio((s) => s.setMapOpen);
  const discovered = usePortfolio((s) => s.discovered);
  const waypoint = usePortfolio((s) => s.waypoint);
  const setWaypoint = usePortfolio((s) => s.setWaypoint);
  const openPanel = usePortfolio((s) => s.openPanel);
  const car = useRef<SVGGElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const shapes = useMemo(() => {
    const island: [number, number][] = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const r = islandRadius(a) * 0.95;
      island.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const lake: [number, number][] = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r = lakeRadius(a);
      lake.push([LAKE_CENTER[0] + Math.cos(a) * r, LAKE_CENTER[1] + Math.sin(a) * r]);
    }
    const roads = ROADS.filter((r) => !r.hidden).map((r) => ({
      id: r.id,
      main: r.kind === "main",
      d: pathFrom(
        sampleSpline(r.points, r.closed, 3).samples.map((s) => [s.x, s.z] as [number, number]),
        r.closed,
      ),
    }));
    return {
      island: pathFrom(island, true),
      lake: pathFrom(lake, true),
      stream: pathFrom(sampleSpline(STREAM_POINTS, false, 3).samples.map((s) => [s.x, s.z] as [number, number]), false),
      roads,
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    let id = 0;
    const tick = () => {
      // Heading 0 faces +z (south on this north-up map); SVG rotation is clockwise.
      car.current?.setAttribute("transform", `translate(${vehicle.x} ${vehicle.z}) rotate(${(-vehicle.heading * 180) / Math.PI + 180})`);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey, true);
      if (restore && document.contains(restore)) restore.focus({ preventScroll: true });
    };
  }, [open, setOpen]);

  if (!open) return null;
  const visible = destinations.filter((d) => !d.hidden || discovered.includes(d.id));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 animate-fade bg-ink/40 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Island map"
        onClick={(e) => e.stopPropagation()}
        className="glass relative flex max-h-full w-full max-w-4xl animate-rise flex-col overflow-hidden rounded-3xl md:flex-row"
      >
        <div className="relative aspect-square w-full shrink-0 bg-[#1d4f6b]/60 md:w-[56%]">
          <svg viewBox="-165 -165 330 330" className="size-full" role="img" aria-label="Map of the island showing destinations and your car">
            <defs>
              <radialGradient id="sea" cx="50%" cy="50%" r="60%">
                <stop offset="0.6" stopColor="#2e8c9c" />
                <stop offset="1" stopColor="#173a5c" />
              </radialGradient>
            </defs>
            <rect x="-165" y="-165" width="330" height="330" fill="url(#sea)" />
            <path d={shapes.island} fill="#e8d39b" transform="scale(1.04)" opacity="0.8" />
            <path d={shapes.island} fill="#7fb862" stroke="#c99766" strokeWidth="3" />
            <path d={shapes.lake} fill="#5fd4c4" stroke="#e8d39b" strokeWidth="2" />
            <path d={shapes.stream} fill="none" stroke="#5fd4c4" strokeWidth="3.5" strokeLinecap="round" />
            {shapes.roads.map((r) => (
              <path key={r.id} d={r.d} fill="none" stroke="#f3dcb4" strokeWidth={r.main ? 5 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {visible.map((d) => (
              <g key={d.id} transform={`translate(${d.position[0]} ${d.position[1]})`}>
                {waypoint === d.id && <circle r="11" fill="none" stroke={d.color} strokeWidth="2" opacity="0.9" />}
                <circle r="6.5" fill={d.color} stroke="#17111f" strokeWidth="2" />
                <text y="-11" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff6ea" stroke="#17111f" strokeWidth="2.5" paintOrder="stroke">
                  {d.name}
                </text>
              </g>
            ))}
            <g ref={car}>
              <circle r="7" fill="#17111f" opacity="0.35" />
              <path d="M0 -7 L5 5 L0 2.5 L-5 5 Z" fill="#ff6b4a" stroke="#fff6ea" strokeWidth="1.2" />
            </g>
            <text x="-155" y="-150" fontSize="9" fill="#fff6ea" opacity="0.7">
              N ↑
            </text>
          </svg>
        </div>
        <div className="scroll-soft flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 data-autofocus tabIndex={-1} className="font-display text-2xl font-bold outline-none">
                Destinations
              </h2>
              <p className="text-sm text-cream/60">Set a waypoint to get a guide arrow, or open a section right away.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-cream/12 bg-cream/[0.05] hover:bg-cream/[0.12]"
              aria-label="Close map (Escape)"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <ul className="space-y-2">
            {visible.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-cream/10 bg-cream/[0.04] p-3">
                <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{d.name}</span>
                  <span className="block text-xs text-cream/55">
                    {d.short}
                    {discovered.includes(d.id) ? " · visited" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setWaypoint(d.id);
                    setOpen(false);
                  }}
                  className="grid size-9 place-items-center rounded-lg border border-cream/12 hover:bg-cream/10"
                  aria-label={`Set waypoint to ${d.name}`}
                  title="Guide me there"
                >
                  <Navigation className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => openPanel(d.panel)}
                  className="grid size-9 place-items-center rounded-lg border border-cream/12 hover:bg-cream/10"
                  aria-label={`Open ${d.short}`}
                  title="Open now"
                >
                  <Info className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
