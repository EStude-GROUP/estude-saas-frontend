"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Filter, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPopoverContext } from "@/components/ui/filter-popover-context";
import { cn } from "@/lib/cn";
import { visibleFilterCount } from "@/lib/responsive-filters";

export interface ToolbarFilter {
  id: string;
  label: string;
  content: ReactNode | ((inPopup: boolean) => ReactNode);
  width?: number;
  active?: boolean;
  fullWidth?: boolean;
}

interface ResponsiveFilterToolbarProps {
  search?: ReactNode;
  filters: ToolbarFilter[];
  actions?: ReactNode;
  onReset?: () => void;
  onOpen?: () => void;
  popupFooter?: (close: () => void) => ReactNode;
  className?: string;
}

export function ResponsiveFilterToolbar({ search, filters, actions, onReset, onOpen, popupFooter, className }: ResponsiveFilterToolbarProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const insideEvents = useRef(new WeakSet<Event>());
  const [availableWidth, setAvailableWidth] = useState(0);
  const [searchWidth, setSearchWidth] = useState(search ? 360 : 0);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>();
  const id = useId();
  const widths = filters.map((filter) => filter.width ?? 192);
  const visible = visibleFilterCount(availableWidth, widths, search ? searchWidth : 0);
  const hidden = filters.slice(visible);
  const hiddenKey = hidden.map((filter) => filter.id).join("|");
  const activeCount = hidden.filter((filter) => filter.active).length;
  const hasSearch = Boolean(search);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    function measure() {
      setAvailableWidth(controls!.clientWidth);
      const preferred = searchRef.current
        ? parseFloat(getComputedStyle(searchRef.current).getPropertyValue("--search-input-max-width"))
        : 0;
      setSearchWidth(preferred || (hasSearch ? 360 : 0));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(controls);
    return () => observer.disconnect();
  }, [hasSearch]);

  // A resize may move controls back into the toolbar. Never leave an empty popup.
  useEffect(() => { setOpen(false); }, [hiddenKey]);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !triggerRef.current) return;
    let frame = 0;
    function position() {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      if (!panel || !trigger) return;
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const box = trigger.getBoundingClientRect();
      const width = Math.min(560, viewportWidth - 24);
      const below = topEdge + viewportHeight - box.bottom - 20;
      const above = box.top - topEdge - 20;
      const showAbove = below < Math.min(240, panel.scrollHeight) && above > below;
      setPanelStyle({
        position: "fixed", width, zIndex: 900,
        left: Math.max(leftEdge + 12, Math.min(box.right - width, leftEdge + viewportWidth - width - 12)),
        top: showAbove ? undefined : Math.max(topEdge + 12, box.bottom + 8),
        bottom: showAbove ? window.innerHeight - box.top + 8 : undefined,
        maxHeight: Math.max(80, Math.min(640, showAbove ? above : below)),
      });
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); }
    position();
    panelRef.current.focus({ preventScroll: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(panelRef.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      const target = event.target as Node;
      // React capture also sees events from a select's portaled menu.
      if (insideEvents.current.has(event) || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (panelRef.current?.querySelector('[aria-expanded="true"]')) return;
      event.preventDefault();
      close(true);
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div data-filter-toolbar className={cn("flex min-w-0 flex-wrap items-center gap-3", className)}>
      <div ref={controlsRef} data-filter-controls className={cn("flex min-w-0 flex-1 items-center gap-3", filters.length < 2 ? "flex-wrap" : "flex-nowrap")} style={{ flexBasis: search ? "min(100%, 300px)" : "min(100%, 160px)" }}>
        {search ? <div ref={searchRef} data-filter-search className="min-w-0 max-w-[var(--search-input-max-width)] flex-[1_1_160px]">{search}</div> : null}
        {filters.slice(0, visible).map((filter) => (
          <div key={filter.id} data-inline-filter={filter.id} className="max-w-full shrink-0 [&>*]:!w-full [&>*]:!max-w-none" style={{ width: filter.width ?? 192 }}>{typeof filter.content === "function" ? filter.content(false) : filter.content}</div>
        ))}
        {hidden.length >= 2 ? (
          <Button ref={triggerRef} data-filter-trigger variant="outline" className="h-[42px] w-[116px] shrink-0 whitespace-nowrap !px-3" aria-label="Bộ lọc" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} aria-describedby={activeCount ? `${id}-count` : undefined} onClick={() => { if (!open) onOpen?.(); setPanelStyle(undefined); setOpen((current) => !current); }}>
            Bộ lọc
            <span className="relative"><Filter className="size-4" />{activeCount > 0 ? <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-orange-500 ring-2 ring-white" /> : null}</span>
            {activeCount > 0 ? <span id={`${id}-count`} className="sr-only">{activeCount} bộ lọc đang áp dụng</span> : null}
          </Button>
        ) : null}
      </div>
      {actions ? <div data-filter-actions className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      {open && hidden.length >= 2 ? createPortal(
        <FilterPopoverContext.Provider value={true}>
          <div ref={panelRef} id={id} role="dialog" aria-label="Bộ lọc" tabIndex={-1} data-filter-popover className="overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 outline-none" style={panelStyle ?? { position: "fixed", visibility: "hidden" }} onMouseDownCapture={(event) => insideEvents.current.add(event.nativeEvent)} onFocusCapture={(event) => insideEvents.current.add(event.nativeEvent)}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <h2 className="text-sm font-bold text-brand-700">Bộ lọc</h2>
              <div className="flex items-center gap-1">
                {onReset ? <Button variant="ghost" size="sm" aria-label="Đặt lại bộ lọc" title="Đặt lại bộ lọc" onClick={onReset}><RotateCcw className="size-4" /></Button> : null}
                <Button variant="ghost" size="sm" aria-label="Đóng bộ lọc" onClick={() => close(true)}><X className="size-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              {hidden.map((filter) => <div key={filter.id} data-popup-filter={filter.id} role="group" aria-labelledby={`${id}-${filter.id}`} className={cn("min-w-0", filter.fullWidth && "sm:col-span-2")}>
                <p id={`${id}-${filter.id}`} className="mb-2 text-sm font-semibold text-slate-700">{filter.label}</p>
                <div className="[&>*]:!w-full [&>*]:!max-w-none">{typeof filter.content === "function" ? filter.content(true) : filter.content}</div>
              </div>)}
            </div>
            {popupFooter ? <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">{popupFooter(() => close(true))}</div> : null}
          </div>
        </FilterPopoverContext.Provider>, document.body,
      ) : null}
    </div>
  );
}
