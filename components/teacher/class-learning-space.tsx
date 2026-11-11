"use client";

import { useCallback, useEffect, useState } from "react";
import { courseWorkspaceHref } from "@/lib/course-workspace";
import { useRouter } from "@/lib/portal-navigation";
import {
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  LoaderCircle,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CourseWorkspacePicker } from "./course-workspace-picker";
import { OnlineSessionPanel } from "@/components/online-sessions/session-panel";
import { CourseContentPanel } from "@/components/teacher/course-content-panel";
import { useActionNotification } from "@/components/ui/action-notification";
import { ClassChatPanel } from "@/components/class-chat/class-chat-panel";
import { GradebookPanel } from "@/components/teacher/gradebook-panel";
import { usePermissions } from "@/context/permissions-context";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { academicDataService, examService } from "@/lib/assessment-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type { ClassRoster, Exam, ExamListAiAnalysis, TeacherAssignedClass } from "@/types/assessment";
import { Input } from "@/components/ui/form-control";
import { TableScrollArea } from "@/components/ui/table-scroll-area";


type ClassTab = "online" | "topics" | "students" | "exams" | "grades" | "chat";

const classTabs: Array<{ id: ClassTab; label: string }> = [
  { id: "topics", label: "Chủ đề môn học" },
  { id: "online", label: "Buổi học online" },
  { id: "students", label: "Danh sách học sinh" },
  { id: "exams", label: "Bài kiểm tra" },
  { id: "grades", label: "Điểm số" },
  { id: "chat", label: "Trao đổi lớp" },
];

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function examStatus(exam: Exam): { label: string; className: string } {
  if (!exam.published) return { label: "Bản nháp", className: "bg-slate-100 text-slate-600" };
  if (exam.status === "ONGOING") return { label: "Đang diễn ra", className: "bg-emerald-50 text-emerald-700" };
  if (exam.status === "ENDED") return { label: "Đã kết thúc", className: "bg-blue-50 text-brand-700" };
  return { label: "Sắp diễn ra", className: "bg-amber-50 text-amber-700" };
}

function studentStatus(status: string): { label: string; className: string } {
  if (status === "ACTIVE") return { label: "Đang hoạt động", className: "bg-emerald-50 text-emerald-700" };
  if (status === "PENDING") return { label: "Chờ đăng nhập", className: "bg-amber-50 text-amber-700" };
  if (status === "LOCKED") return { label: "Đã khóa", className: "bg-rose-50 text-rose-700" };
  return { label: "Ngừng hoạt động", className: "bg-slate-100 text-slate-600" };
}

