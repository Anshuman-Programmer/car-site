"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible drawer: traps focus, closes on Escape or backdrop click,
 * and returns focus to whatever opened it.
 */
export function PanelDialog({
  open,
  onClose,
  eyebrow,
  title,
  accent = "#ffd166",
  icon,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  accent?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    // Focus the heading so screen readers announce the panel.
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      const r = restore.current;
      if (r && document.contains(r)) r.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        className="absolute inset-0 animate-fade bg-ink/35 backdrop-blur-[2px] md:bg-gradient-to-l md:from-ink/55 md:to-transparent"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass relative m-0 flex h-full w-full animate-drawer flex-col overflow-hidden sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} aria-hidden />
        <header className="flex items-start gap-3 px-5 pb-3 pt-5 sm:px-7">
          {icon && (
            <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}22`, color: accent }}>
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/55">{eyebrow}</p>}
            <h2 id={titleId} data-autofocus tabIndex={-1} className="font-display text-2xl font-bold leading-tight outline-none sm:text-3xl">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-cream/12 bg-cream/[0.05] text-cream/80 transition hover:bg-cream/[0.12] hover:text-cream"
            aria-label="Close panel (Escape)"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="scroll-soft flex-1 overflow-y-auto px-5 pb-8 pt-2 sm:px-7">{children}</div>
      </div>
    </div>
  );
}
