"use client";

import Link from "@/components/ui/portal-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "@/lib/portal-navigation";
import {
  CheckCheck,
  CircleDot,
  Clock3,
  Inbox,
  LoaderCircle,
  MessageCircleReply,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { AssessmentShell } from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import {
  LEARNING_SUPPORT_CHANGED_EVENT,
  learningSupportService,
} from "@/lib/learning-support-api";
import type {
  LearningSupportInbox,
  LearningSupportRequest,
  LearningSupportStatus,
} from "@/types/assessment";
import { Input, Textarea } from "@/components/ui/form-control";


const statusMeta: Record<
  LearningSupportStatus,
  { label: string; tone: string }
> = {
  OPEN: { label: "Chờ xử lý", tone: "bg-amber-50 text-amber-800" },
  IN_PROGRESS: { label: "Đang xử lý", tone: "bg-blue-50 text-brand-700" },
  RESOLVED: { label: "Đã xử lý", tone: "bg-emerald-50 text-emerald-700" },
};

const filters: Array<{
  value: "ALL" | LearningSupportStatus;
  label: string;
  count: keyof LearningSupportInbox["counts"];
}> = [
  { value: "ALL", label: "Tất cả", count: "all" },
  { value: "OPEN", label: "Chờ xử lý", count: "open" },
  { value: "IN_PROGRESS", label: "Đang xử lý", count: "inProgress" },
  { value: "RESOLVED", label: "Đã xử lý", count: "resolved" },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LearningSupportInboxPage() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("request");
  const openedFromQuery = useRef(false);
  const [filter, setFilter] = useState<"ALL" | LearningSupportStatus>("ALL");
  const [inbox, setInbox] = useState<LearningSupportInbox | null>(null);
  const [selected, setSelected] = useState<LearningSupportRequest | null>(null);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(nextFilter = filter) {
    setLoading(true);
    setError("");
    try {
      setInbox(
        await learningSupportService.listTeacher(
          nextFilter === "ALL" ? undefined : nextFilter,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tải yêu cầu hỗ trợ",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filter);
    // load is intentionally tied to the selected filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!requestedId || openedFromQuery.current || !inbox) return;
    openedFromQuery.current = true;
    void openRequest(requestedId);
  }, [inbox, requestedId]);

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return inbox?.items ?? [];
    return (inbox?.items ?? []).filter((item) =>
      [item.studentName, item.planTitle, item.taskTitle, item.latestMessage?.content]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("vi-VN").includes(keyword)),
    );
  }, [inbox, search]);

  async function openRequest(requestId: string) {
    setBusy(true);
    setError("");
    try {
      const request = await learningSupportService.getTeacher(requestId);
      setSelected(request);
      setInbox((current) =>
        current
          ? {
              ...current,
              unreadCount: Math.max(
                0,
                current.unreadCount -
                  (current.items.find((item) => item.id === requestId)
                    ?.unreadForTeacher
                    ? 1
                    : 0),
              ),
              items: current.items.map((item) =>
                item.id === requestId
                  ? { ...item, ...request, unreadForTeacher: false }
                  : item,
              ),
            }
          : current,
      );
      window.dispatchEvent(new Event(LEARNING_SUPPORT_CHANGED_EVENT));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở yêu cầu");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: LearningSupportStatus) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await learningSupportService.updateStatus(
        selected.id,
        status,
      );
      setSelected(updated);
      await load(filter);
      window.dispatchEvent(new Event(LEARNING_SUPPORT_CHANGED_EVENT));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    setError("");
    try {
      const updated = await learningSupportService.reply(selected.id, reply);
      setSelected(updated);
      setReply("");
      await load(filter);
      window.dispatchEvent(new Event(LEARNING_SUPPORT_CHANGED_EVENT));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi phản hồi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AssessmentShell>
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">
              Trao đổi trực tiếp
            </p>
            <h1 className="mt-1 text-xl font-black text-slate-950">
              Hộp thư hỗ trợ học sinh
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Tiếp nhận khó khăn, phản hồi và theo dõi đến khi đã xử lý.
            </p>
          </div>
          <Button variant="outline" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Cập nhật
          </Button>
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button variant="plain"
              type="button"
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-3 py-2 text-sm font-bold transition ${
                filter === item.value
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label} {inbox ? `(${inbox.counts[item.count]})` : ""}
            </Button>
          ))}
          {inbox?.unreadCount ? (
            <span className="ml-auto rounded-full bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {inbox.unreadCount} chưa đọc
            </span>
          ) : null}
        </div>

        <div className="grid min-h-[36rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.6fr)]">
          <section className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <label className="relative block border-b border-slate-100 p-3">
              <Input
                containerClassName="search-field"
                icon={Search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm học sinh hoặc nội dung"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400"
              />
            </label>
            <div className="max-h-[34rem] overflow-y-auto">
              {loading && !inbox ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                  <LoaderCircle className="size-5 animate-spin" /> Đang tải hộp thư...
                </div>
              ) : visibleItems.length ? (
                visibleItems.map((item) => (
                  <Button variant="plain"
                    type="button"
                    key={item.id}
                    onClick={() => void openRequest(item.id)}
                    className={`block w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${
                      selected?.id === item.id ? "bg-blue-50/70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                        <UserRound className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-bold text-slate-900">
                            {item.studentName}
                          </p>
                          {item.unreadForTeacher ? (
                            <span className="size-2.5 shrink-0 rounded-full bg-rose-500" aria-label="Chưa đọc" />
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs font-semibold text-brand-700">
                          Bước {item.taskOrder ?? "—"}: {item.taskTitle}
                        </p>
                        <p className={`mt-2 line-clamp-2 text-sm ${item.unreadForTeacher ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                          {item.latestMessage?.content ?? "Chưa có nội dung"}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusMeta[item.status].tone}`}>
                            {statusMeta[item.status].label}
                          </span>
                          <time className="text-[11px] text-slate-400">
                            {formatTime(item.updatedAt)}
                          </time>
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">
                  <Inbox className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3">Không có yêu cầu phù hợp.</p>
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[32rem] flex-col">
            {selected ? (
              <>
                <div className="border-b border-slate-100 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{selected.studentName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selected.planTitle} · Bước {selected.taskOrder ?? "—"}: {selected.taskTitle}
                      </p>
                      <Link
                        href={`/teacher/learning-plans/${selected.planId}`}
                        className="mt-2 inline-block text-xs font-bold text-brand-700 hover:underline"
                      >
                        Mở lộ trình học →
                      </Link>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusMeta[selected.status].tone}`}>
                      {statusMeta[selected.status].label}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.status !== "IN_PROGRESS" ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void changeStatus("IN_PROGRESS")}>
                        <Clock3 className="size-4" /> Đang xử lý
                      </Button>
                    ) : null}
                    {selected.status !== "RESOLVED" ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void changeStatus("RESOLVED")}>
                        <CheckCheck className="size-4" /> Đánh dấu đã xử lý
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void changeStatus("OPEN")}>
                        <CircleDot className="size-4" /> Mở lại yêu cầu
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 sm:p-5">
                  {selected.messages.map((message) => {
                    const teacher = message.authorRole === "TEACHER";
                    return (
                      <div key={message.id} className={`flex ${teacher ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          teacher ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                        }`}>
                          <p className={`text-xs font-bold ${teacher ? "text-blue-100" : "text-slate-500"}`}>
                            {teacher ? "Bạn" : message.authorName}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap leading-6">{message.content}</p>
                          <time className={`mt-1 block text-[10px] ${teacher ? "text-blue-100" : "text-slate-400"}`}>
                            {formatTime(message.createdAt)}
                          </time>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 p-4">
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <MessageCircleReply className="size-4" /> Phản hồi học sinh
                  </label>
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="Nhập hướng dẫn hoặc câu trả lời..."
                      className="min-h-20 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <Button disabled={busy || !reply.trim()} onClick={() => void sendReply()}>
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Gửi
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center text-slate-500">
                <div>
                  <MessageCircleReply className="mx-auto size-10 text-slate-300" />
                  <p className="mt-3 font-semibold">Chọn một yêu cầu để xem lịch sử và phản hồi.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AssessmentShell>
  );
}
