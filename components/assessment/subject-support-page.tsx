"use client";

import Link from "@/components/ui/portal-link";
import { useEffect, useState } from "react";
import { useParams } from "@/lib/portal-navigation";
import {
  ArrowLeft,
  BellRing,
  Eye,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { AssessmentShell } from "@/components/assessment/assessment-shell";
import { ExamDetailTabs } from "@/components/assessment/exam-detail-tabs";
import { LearningSupportGroupPanel } from "@/components/assessment/learning-support-group-panel";
import { Button } from "@/components/ui/button";
import {
  ContentLoading,
  ContentLoadingOverlay,
} from "@/components/ui/content-loading";
import { Input, Textarea, Checkbox } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableEmptyRow,
} from "@/components/ui/data-table";
import { usePermissions } from "@/context/permissions-context";
import { examService } from "@/lib/assessment-api";
import {
  normalizeSearchKeyword,
  matchesSearchKeyword,
} from "@/lib/search-keyword";
import { toVietnameseSubjectName } from "@/lib/subject-localization";
import type {
  SubjectSupportReport,
  SubjectSupportStudent,
} from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const levels = {
  HIGH: { label: "Cần ưu tiên", tone: "bg-rose-50 text-rose-700" },
  WATCH: { label: "Cần theo dõi", tone: "bg-amber-50 text-amber-700" },
  STABLE: { label: "Tạm ổn định", tone: "bg-emerald-50 text-emerald-700" },
  INSUFFICIENT: {
    label: "Chưa đủ dữ liệu",
    tone: "bg-slate-100 text-slate-600",
  },
};
const score = (value: number | null) =>
  value === null
    ? "—"
    : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 10)}/10`;

export function SubjectSupportPage() {
  const { id } = useParams<{ id: string }>();
  return <SupportContent key={id} examId={id} />;
}

export function SubjectSupportDetail({
  examId,
  initialReport,
}: {
  examId: string;
  initialReport?: SubjectSupportReport;
}) {
  return (
    <SupportContent
      key={examId}
      examId={examId}
      initialReport={initialReport}
      standalone
    />
  );
}

function SupportContent({
  examId,
  initialReport,
  standalone = false,
}: {
  examId: string;
  initialReport?: SubjectSupportReport;
  standalone?: boolean;
}) {
  const { can, loading: permissionsLoading } = usePermissions();
  const allowed = can("exams.submissions");
  const [report, setReport] = useState<SubjectSupportReport | null>(
    initialReport ?? null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initialReport);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [selected, setSelected] = useState<SubjectSupportStudent | null>(null);
  const [audience, setAudience] = useState<"STUDENT" | "PARENTS" | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!allowed || permissionsLoading) return;
    if (initialReport && reload === 0) return;
    let active = true;
    setLoading(true);
    setError("");
    void examService
      .getSubjectSupport(examId, reload > 0)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải đánh giá theo môn",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [examId, initialReport, allowed, permissionsLoading, reload]);

  function openStudent(student: SubjectSupportStudent) {
    setSelected(student);
    setAudience(null);
    setSendError("");
  }

  function compose(target: "STUDENT" | "PARENTS") {
    if (!selected || !report) return;
    setAudience(target);
    setSendError("");
    const subjects = [
      ...new Set(
        selected.gaps
          .map((gap) => gap.topicName)
          .filter(
            (name) =>
              name && !["Kiến thức tổng hợp", "Chưa gắn chủ đề"].includes(name),
          ),
      ),
    ].slice(0, 3);
    setMessage(
      `${target === "PARENTS" ? `Kính gửi phụ huynh em ${selected.fullName}, mong gia đình phối hợp` : `Em ${selected.fullName} cần`} dành thời gian ôn tập môn ${toVietnameseSubjectName(report.subjectName)}${subjects.length ? `, tập trung vào ${subjects.join(", ")}` : " theo các câu cần củng cố bên trên"}.${selected.overdueExamCount ? ` Vui lòng trao đổi với giáo viên về ${selected.overdueExamCount} bài quá hạn chưa nộp.` : ""} Hãy trao đổi lại với giáo viên nếu gặp khó khăn để thống nhất kế hoạch hỗ trợ.`,
    );
  }

  async function send() {
    if (!selected || !report || !audience || !message.trim() || sending) return;
    setSending(true);
    setSendError("");
    try {
      const result = await examService.sendSupportAlert(examId, {
        studentId: selected.id,
        audience,
        version: report.version,
        message,
      });
      setSuccess(
        result.alreadySent
          ? "Thông báo này đã được gửi trước đó, không gửi trùng."
          : `Đã gửi thông báo cho ${result.recipientCount} ${audience === "PARENTS" ? "phụ huynh đã liên kết" : "học sinh"}.`,
      );
      setSelected(null);
      setAudience(null);
    } catch (cause) {
      setSendError(
        cause instanceof Error ? cause.message : "Không thể gửi thông báo",
      );
    } finally {
      setSending(false);
    }
  }

  const filtered =
    report?.students.filter(
      (student) =>
        (!followUpOnly || student.needsFollowUp) &&
        matchesSearchKeyword(
          normalizeSearchKeyword(student.fullName, student.studentCode),
          search,
        ),
    ) ?? [];
  const evaluatedStudents =
    report?.students.filter((student) => student.level !== "INSUFFICIENT") ??
    [];
  const atRiskStudentCount =
    report?.riskSummary?.atRiskStudentCount ??
    evaluatedStudents.filter(
      (student) => student.level === "HIGH" || student.level === "WATCH",
    ).length;
  const atRiskPercentage =
    report?.riskSummary?.atRiskPercentage ??
    (evaluatedStudents.length
      ? Math.round((atRiskStudentCount / evaluatedStudents.length) * 1000) / 10
      : null);
  const preview =
    selected && report
      ? `Môn ${report.subjectName} · Lớp ${report.className}\nHọc sinh: ${selected.fullName} (${selected.studentCode})\n${selected.reasons.join("\n")}\n${selected.gaps
          .slice(0, 5)
          .map(
            (gap) =>
              `${gap.examTitle} — Câu ${gap.questionNumber}: ${gap.content.slice(0, 240)}`,
          )
          .join("\n")}\n\nGiáo viên đề nghị:\n${message.trim()}`
      : "";
  return (
    <AssessmentShell>
      {standalone ? (
        <Link
          href="/teacher/learning-support"
          className="mb-4 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <ArrowLeft className="size-4" /> Tất cả lớp và môn
        </Link>
      ) : (
        <ExamDetailTabs examId={examId} active="support" />
      )}
      {!permissionsLoading && !allowed ? (
        <p className="p-4 text-sm text-slate-500">
          Bạn chưa có quyền xem đánh giá học tập.
        </p>
      ) : loading && !report ? (
        <ContentLoading label="Đang tổng hợp các bài kiểm tra cùng môn..." />
      ) : error && !report ? (
        <div
          role="alert"
          className="rounded-lg bg-white p-4 text-sm text-rose-600"
        >
          {error}
          <Button
            className="ml-3"
            size="sm"
            variant="outline"
            onClick={() => setReload((value) => value + 1)}
          >
            Thử lại
          </Button>
        </div>
      ) : report ? (
        <div className="relative space-y-3 text-[13px]">
          {loading ? (
            <ContentLoadingOverlay label="Đang cập nhật đánh giá..." />
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
              {error}
            </p>
          ) : null}
          {report.cache?.stale ? (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800"
            >
              Đang hiển thị bản tổng hợp gần nhất vì lần làm mới vừa rồi chưa
              thành công. Hãy thử tải lại sau.
            </p>
          ) : null}
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {toVietnameseSubjectName(report.subjectName)} ·{" "}
                {report.className}
              </h1>
              <p className="mt-1 text-slate-500">
                Theo dõi từ {report.examCount} bài kiểm tra đã mở ·{" "}
                {report.students.length} học sinh · Cập nhật{" "}
                {new Date(report.generatedAt).toLocaleString("vi-VN")}
              </p>
            </div>
            <Button
              variant="outline"
              className="!text-[13px]"
              onClick={() => {
                setSelected(null);
                setReload((value) => value + 1);
              }}
            >
              <RefreshCw className="size-4" />
              Tải lại đánh giá
            </Button>
          </header>
          {report.materialContext?.available === false ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 leading-6 text-amber-800"
            >
              Môn học chưa có tài liệu đã gắn và xử lý sẵn sàng. Hệ thống chỉ
              ước lượng nguy cơ học lực yếu từ kết quả các bài kiểm tra; chưa
              tạo lộ trình học.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [
                "Nguy cơ học lực yếu",
                atRiskPercentage === null ? "—" : `${atRiskPercentage}%`,
              ],
              [
                "Cần theo dõi",
                report.students.filter((student) => student.level === "WATCH")
                  .length,
              ],
              [
                "Cần nhắc bài quá hạn",
                report.students.filter(
                  (student) => student.overdueExamCount > 0,
                ).length,
              ],
              [
                "Chưa đủ dữ liệu",
                report.students.filter(
                  (student) => student.level === "INSUFFICIENT",
                ).length,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          {standalone ? (
            <LearningSupportGroupPanel examId={examId} report={report} />
          ) : null}
          <details className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">
            <summary className="cursor-pointer font-semibold">
              Cách xác định mức cần hỗ trợ
            </summary>
            <p className="mt-2 leading-6">{report.policy}</p>
          </details>
          {success ? (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-emerald-700"
            >
              {success}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="search-field">
              <Input containerClassName="search-field"
                icon={Search}
                className="!text-[13px]"
                aria-label="Tìm học sinh"
                placeholder="Tên hoặc mã học sinh"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 px-2">
              <Checkbox
                type="checkbox"
                checked={followUpOnly}
                onChange={(event) => setFollowUpOnly(event.target.checked)}
              />
              Chỉ học sinh cần đôn đốc
            </label>
          </div>
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
            <TableScrollArea>
              <Table className="min-w-[900px]">
                <TableHeader className="!bg-brand-600 !text-white">
                  <tr>
                    <TableHead>Học sinh</TableHead>
                    <TableHead>Mức hỗ trợ</TableHead>
                    <TableHead>TB gần đây</TableHead>
                    <TableHead>Quá hạn</TableHead>
                    <TableHead>Bằng chứng</TableHead>
                    <TableHead className="text-right">Chi tiết</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filtered.length ? (
                    filtered.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <TableCell>
                          <p className="font-bold text-slate-900">
                            {student.fullName}
                          </p>
                          <p className="mt-1 text-slate-400">
                            {student.studentCode}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${levels[student.level].tone}`}
                          >
                            {levels[student.level].label}
                          </span>
                          <p className="mt-2 text-slate-400">
                            {student.scoredExamCount} bài có điểm đầy đủ
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">
                          {score(student.recentAveragePercentage)}
                          {student.trendPercentagePoints !== null ? (
                            <p className="mt-1 font-normal text-slate-500">
                              {student.trendPercentagePoints > 0 ? "+" : ""}
                              {student.trendPercentagePoints} đpt
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>{student.overdueExamCount} bài</TableCell>
                        <TableCell className="max-w-md">
                          <p className="leading-5">
                            {student.reasons.join(" ")}
                          </p>
                          <p className="mt-1 text-slate-400">
                            {student.gaps.length} câu sai/bỏ trống cần xem lại
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Xem bằng chứng và gửi nhắc nhở"
                            aria-label={`Xem đánh giá của ${student.fullName}`}
                            onClick={() => openStudent(student)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </tr>
                    ))
                  ) : (
                    <TableEmptyRow
                      colSpan={6}
                      message={
                        report.examCount
                          ? "Không có học sinh phù hợp."
                          : "Môn học chưa có bài kiểm tra đã mở."
                      }
                    />
                  )}
                </TableBody>
              </Table>
            </TableScrollArea>
          </section>
        </div>
      ) : null}
      <Modal
        open={selected !== null}
        title={
          selected
            ? `${selected.fullName} · ${selected.studentCode}`
            : "Đánh giá học tập"
        }
        width="max-w-4xl"
        onClose={() => {
          if (!sending) setSelected(null);
        }}
        footer={
          audience ? (
            <>
              <Button
                variant="outline"
                disabled={sending}
                onClick={() => setAudience(null)}
              >
                Quay lại
              </Button>
              <Button
                permission="notifications.send"
                disabled={sending || !message.trim()}
                onClick={() => void send()}
              >
                {sending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Gửi{" "}
                {audience === "PARENTS" ? "tới phụ huynh" : "nhắc nhở học sinh"}
              </Button>
            </>
          ) : selected?.needsFollowUp ? (
            <>
              <Button
                permission="notifications.send"
                variant="outline"
                onClick={() => compose("STUDENT")}
              >
                <Send className="size-4" />
                Nhắc học sinh
              </Button>
              <Button
                permission="notifications.send"
                disabled={!selected.parentCount}
                title={
                  !selected.parentCount
                    ? "Học sinh chưa liên kết phụ huynh"
                    : undefined
                }
                onClick={() => compose("PARENTS")}
              >
                <BellRing className="size-4" />
                Thông báo phụ huynh ({selected.parentCount})
              </Button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4 text-[13px]">
            <p className="rounded-lg bg-slate-50 p-3 leading-6">
              {selected.reasons.join(" ")}
            </p>
            <TableScrollArea>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Bài kiểm tra</TableHead>
                    <TableHead>Hạn nộp</TableHead>
                    <TableHead>Kết quả</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {selected.history.map((item) => (
                    <tr key={item.examId}>
                      <TableCell>
                        <Link
                          className="font-semibold text-brand-700 hover:underline"
                          href={
                            item.attemptId
                              ? `/teacher/exams/${item.examId}/submissions/${item.attemptId}`
                              : `/teacher/exams/${item.examId}`
                          }
                        >
                          {item.title}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(item.endsAt).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell>
                        {item.status === "OVERDUE"
                          ? "Quá hạn chưa nộp"
                          : item.status === "OPEN"
                            ? "Còn thời gian nộp"
                            : item.awaitingGrading
                              ? "Chưa có điểm đầy đủ"
                              : score(item.percentage)}
                      </TableCell>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableScrollArea>
            <section>
              <h3 className="mb-2 font-bold text-slate-900">
                Kiến thức cần kiểm tra lại — bằng chứng từ bài làm
              </h3>
              {selected.gaps.length ? (
                <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {selected.gaps.map((gap) => (
                    <article
                      key={`${gap.examId}-${gap.questionId}`}
                      className="p-3"
                    >
                      <p className="font-semibold text-slate-800">
                        {gap.topicName} · Câu {gap.questionNumber}
                      </p>
                      <p className="mt-1 leading-5 text-slate-600">
                        {gap.content}
                      </p>
                      <p className="mt-1 text-slate-400">
                        {gap.examTitle} · Trả lời sai hoặc bỏ trống
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">
                  Chưa có câu sai được chấm tự động để xác định nội dung cần
                  củng cố.
                </p>
              )}
            </section>
            {audience ? (
              <section className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                <h3 className="font-bold text-brand-800">
                  Xem trước thông báo{" "}
                  {audience === "PARENTS"
                    ? `tới ${selected.parentCount} phụ huynh đã liên kết`
                    : "tới học sinh"}
                </h3>
                <p className="text-slate-600">
                  Thông báo gồm môn/lớp, tên học sinh, các bằng chứng ở trên
                  (tối đa 5 câu) và lời nhắn dưới đây. Chỉ gửi cho{" "}
                  {audience === "PARENTS"
                    ? "phụ huynh của học sinh này"
                    : "học sinh này"}
                  .
                </p>
                <Textarea
                  label="Lời nhắn của giáo viên"
                  rows={5}
                  maxLength={2000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Chưa gửi thông báo cho đến khi bạn bấm nút Gửi.
                </p>
              </section>
            ) : null}
            {audience ? (
              <details open className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold">
                  Nội dung đầy đủ sẽ gửi
                </summary>
                <h4 className="mt-3 font-bold">
                  Cần phối hợp học tập: {selected.fullName} ·{" "}
                  {report?.subjectName}
                </h4>
                <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">
                  {preview}
                </p>
              </details>
            ) : null}
            {sendError ? (
              <p role="alert" className="text-rose-600">
                {sendError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </AssessmentShell>
  );
}
