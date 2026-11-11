"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { User } from "@/types/auth";

export function ParentChildIdentity({ student, detailsClassName = "" }: {
  student: User;
  detailsClassName?: string;
}) {
  const initials = student.fullName.trim().split(/\s+/).slice(-2)
    .map((part) => part[0]).join("");
  return <>
    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-50 text-sm font-bold uppercase text-brand-700">
      {student.avatarUrl ? <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${student.avatarUrl})` }} /> : initials}
    </span>
    <span className={`min-w-0 flex-1 ${detailsClassName}`}>
      <span className="block truncate text-sm font-bold text-ink">{student.fullName}</span>
      <span className="mt-0.5 block truncate text-[13px] font-normal text-slate-500">
        {student.assignedClass ? `Lớp ${student.assignedClass.name || student.assignedClass.code}` : `Mã HS: ${student.accountName}`}
      </span>
    </span>
  </>;
}

export function ParentChildPicker({ open, students, selectedId, onSelect, onClose }: {
  open: boolean;
  students: User[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      (list?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? list?.querySelector("button"))?.focus();
    });
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialog = listRef.current?.closest('[role="dialog"]');
      const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", trapFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trapFocus);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  return <Modal open={open} title="Chọn con" onClose={onClose} width="max-w-md" compact
    footer={<Button variant="outline" size="sm" onClick={onClose}>Hủy</Button>}
    footerClassName="!px-4 !py-3">
    <div ref={listRef} className="max-h-[min(400px,60dvh)] space-y-2 overflow-y-auto">
      {students.map((student) => <Button key={student.id} variant="plain" type="button"
        aria-label={`Xem thông tin ${student.fullName}`} aria-pressed={student.id === selectedId}
        onClick={() => onSelect(student.id)}
        className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${student.id === selectedId ? "border-brand-200 bg-brand-50/50" : "border-slate-200 hover:border-brand-200 hover:bg-slate-50"}`}>
        <ParentChildIdentity student={student} />
        {student.id === selectedId ? <Check className="size-4 shrink-0 text-brand-600" /> : <ChevronRight className="size-4 shrink-0 text-slate-400" />}
      </Button>)}
    </div>
  </Modal>;
}
