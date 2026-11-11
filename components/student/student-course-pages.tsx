"use client";

import { OnlineSessionPanel } from "@/components/online-sessions/session-panel";
import { FEATURES } from "@/lib/features";

import {
  ArrowLeft,
  CalendarClock,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Hash,
  Layers3,
  LoaderCircle,
  Mail,
  Search,
  SlidersHorizontal,
  UserRound,
  MessagesSquare,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useParams, useRouter, useSearchParams } from "@/lib/portal-navigation";
import { ErrorPanel, LoadingPanel } from "@/components/assessment/assessment-shell";
import { StudentExamList } from "@/components/assessment/student-exam-pages";
import { StudentShell } from "@/components/student/student-shell";
import { ClassChatPanel } from "@/components/class-chat/class-chat-panel";
import { usePermissions } from "@/context/permissions-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
} from "@/components/ui/data-table";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { academicDataService, examService } from "@/lib/assessment-api";
import { normalizeSearchKeyword } from "@/lib/search-keyword";
import { rememberStudentCourseAccess } from "@/lib/student-recent-courses";
import { LearningContentView } from './learning-content-view';
import { CourseProgressSummary } from './course-progress-summary';
import { progressService } from '@/lib/progress-api';
import type { StudentCourseProgress } from '@/types/progress';
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type {
  Exam,
  StudentCourse,
  StudentCourseDetail,
  StudentCourseMaterial,
} from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";



