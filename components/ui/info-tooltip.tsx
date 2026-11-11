"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InfoTooltip({ label, content }: { label: string; content: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !trigger.current || !tooltip.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const box = tooltip.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8)),
      top: anchor.bottom + box.height + 14 <= window.innerHeight
        ? anchor.bottom + 6 : Math.max(8, anchor.top - box.height - 6),
    });
  }, [open, content]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); close(); } };
    const onOutside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !tooltip.current?.contains(event.target as Node)) close(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return <>
    <Button ref={trigger} variant="plain" aria-label={label} aria-describedby={open ? id : undefined}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={() => { if (document.activeElement !== trigger.current) setOpen(false); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}>
      <CircleHelp className="size-3.5" aria-hidden="true" />
    </Button>
    {open && createPortal(<span ref={tooltip} id={id} role="tooltip"
      style={{ top: position.top, left: position.left }}
      className="fixed z-[100] w-max max-w-[min(18rem,calc(100vw-16px))] rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-5 text-white shadow-lg">
      {content}
    </span>, document.body)}
  </>;
}
