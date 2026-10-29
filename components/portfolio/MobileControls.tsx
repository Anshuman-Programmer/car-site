"use client";

import { useEffect, useRef } from "react";
import { input } from "@/lib/vehicleState";

/** Capture can fail (e.g. the pointer already ended); driving should still respond. */
function capture(el: Element, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {}
}

const R = 48; // knob travel in px
const DEAD = 0.12;

/** Remaps |v| past the dead zone back onto 0..1, keeping the sign. */
function axis(v: number) {
  const a = Math.abs(v);
  return a < DEAD ? 0 : (Math.sign(v) * (a - DEAD)) / (1 - DEAD);
}

function release() {
  input.touchSteer = 0;
  input.touchThrottle = 0;
  input.touchBrake = 0;
}

/** Touch driving: one joystick at the bottom centre. Up drives, down brakes / reverses, sideways steers. */
export function MobileControls() {
  const knob = useRef<HTMLSpanElement>(null);
  const active = useRef<{ id: number; x: number; y: number } | null>(null);

  // Opening a panel unmounts the controls mid-press; don't leave the car driving itself.
  useEffect(() => release, []);

  const move = (id: number, clientX: number, clientY: number) => {
    const o = active.current;
    if (!o || o.id !== id) return;
    let dx = clientX - o.x;
    let dy = clientY - o.y;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx *= R / len;
      dy *= R / len;
    }
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const y = axis(dy / R);
    input.touchSteer = axis(dx / R);
    input.touchThrottle = Math.max(0, -y);
    input.touchBrake = Math.max(0, y);
  };
  const end = (id: number) => {
    if (active.current?.id !== id) return;
    active.current = null;
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
    release();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        aria-label="Driving joystick: push up to accelerate, down to brake or reverse, sideways to steer"
        className="glass-light pointer-events-auto relative size-[136px] touch-none select-none rounded-full"
        onPointerDown={(e) => {
          if (active.current) return;
          capture(e.currentTarget, e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          active.current = { id: e.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          move(e.pointerId, e.clientX, e.clientY);
        }}
        onPointerMove={(e) => move(e.pointerId, e.clientX, e.clientY)}
        onPointerUp={(e) => end(e.pointerId)}
        onPointerCancel={(e) => end(e.pointerId)}
        onLostPointerCapture={(e) => end(e.pointerId)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="absolute inset-x-0 top-2 text-center text-[10px] font-semibold text-gold/80" aria-hidden>
          ▲
        </span>
        <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold text-cream/50" aria-hidden>
          ▼
        </span>
        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-cream/50" aria-hidden>
          ◀
        </span>
        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-cream/50" aria-hidden>
          ▶
        </span>
        <span
          ref={knob}
          className="absolute left-1/2 top-1/2 size-14 rounded-full border-2 border-cream/40 bg-coral/80 shadow-lg"
          style={{ transform: "translate(-50%, -50%)" }}
          aria-hidden
        />
      </div>
    </div>
  );
}