export function TeacherClassLearningSpace({ classId, onClassNameChange }: { classId: string; onClassNameChange: (value: { id: string; name: string }) => void }) {
  const router = useRouter();
  const { notify } = useActionNotification();
  const { can } = usePermissions();
  const canReadExams = can("exams.read");
  const [activeTab, setActiveTab] = useState<ClassTab>("topics");
  const [schoolClass, setSchoolClass] = useState<TeacherAssignedClass | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzingExams, setAnalyzingExams] = useState(false);
  const [examAnalysisOpen, setExamAnalysisOpen] = useState(false);
  const [examAnalysisError, setExamAnalysisError] = useState("");
  const [examAnalysis, setExamAnalysis] = useState<ExamListAiAnalysis | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const loadedClass = await academicDataService.getTeacherAssignedClass(classId);
      const hasSubject = loadedClass.subjects.length > 0;
      const loadedExams = hasSubject && canReadExams ? await examService.getExams() : [];
      setSchoolClass(loadedClass);
      onClassNameChange({ id: loadedClass.id, name: loadedClass.name });
      if (loadedClass.isHomeroomTeacher && loadedClass.subjects.length === 0) setActiveTab("students");
      setExams(loadedExams.filter((exam) => exam.classId === classId));
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải không gian lớp học"));
    } finally {
      setIsLoading(false);
    }
  }, [canReadExams, classId, onClassNameChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setRoster(null);
    setRosterError("");
    setStudentSearch("");
    setActiveTab("topics");
  }, [classId]);

  useEffect(() => {
    if (activeTab !== "students") return;
    let active = true;
    setRosterLoading(true);
    setRosterError("");
    void academicDataService.getTeacherAssignedClassRoster(classId)
      .then((result) => { if (active) setRoster(result); })
      .catch((cause) => { if (active) setRosterError(errorMessage(cause, "Không thể tải danh sách học sinh")); })
      .finally(() => { if (active) setRosterLoading(false); });
    return () => { active = false; };
  }, [activeTab, classId]);

  const canReadChat = can("class_chat.read");
  const visibleTab = activeTab === "chat" && !canReadChat
    ? (schoolClass?.subjects.length ? "topics" : "students")
    : activeTab === "exams" && !canReadExams
      ? (schoolClass?.subjects.length ? "topics" : "students")
    : activeTab;
  const filteredStudents = (roster?.students ?? []).filter((student) =>
    matchesSearchKeyword(student.keyword, studentSearch),
  );

  async function analyzeClassExams() {
    if (!exams.length || exams.length > 30) return;
    setAnalyzingExams(true);
    setExamAnalysis(null);
    setExamAnalysisError("");
    setExamAnalysisOpen(true);
    try {
      const analysis = await examService.analyzeExamList({
        classId,
        examIds: exams.map((exam) => exam.id),
      });
      setExamAnalysis(analysis);
      notify(
        analysis.source === "AI"
          ? "AI đã hoàn tất phân tích các bài kiểm tra của lớp"
          : "Đã tạo phân tích dự phòng từ số liệu lớp",
        { key: "class-exam-ai-analysis" },
      );
    } catch (cause) {
      setExamAnalysisError(
        errorMessage(cause, "Không thể phân tích các bài kiểm tra của lớp"),
      );
    } finally {
      setAnalyzingExams(false);
    }
  }

  if (isLoading && !schoolClass) {
    return <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm font-semibold text-slate-500"><LoaderCircle className="size-5 animate-spin text-brand-600" />Đang tải lớp học...</div>;
  }

  return (
    <div className="space-y-3">
      <CourseWorkspacePicker classId={classId} />
      {error ? <p className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700"><XCircle className="size-4" />{error}</p> : null}

      <div className="space-y-3">
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card" aria-label="Thông tin lớp học">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-xl font-extrabold text-brand-700">{schoolClass?.code.charAt(0).toUpperCase() || "L"}</div>
          <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-slate-950">{schoolClass?.name ?? "Lớp học"}</h2><p className="mt-1 text-xs text-slate-500">{schoolClass?.code ?? "--"} · {schoolClass?.isHomeroomTeacher ? "Giáo viên chủ nhiệm" : "Đang phụ trách"}</p></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600"><span className="inline-flex items-center gap-1.5"><UsersRound className="size-4 text-brand-600" />{schoolClass?.studentCount ?? 0} học sinh</span><span className="inline-flex items-center gap-1.5"><BookOpenCheck className="size-4 text-brand-600" />{schoolClass?.subjects.length ? schoolClass.subjects.map(getVietnameseSubjectName).join(", ") : "Chưa có môn học"}</span></div>
        </section>

      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <nav className="overflow-x-auto border-b border-slate-100 px-3" aria-label="Nội dung lớp học">
          <div className="flex min-w-max gap-1">
            {classTabs.filter((tab) =>
              (tab.id !== "chat" || canReadChat)
              && (tab.id !== "exams" || canReadExams)
              && (tab.id !== "online" || can("online_sessions.read"))
              && (Boolean(schoolClass?.subjects.length) || !(["topics", "online", "exams", "grades"] as ClassTab[]).includes(tab.id)),
            ).map((tab) => (
              <Button variant="plain"
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={visibleTab === tab.id}
                className={`border-b-2 px-4 py-3 text-[13px] font-bold transition ${visibleTab === tab.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </nav>
        <div className="p-4 sm:p-5">
          {visibleTab === "exams" ? <section data-testid="class-exam-list" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-black text-slate-900"><ClipboardList className="size-5 text-brand-600" />Bài kiểm tra của lớp</h3>
            <p className="mt-1 text-sm text-slate-500">Mở báo cáo để xem đủ học sinh, lượt làm và kết quả theo câu/chủ đề.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              permission="exams.submissions"
              variant="secondary"
              size="sm"
              className="min-w-[150px]"
              disabled={analyzingExams || exams.length === 0 || exams.length > 30}
              onClick={() => void analyzeClassExams()}
              title={
                exams.length > 30
                  ? "Danh sách tối đa 30 bài kiểm tra mỗi lần phân tích"
                  : "Phân tích toàn bộ bài kiểm tra của lớp bằng AI"
              }
            >
              {analyzingExams ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {analyzingExams ? "Đang phân tích..." : "AI phân tích lớp"}
            </Button>
            <Button permission="exams.read" variant="outline" size="sm" onClick={() => router.push(courseWorkspaceHref("/teacher/exams"))}>Quản lý bài kiểm tra</Button>
          </div>
        </header>
        {exams.length ? (
          <div className="divide-y divide-slate-100">
            {exams.map((exam) => {
              const status = examStatus(exam);
              return (
                <article key={exam.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-600"><FileCheck2 className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{exam.title}</p><span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span></div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span>{exam.subjectName}</span><span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{new Date(exam.settings.startsAt).toLocaleString("vi-VN")}</span><span>{exam.attemptedCount ?? 0} học sinh đã bắt đầu</span></p>
                  </div>
                  <Button permission={exam.published ? "exams.submissions" : "exams.read"} size="sm" variant={exam.published ? "secondary" : "outline"} onClick={() => router.push(courseWorkspaceHref(exam.published ? `/teacher/exams/${exam.id}/submissions` : `/teacher/exams/${exam.id}`))}>{exam.published ? "Xem báo cáo lớp" : "Xem bài kiểm tra"}</Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-7 text-center text-sm text-slate-500">Lớp chưa có bài kiểm tra. Tạo và công bố bài kiểm tra để bắt đầu theo dõi kết quả.</div>
        )}
          </section> : null}

          {visibleTab === "grades" && schoolClass ? <GradebookPanel key={schoolClass.id} schoolClass={schoolClass} /> : null}
          {visibleTab === "chat" ? <ClassChatPanel classId={classId} className={schoolClass?.name} /> : null}

          {visibleTab === "students" ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-black text-slate-900">Danh sách học sinh</h3><p className="mt-1 text-sm text-slate-500">{roster?.students.length ?? schoolClass?.studentCount ?? 0} học sinh trong lớp</p></div>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Tìm học sinh hoặc tài khoản" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-blue-100" />
                </div>
              </header>
              {rosterError ? <p className="m-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{rosterError}</p> : null}
              <TableScrollArea>
                <Table className="min-w-[650px]">
                  <TableHeader className="!bg-brand-600 !text-white"><tr><TableHead className="w-14 text-center">#</TableHead><TableHead>Học sinh</TableHead><TableHead>Tài khoản</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Hồ sơ</TableHead></tr></TableHeader>
                  <TableBody>
                    {rosterLoading ? <TableLoadingBarRow colSpan={5} /> : null}
                    {!rosterLoading && !rosterError && !roster?.students.length ? <TableEmptyRow colSpan={5} message="Lớp chưa có học sinh" /> : null}
                    {!rosterLoading && !rosterError && Boolean(roster?.students.length) && !filteredStudents.length ? <TableEmptyRow colSpan={5} message="Không tìm thấy học sinh phù hợp" /> : null}
                    {!rosterLoading && !rosterError ? filteredStudents.map((student, index) => {
                      const status = studentStatus(student.status);
                      return <tr key={student.id} className="hover:bg-slate-50/70">
                        <TableCell className="text-center text-xs text-slate-400">{index + 1}</TableCell>
                        <TableCell><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand-700">{student.fullName.trim().charAt(0).toUpperCase()}</span><span className="font-bold text-slate-900">{student.fullName}</span></div></TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-brand-700">{student.accountName}</TableCell>
                        <TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span></TableCell>
                        <TableCell className="text-right"><Button permission="student_reports.read" variant="ghost" size="sm" onClick={() => router.push(`/teacher/students/${encodeURIComponent(student.id)}`)}>Xem hồ sơ</Button></TableCell>
                      </tr>;
                    }) : null}
                  </TableBody>
                </Table>
              </TableScrollArea>
            </section>
          ) : null}

      {visibleTab === "online" ? <OnlineSessionPanel role="teacher" classId={classId} /> : null}
      {visibleTab === "topics" && schoolClass ? <CourseContentPanel schoolClass={schoolClass} /> : null}
        </div>
      </div>
      </div>

      <Modal
        open={examAnalysisOpen}
        title="AI phân tích các bài kiểm tra của lớp"
        description={`${schoolClass?.name ?? "Lớp học"} · ${exams.length} bài kiểm tra`}
        onClose={() => setExamAnalysisOpen(false)}
        width="max-w-5xl"
        bodyClassName="max-h-[calc(100dvh-10rem)] overflow-y-auto !p-5"
      >
        {analyzingExams ? (
          <div className="flex min-h-52 items-center justify-center gap-3 text-sm font-semibold text-slate-500">
            <LoaderCircle className="size-6 animate-spin text-brand-600" />
            Đang tổng hợp xu hướng qua các bài kiểm tra...
          </div>
        ) : examAnalysisError ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{examAnalysisError}</div>
        ) : examAnalysis ? (
          <ClassExamAiAnalysis analysis={examAnalysis} />
        ) : null}
      </Modal>


    </div>
  );
}

function ClassExamAiAnalysis({ analysis }: { analysis: ExamListAiAnalysis }) {
  const trend = {
    IMPROVING: { label: "Đang cải thiện", icon: TrendingUp, className: "bg-emerald-50 text-emerald-700" },
    DECLINING: { label: "Có xu hướng giảm", icon: TrendingDown, className: "bg-rose-50 text-rose-700" },
    STABLE: { label: "Tương đối ổn định", icon: Minus, className: "bg-blue-50 text-brand-700" },
    INSUFFICIENT_DATA: { label: "Chưa đủ dữ liệu", icon: Minus, className: "bg-slate-100 text-slate-600" },
  }[analysis.trend.direction];
  const TrendIcon = trend.icon;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><BrainCircuit className="size-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-slate-950">{analysis.headline}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${analysis.source === "AI" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>{analysis.source === "AI" ? "Gemini AI" : "Phân tích dự phòng"}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{analysis.summary}</p>
          </div>
        </div>
        <div className={`mt-4 flex items-start gap-3 rounded-xl p-4 ${trend.className}`}><TrendIcon className="mt-0.5 size-5 shrink-0" /><div><p className="font-black">{trend.label}</p><p className="mt-1 text-sm leading-6">{analysis.trend.evidence}</p></div></div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClassExamInsight title="Điểm tích cực" items={analysis.strengths} className="border-emerald-100 bg-emerald-50/50" />
        <ClassExamInsight title="Điểm cần chú ý" items={analysis.concerns} className="border-amber-100 bg-amber-50/50" />
      </div>

      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="font-black text-slate-950">Đề xuất ưu tiên</h3>
        <div className="mt-3 space-y-3">{analysis.recommendations.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl bg-slate-50 p-4"><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.action}</p></div>)}</div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-950">Gợi ý hoạt động tiếp theo</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-700">{analysis.lessonPlan.durationMinutes} phút</span></div>
        <p className="mt-2 font-bold text-brand-800">{analysis.lessonPlan.focus}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{analysis.lessonPlan.objective}</p>
        <ol className="mt-3 space-y-2">{analysis.lessonPlan.activities.map((activity, index) => <li key={`${activity}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-black text-brand-700">{index + 1}</span>{activity}</li>)}</ol>
      </section>
      <p className="text-xs leading-5 text-slate-400">AI chỉ nhận số liệu tổng hợp đã ẩn danh của lớp. Giáo viên cần đối chiếu với bối cảnh thực tế trước khi áp dụng.</p>
    </div>
  );
}

function ClassExamInsight({ title, items, className }: { title: string; items: Array<{ title: string; evidence: string }>; className: string }) {
  return <section className={`rounded-2xl border p-5 ${className}`}><h3 className="font-black text-slate-950">{title}</h3><div className="mt-3 space-y-3">{items.length ? items.map((item, index) => <div key={`${item.title}-${index}`}><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.evidence}</p></div>) : <p className="text-sm text-slate-500">Chưa có tín hiệu đủ rõ.</p>}</div></section>;
}