function courseHref(course: StudentCourse): string {
  return `/student/courses/${encodeURIComponent(course.classId)}/${encodeURIComponent(course.subjectId)}${course.courseOfferingId ? `?courseOfferingId=${encodeURIComponent(course.courseOfferingId)}` : ""}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"subject" | "code" | "class">("subject");

  useEffect(() => {
    void academicDataService
      .getStudentCourses()
      .then((items) =>
        setCourses(
          [...items].sort((left, right) =>
            getVietnameseSubjectName(left.subject).localeCompare(
              getVietnameseSubjectName(right.subject),
              "vi",
            ),
          ),
        ),
      )
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải môn học",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const classOptions = useMemo(() => {
    const classes = new Map<string, { code: string; name: string }>();
    for (const course of courses) {
      classes.set(course.classId, course.schoolClass);
    }
    return [
      { value: "all", label: "Tất cả lớp học" },
      ...[...classes.entries()]
        .sort(([, left], [, right]) => left.code.localeCompare(right.code, "vi"))
        .map(([id, schoolClass]) => ({
          value: id,
          label: `${schoolClass.code} · ${schoolClass.name}`,
        })),
    ];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const keyword = normalizeSearchKeyword(search);
    return courses
      .filter(
        (course) =>
          (classFilter === "all" || course.classId === classFilter) &&
          (!keyword ||
            normalizeSearchKeyword(
              getVietnameseSubjectName(course.subject),
              course.subject.name,
              course.subject.code,
              course.schoolClass.name,
              course.schoolClass.code,
              course.teacher.fullName,
            ).includes(keyword)),
      )
      .sort((left, right) => {
        if (sortBy === "code") {
          return left.subject.code.localeCompare(right.subject.code, "vi");
        }
        if (sortBy === "class") {
          return left.schoolClass.code.localeCompare(right.schoolClass.code, "vi");
        }
        return getVietnameseSubjectName(left.subject).localeCompare(
          getVietnameseSubjectName(right.subject),
          "vi",
        );
      });
  }, [classFilter, courses, search, sortBy]);

  return (
    <StudentShell>
      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">Không gian học tập</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Môn học của tôi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Chọn môn học để xem nội dung, tài liệu và bài kiểm tra được giao.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><BookOpen className="size-5" /></span>
            <div>
              <p className="text-xs font-semibold text-slate-500">Môn đang theo học</p>
              <p className="text-2xl font-black text-brand-700">{courses.length}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-[520px_260px_220px]">
          <Input icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên môn, mã môn, lớp hoặc giáo viên..." aria-label="Tìm môn học" />
          <CustomSelect value={classFilter} options={classOptions} onValueChange={setClassFilter} ariaLabel="Lọc theo lớp học" />
          <CustomSelect value={sortBy} options={[{ value: "subject", label: "Sắp xếp: Tên môn" }, { value: "code", label: "Sắp xếp: Mã môn" }, { value: "class", label: "Sắp xếp: Mã lớp" }]} onValueChange={(value) => setSortBy(value as typeof sortBy)} ariaLabel="Sắp xếp môn học" />
        </div>
      </section>
      {error ? <ErrorPanel message={error} /> : null}
      {loading ? <LoadingPanel /> : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
          <BookOpen className="mx-auto size-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Bạn chưa được gán vào môn học nào.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">Hiển thị <span className="font-black text-slate-950">{filteredCourses.length}</span> / {courses.length} môn học</p>
            {(search || classFilter !== "all") ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-brand-700"><SlidersHorizontal className="size-3.5" /> Đang áp dụng bộ lọc</span> : null}
          </div>
          {filteredCourses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Search className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 font-bold text-slate-700">Không tìm thấy môn học phù hợp.</p>
              <p className="mt-1 text-sm text-slate-500">Thử tìm bằng tên môn, mã môn hoặc thay đổi bộ lọc lớp.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setClassFilter("all"); }}>Xóa bộ lọc</Button>
            </div>
          ) : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course) => (
            <article key={course.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg">
              <div className="h-1.5 bg-gradient-to-r from-brand-600 to-cyan-400" />
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><GraduationCap className="size-5" /></span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{course.subject.code}</span>
                </div>
                <h2 className="mt-5 text-lg font-black text-slate-950">
                  {getVietnameseSubjectName(course.subject)}
                </h2>
                <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><BookOpen className="size-4 shrink-0 text-brand-500" /><span className="font-semibold text-slate-700">{course.schoolClass.name}</span></p>
                  <p className="flex items-center gap-2"><Hash className="size-4 shrink-0 text-brand-500" />Mã lớp: <b className="text-slate-800">{course.schoolClass.code}</b></p>
                  <p className="flex items-center gap-2"><UserRound className="size-4 shrink-0 text-brand-500" /><span className="truncate">{course.teacher.fullName}</span></p>
                </div>
                <Button className="mt-5 h-11 w-full" onClick={() => router.push(courseHref(course))}>Vào môn học</Button>
              </div>
            </article>
          ))}
          </div>}
        </>
      )}
    </StudentShell>
  );
}

type CourseSection = "online" | "overview" | "materials" | "exams" | "review" | "chat";

export function StudentCourseDetailPage() {
  const params = useParams<{ classId: string; subjectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedMaterialId = useRef<string | null>(null);
  const { can } = usePermissions();
  const [course, setCourse] = useState<StudentCourseDetail | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeSection, setActiveSection] = useState<CourseSection>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<StudentCourseProgress | null>(null);
  const [progressError, setProgressError] = useState("");
  const [previewMaterial, setPreviewMaterial] = useState<StudentCourseMaterial | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [materialError, setMaterialError] = useState("");

  useEffect(() => {
    setLoading(true);
    void academicDataService
      .getStudentCourse(params.classId, params.subjectId)
      .then((loadedCourse) => {
        setCourse(loadedCourse);
        rememberStudentCourseAccess(
          loadedCourse.classId,
          loadedCourse.subjectId,
        );
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải môn học"))
      .finally(() => setLoading(false));
    void examService.getExams()
      .then((items) => setExams(items.filter((exam) => exam.classId === params.classId && exam.subjectId === params.subjectId)))
      .catch(() => setExams([]));
    void progressService.studentCourse(params.classId, params.subjectId)
      .then((value) => { setProgress(value); setProgressError(''); })
      .catch((cause) => setProgressError(cause instanceof Error ? cause.message : 'Không thể tải tiến độ'));
  }, [params.classId, params.subjectId, searchParams]);

  function refreshProgress() {
    void progressService.studentCourse(params.classId, params.subjectId)
      .then((value) => { setProgress(value); setProgressError(''); })
      .catch((cause) => setProgressError(cause instanceof Error ? cause.message : 'Không thể tải tiến độ'));
  }

  const materials = useMemo(
    () => course?.topics.flatMap((topic) => topic.materials.map((material) => ({ material, topicName: topic.name }))) ?? [],
    [course],
  );
  useEffect(() => {
    const materialId = searchParams.get("materialId");
    if (!materialId || openedMaterialId.current === materialId || !course) return;
    const entry = materials.find(({ material }) => material.id === materialId);
    if (!entry) { setError("Tài liệu trong nhiệm vụ không còn được gán cho lớp này."); return; }
    openedMaterialId.current = materialId;
    setActiveSection("materials");
    setPreviewMaterial(entry.material);
    setPreviewLoading(true);
    setPreviewUrl("");
    setMaterialError("");
    void academicDataService.getStudentMaterialPreviewUrl(materialId)
      .then(({ url }) => setPreviewUrl(url))
      .catch((cause) => setMaterialError(cause instanceof Error ? cause.message : "Không thể mở tài liệu"))
      .finally(() => setPreviewLoading(false));
  }, [course, materials, searchParams]);
  const completedExams = exams.filter((exam) => exam.hasFinalizedAttempt === true).length;
  const availableExams = exams.filter((exam) => exam.studentStatus === "AVAILABLE" || exam.studentStatus === "IN_PROGRESS").length;
  const canReadClassChat = can("class_chat.read");
  const visibleSection = activeSection === "chat" && !canReadClassChat ? "overview" : activeSection;

  async function openPreview(material: StudentCourseMaterial) {
    setPreviewMaterial(material);
    setPreviewLoading(true);
    setPreviewUrl("");
    setMaterialError("");
    try {
      setPreviewUrl((await academicDataService.getStudentMaterialPreviewUrl(material.id)).url);
    } catch (cause) {
      setMaterialError(cause instanceof Error ? cause.message : "Không thể xem trước tài liệu");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadMaterial(material: StudentCourseMaterial) {
    setMaterialError("");
    try {
      const { url } = await academicDataService.getStudentMaterialDownloadUrl(material.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setMaterialError(cause instanceof Error ? cause.message : "Không thể tải tài liệu");
    }
  }

  return (
    <StudentShell>
      {loading ? <LoadingPanel /> : error ? <ErrorPanel message={error} /> : !course ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="font-bold text-rose-700">Không tìm thấy môn học trong lớp của bạn.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/student/courses")}><ArrowLeft className="size-4" /> Quay lại danh sách môn</Button>
        </div>
      ) : (
        <>
          <Button variant="ghost" className="mb-3" onClick={() => router.push("/student/courses")}><ArrowLeft className="size-4" /> Môn học của tôi</Button>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="bg-gradient-to-r from-brand-700 to-cyan-500 px-6 py-7 text-white sm:px-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-blue-100">
                    {course.subject.code}
                  </p>
                  <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                    {getVietnameseSubjectName(course.subject)}
                  </h1>
                  <p className="mt-3 text-sm text-blue-50">
                    {course.schoolClass.name} · Mã lớp {course.schoolClass.code}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="rounded-xl bg-white/15 px-4 py-3 text-sm backdrop-blur">
                    <p className="text-xs text-blue-100">Giáo viên phụ trách</p>
                    <p className="mt-1 font-bold">{course.teacher.fullName}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 text-xs font-bold">
                    {course.academicYear ? (
                      <span className="rounded-lg bg-white/15 px-3 py-2 text-blue-50 backdrop-blur">
                        Năm học {course.academicYear.name}
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-emerald-400/20 px-3 py-2 text-emerald-50 backdrop-blur">
                      Đang theo học
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 sm:px-6" aria-label="Nội dung môn học">
              <CourseTab active={visibleSection === "overview"} icon={BookOpen} label="Tổng quan" onClick={() => setActiveSection("overview")} />
              {can("online_sessions.read") && course.courseOfferingId ? <CourseTab active={visibleSection === "online"} icon={CalendarClock} label="Buổi học online" onClick={() => setActiveSection("online")} /> : null}
              <CourseTab active={visibleSection === "materials"} icon={FileText} label="Tài liệu" count={materials.length} onClick={() => setActiveSection("materials")} />
              <CourseTab active={visibleSection === "exams"} icon={ClipboardCheck} label="Bài kiểm tra" count={exams.length} onClick={() => setActiveSection("exams")} />
              {FEATURES.examAnalysis ? <CourseTab active={visibleSection === "review"} icon={BrainCircuit} label="Ôn tập" onClick={() => setActiveSection("review")} /> : null}
              {canReadClassChat ? <CourseTab active={visibleSection === "chat"} icon={MessagesSquare} label="Trao đổi lớp" onClick={() => setActiveSection("chat")} /> : null}
            </nav>
          </section>

          <div className="mt-4">
            {visibleSection === "overview" ? (
              <CourseOverview course={course} examCount={exams.length} completedExamCount={completedExams} availableExamCount={availableExams} materialCount={materials.length} onOpenMaterials={() => setActiveSection("materials")} progress={progress} progressError={progressError} onRefreshProgress={refreshProgress} />
            ) : visibleSection === "online" && course.courseOfferingId ? <OnlineSessionPanel role="student" courseId={course.courseOfferingId} /> : visibleSection === "materials" ? (
              <CourseMaterials items={materials} error={materialError} onPreview={openPreview} onDownload={downloadMaterial} />
            ) : visibleSection === "exams" ? (
              <section>
                <div className="mb-4"><h2 className="text-xl font-black text-slate-950">Bài kiểm tra</h2><p className="mt-1 text-sm text-slate-500">Các bài kiểm tra của môn học và lớp này.</p></div>
                <StudentExamList classId={course.classId} subjectId={course.subjectId} />
              </section>
            ) : visibleSection === "chat" ? <ClassChatPanel classId={course.classId} className={course.schoolClass.name} /> : <StudentReviewList classId={course.classId} subjectId={course.subjectId} />}
          </div>

          <Modal open={previewMaterial !== null} title={previewMaterial?.originalName ?? "Xem trước tài liệu"} width="max-w-[1600px]" bodyClassName="max-h-[calc(100dvh-5rem)] overflow-y-auto !p-2" compact onClose={() => { setPreviewMaterial(null); setPreviewUrl(""); setMaterialError(""); }}>
            {previewLoading ? (
              <div className="grid min-h-[480px] place-items-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin text-brand-600" /> Đang tải bản xem trước...</span></div>
            ) : materialError ? <ErrorPanel message={materialError} /> : previewMaterial && previewUrl ? <MaterialPreview material={previewMaterial} url={previewUrl} /> : null}
          </Modal>
        </>
      )}
    </StudentShell>
  );
}

function CourseTab({ active, icon: Icon, label, count, onClick }: { active: boolean; icon: ComponentType<{ className?: string }>; label: string; count?: number; onClick: () => void }) {
  return (
    <Button variant="plain" type="button" onClick={onClick} className={`relative flex h-14 shrink-0 items-center gap-2 px-3 text-sm font-bold ${active ? "text-brand-700" : "text-slate-500 hover:text-slate-900"}`}>
      <Icon className="size-4" /> {label}
      {count !== undefined ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-blue-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{count}</span> : null}
      {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-brand-600" /> : null}
    </Button>
  );
}

function CourseOverview({ course, examCount, completedExamCount, availableExamCount, materialCount, onOpenMaterials,
  progress, progressError, onRefreshProgress }: { course: StudentCourseDetail; examCount: number;
  completedExamCount: number; availableExamCount: number; materialCount: number; onOpenMaterials: () => void;
  progress: StudentCourseProgress | null; progressError: string; onRefreshProgress: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Layers3} label="Chủ đề" value={course.topics.length} tone="blue" />
        <StatCard icon={FileText} label="Tài liệu" value={materialCount} tone="violet" />
        <StatCard icon={ClipboardCheck} label="Bài kiểm tra" value={examCount} tone="amber" detail={availableExamCount ? `${availableExamCount} bài đang mở` : undefined} />
        <StatCard icon={CheckCircle2} label="Đã hoàn thành" value={completedExamCount} tone="emerald" />
      </div>
      <CourseProgressSummary progress={progress} error={progressError} onRefresh={onRefreshProgress} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-base font-black text-slate-950">Thông tin môn học</h2>
          {course.subject.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{course.subject.description}</p> : <p className="mt-2 text-sm italic text-slate-400">Chưa có mô tả môn học.</p>}
          <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <InfoItem label="Tên lớp" value={course.schoolClass.name} />
            <InfoItem label="Mã lớp" value={course.schoolClass.code} />
            <InfoItem label="Năm học" value={course.academicYear?.name ?? "Chưa cập nhật"} />
            <InfoItem label="Ngày tham gia" value={formatDate(course.enrollment.joinedAt)} />
            <InfoItem label="Sĩ số lớp" value={`${course.studentCount} học sinh`} />
            <InfoItem label="Trạng thái" value="Đang theo học" />
          </dl>
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-base font-black text-slate-950">Giảng viên phụ trách</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-black text-white">{course.teacher.fullName.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "GV"}</span>
              <div className="min-w-0"><p className="truncate font-bold text-slate-900">{course.teacher.fullName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{course.teacher.accountName}</p></div>
            </div>
            {course.teacher.email ? <a className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline" href={`mailto:${course.teacher.email}`}><Mail className="size-4" /> {course.teacher.email}</a> : null}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-base font-black text-slate-950">Thời gian học</h2>
            <div className="mt-3 space-y-2">
              {course.terms.length ? course.terms.map((term) => (
                <div key={term.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                  <div><p className="font-bold text-slate-800">{term.name}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(term.startsAt)} – {formatDate(term.endsAt)}</p></div>
                  {term.status === "ACTIVE" ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Hiện tại</span> : null}
                </div>
              )) : <p className="text-sm text-slate-400">Chưa có thông tin học kỳ.</p>}
            </div>
          </section>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-base font-black text-slate-950">Nội dung môn học</h2><p className="mt-0.5 text-xs text-slate-500">Các chủ đề được sắp xếp theo thứ tự học.</p></div>
          {materialCount > 0 ? <Button variant="outline" size="sm" onClick={onOpenMaterials}>Xem tất cả tài liệu</Button> : null}
        </header>
        <div className="p-4"><LearningContentView topics={course.topics} progress={progress} onProgressChange={onRefreshProgress} /></div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: ComponentType<{ size?: number; strokeWidth?: number }>; label: string; value: number; detail?: string; tone: "blue" | "violet" | "amber" | "emerald" }) {
  const tones = { blue: "bg-blue-50 text-brand-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700", emerald: "bg-emerald-50 text-emerald-700" };
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon size={19} strokeWidth={2.25} /></span><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-xl font-black text-slate-950">{value}</p>{detail ? <p className="text-[11px] font-semibold text-emerald-600">{detail}</p> : null}</div></div>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd></div>;
}

function CourseMaterials({ items, error, onPreview, onDownload }: { items: Array<{ material: StudentCourseMaterial; topicName: string }>; error: string; onPreview: (material: StudentCourseMaterial) => void; onDownload: (material: StudentCourseMaterial) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-100 px-5 py-4"><h2 className="text-base font-black text-slate-950">Tài liệu môn học</h2><p className="mt-0.5 text-xs text-slate-500">{items.length} tài liệu đã được chia sẻ</p></header>
      {error ? <div className="p-4"><ErrorPanel message={error} /></div> : null}
      <TableScrollArea><Table>
        <TableHeader><tr><TableHead className="w-14 text-center">#</TableHead><TableHead>Tài liệu</TableHead><TableHead>Chủ đề</TableHead><TableHead>Dung lượng</TableHead><TableHead>Ngày đăng</TableHead><TableHead className="w-32 text-right">Thao tác</TableHead></tr></TableHeader>
        <TableBody>
          {items.length === 0 ? <TableEmptyRow colSpan={6} message="Chưa có tài liệu cho môn học này" icon={<FileText className="size-5 text-slate-400" />} /> : null}
          {items.map(({ material, topicName }, index) => (
            <tr key={`${material.id}-${topicName}`} className="transition hover:bg-slate-50/70">
              <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
              <TableCell><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-brand-600"><FileText className="size-4" /></span><span className="max-w-xl truncate font-bold text-slate-900" title={material.originalName}>{material.originalName}</span></div></TableCell>
              <TableCell><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{topicName}</span></TableCell>
              <TableCell className="whitespace-nowrap text-slate-500">{formatFileSize(material.size)}</TableCell>
              <TableCell className="whitespace-nowrap text-slate-500">{formatDate(material.createdAt)}</TableCell>
              <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" title="Xem trước" aria-label={`Xem trước ${material.originalName}`} onClick={() => void onPreview(material)}><Eye size={18} strokeWidth={2.5} /></Button><Button variant="ghost" size="sm" title="Tải xuống" aria-label={`Tải ${material.originalName}`} onClick={() => void onDownload(material)}><Download size={18} strokeWidth={2.5} /></Button></div></TableCell>
            </tr>
          ))}
        </TableBody>
      </Table></TableScrollArea>
    </section>
  );
}

function MaterialPreview({ material, url }: { material: StudentCourseMaterial; url: string }) {
  const native = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(material.mimeType.toLowerCase());
  if (!native) return <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><FileText className="mx-auto size-10 text-slate-300" /><p className="mt-3 font-bold text-slate-800">Định dạng này chưa hỗ trợ xem trực tiếp</p><p className="mt-1 text-sm text-slate-500">Bạn có thể tải tài liệu xuống để mở; URL riêng tư không được gửi tới Office viewer bên thứ ba.</p></div></div>;
  return <iframe src={url} title={`Xem trước ${material.originalName}`} className="h-[calc(100dvh-7rem)] min-h-[520px] w-full rounded-lg border border-slate-200 bg-slate-50" allowFullScreen />;
}

function StudentReviewList({ classId, subjectId }: { classId: string; subjectId: string }) {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void examService.getExams()
      .then((items) => setExams(items.filter((exam) => exam.classId === classId && exam.subjectId === subjectId && exam.currentAttempt?.status === "SUBMITTED")))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải nội dung ôn tập"))
      .finally(() => setLoading(false));
  }, [classId, subjectId]);
  if (loading) return <LoadingPanel />;
  if (error) return <ErrorPanel message={error} />;
  return <section><div className="mb-4"><h2 className="text-xl font-black text-slate-950">Phân tích và ôn tập</h2><p className="mt-1 text-sm text-slate-500">Chọn một bài đã nộp để xem kiến thức còn yếu và luyện tập thích ứng.</p></div>{exams.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><BrainCircuit className="mx-auto size-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-500">Chưa có bài kiểm tra đã nộp để phân tích.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{exams.map((exam) => <article key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><CheckCircle2 className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-wide text-emerald-600">Đã nộp bài</p><h3 className="mt-1 font-black text-slate-950">{exam.title}</h3><p className="mt-1 text-xs text-slate-500">{exam.questions.length} câu · {exam.totalPoints} điểm</p></div></div><Button className="mt-5 w-full" onClick={() => router.push(`/student/attempts/${exam.currentAttempt?.id}/study`)}><BrainCircuit className="size-4" /> Xem phân tích và ôn tập</Button></article>)}</div>}</section>;
}
