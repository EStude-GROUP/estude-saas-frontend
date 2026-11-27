"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/ui/portal-link";
import { ArrowLeft, Folder, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { AssessmentShell, ErrorPanel, LoadingPanel, PageHeading } from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import { questionBankService } from "@/lib/assessment-api";
import { QUESTION_TYPE_LABELS } from "@/types/assessment";
import type { QuestionTrash } from "@/types/assessment";

const DAY = 24 * 60 * 60 * 1000;

/** "Còn 3 ngày" until the daily purge removes the item for good. */
export function daysLeft(purgeAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now) / DAY));
}

export function purgeLabel(purgeAt: string, now = Date.now()): string {
  const days = daysLeft(purgeAt, now);
  return days <= 0 ? "Sắp bị xóa vĩnh viễn" : `Còn ${days} ngày để khôi phục`;
}

const fail = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export function QuestionTrashPage() {
  const [trash, setTrash] = useState<QuestionTrash | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      setTrash(await questionBankService.trash());
    } catch (cause) {
      setError(fail(cause, "Không thể tải thùng rác"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(kind: "folder" | "question", id: string, label: string) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      if (kind === "folder") await questionBankService.restoreTrashFolder(id);
      else await questionBankService.restoreTrashQuestion(id);
      setNotice(`Đã khôi phục ${label}.`);
      await load();
    } catch (cause) {
      setError(fail(cause, "Không thể khôi phục"));
    } finally {
      setBusyId("");
    }
  }

  const empty = trash && trash.folders.length === 0 && trash.questions.length === 0;
  return (
    <AssessmentShell>
      <PageHeading title="Thùng rác ngân hàng câu hỏi" description="Câu hỏi và thư mục đã xóa được giữ lại để khôi phục, sau đó bị xóa vĩnh viễn." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/teacher/question-bank" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
          <ArrowLeft className="size-4" /> Về ngân hàng câu hỏi
        </Link>
        <p className="text-sm text-slate-500">
          Mục trong thùng rác được giữ {trash?.retentionDays ?? 15} ngày; hệ thống tự xóa vĩnh viễn mỗi ngày những mục quá hạn.
        </p>
      </div>
      {error ? <div className="mb-3"><ErrorPanel message={error} /></div> : null}
      {notice ? <p role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {!trash && !error ? <LoadingPanel /> : null}
      {empty ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <Trash2 className="mx-auto mb-2 size-8 text-slate-300" />
          Thùng rác trống.
        </div>
      ) : null}
      {trash && trash.folders.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Thư mục đã xóa</h2>
          <ul className="grid gap-2">
            {trash.folders.map((folder) => (
              <li key={folder.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Folder className="mt-0.5 size-5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{folder.name}</p>
                    <p className="text-sm text-slate-500">
                      {folder.questions} câu hỏi{folder.subfolders ? ` · ${folder.subfolders} thư mục con` : ""} · {purgeLabel(folder.purgeAt)}
                    </p>
                  </div>
                </div>
                <Button permission="questions.delete" variant="secondary" disabled={busyId === folder.id} onClick={() => void restore("folder", folder.id, `thư mục “${folder.name}”`)}>
                  {busyId === folder.id ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Khôi phục
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {trash && trash.questions.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Câu hỏi đã xóa</h2>
          <ul className="grid gap-2">
            {trash.questions.map((question) => (
              <li key={question.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold leading-6 text-slate-900">{question.content}</p>
                  <p className="text-sm text-slate-500">
                    {question.subjectName} · {QUESTION_TYPE_LABELS[question.type]} · {purgeLabel(question.purgeAt)}
                  </p>
                </div>
                <Button permission="questions.delete" variant="secondary" disabled={busyId === question.id} onClick={() => void restore("question", question.id, "câu hỏi")}>
                  {busyId === question.id ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Khôi phục
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AssessmentShell>
  );
}
