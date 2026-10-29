"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { input } from "@/lib/vehicleState";

/** Capture can fail (e.g. the pointer already ended); driving should still respond. */
function capture(el: Element, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {}
}

/** Touch driving: a horizontal steering pad on the left, pedals on the right. */
export function MobileControls() {
  const [knob, setKnob] = useState(0);
  const origin = useRef<{ id: number; x: number } | null>(null);
  const R = 46;

  const steerMove = (clientX: number) => {
    if (!origin.current) return;
    const dx = Math.max(-R, Math.min(R, clientX - origin.current.x));
    setKnob(dx);
    input.touchSteer = dx / R;
  };
  const steerEnd = () => {
    origin.current = null;
    setKnob(0);
    input.touchSteer = 0;
  };

  const pedal = (key: "touchThrottle" | "touchBrake", label: string, icon: React.ReactNode, cls: string) => (
    <button
      type="button"
      aria-label={label}
      className={`grid size-[74px] select-none place-items-center rounded-full border-2 text-cream active:scale-95 ${cls}`}
      onPointerDown={(e) => {
        capture(e.currentTarget, e.pointerId);
        input[key] = 1;
      }}
      onPointerUp={() => (input[key] = 0)}
      onPointerCancel={() => (input[key] = 0)}
      onLostPointerCapture={() => (input[key] = 0)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}
    </button>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="slider"
        aria-label="Steering"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Math.round((knob / R) * 100) / 100}
        tabIndex={-1}
        className="glass-light pointer-events-auto relative h-[92px] w-[150px] touch-none select-none rounded-full"
        onPointerDown={(e) => {
          capture(e.currentTarget, e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          origin.current = { id: e.pointerId, x: rect.left + rect.width / 2 };
          steerMove(e.clientX);
        }}
        onPointerMove={(e) => steerMove(e.clientX)}
        onPointerUp={steerEnd}
        onPointerCancel={steerEnd}
      >
        <span className="absolute inset-y-0 left-4 my-auto h-0.5 w-[118px] rounded bg-cream/15" aria-hidden />
        <span
          className="absolute left-1/2 top-1/2 size-14 rounded-full border-2 border-cream/40 bg-coral/80 shadow-lg"
          style={{ transform: `translate(calc(-50% + ${knob}px), -50%)` }}
          aria-hidden
        />
        <span className="absolute -top-5 left-0 right-0 text-center text-[10px] uppercase tracking-widest text-cream/60">Steer</span>
      </div>
      <div className="pointer-events-auto flex touch-none items-end gap-3">
        {pedal("touchBrake", "Brake / reverse", <ArrowDown className="size-7" aria-hidden />, "border-cream/25 bg-ink/55")}
        {pedal("touchThrottle", "Accelerate", <ArrowUp className="size-8" aria-hidden />, "mb-6 border-gold/60 bg-coral/75")}
      </div>
    </div>
  );
}
