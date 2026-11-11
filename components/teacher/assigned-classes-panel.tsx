"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, LoaderCircle, Search, School, UserRound, UsersRound, XCircle } from "lucide-react";
import { useRouter } from "@/lib/portal-navigation";
import { academicDataService } from "@/lib/assessment-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import { Button } from "@/components/ui/button";
import type { ClassRoster, TeacherAssignedClass } from "@/types/assessment";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableLoadingBarRow,
} from "@/components/ui/data-table";
import { Input } from "@/components/ui/form-control";
import { TableScrollArea } from "@/components/ui/table-scroll-area";


function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function TeacherAssignedClassesPanel() {
  const router = useRouter();
  const [classes, setClasses] = useState<TeacherAssignedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [error, setError] = useState("");

  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const loadedClasses = await academicDataService.getTeacherAssignedClasses();
      setClasses(loadedClasses);
      setSelectedClassId((current) => current || loadedClasses[0]?.id || "");
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải danh sách lớp được phân công"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRoster = useCallback(async (classId: string) => {
    if (!classId) {
      setRoster(null);
      return;
    }
    setIsRosterLoading(true);
    setError("");
    try {
      setRoster(await academicDataService.getTeacherAssignedClassRoster(classId));
    } catch (cause) {
      setRoster(null);
      setError(errorMessage(cause, "Không thể tải danh sách học viên"));
    } finally {
      setIsRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    void loadRoster(selectedClassId);
  }, [loadRoster, selectedClassId]);

  const filteredClasses = useMemo(() => {
    return classes.filter((item) => matchesSearchKeyword(item.keyword, search));
  }, [classes, search]);

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;
  const filteredStudents = useMemo(() => {
    const students = roster?.students ?? [];
    return students.filter((student) =>
      matchesSearchKeyword(student.keyword, studentSearch),
    );
  }, [roster, studentSearch]);

  return (
    <div>
      {error ? (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <XCircle className="size-4" /> {error}
        </p>
      ) : null}

      <div className="grid items-start gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex max-h-[calc(100dvh-88px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <header className="border-b border-slate-100 px-4 py-4">
            <h2 className="font-black text-slate-900">Lớp học được phân công</h2>
            <p className="mt-1 text-xs text-slate-500">{filteredClasses.length} lớp đang phụ trách</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo lớp hoặc môn học"
                className="h-[42px] w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </header>

          <div className="min-h-0 space-y-2 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
                <LoaderCircle className="size-4 animate-spin" /> Đang tải lớp học...
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-slate-400">
                <School className="mx-auto mb-3 size-8 text-slate-300" />
                Không tìm thấy lớp phù hợp.
              </div>
            ) : filteredClasses.map((item) => (
              <Button variant="plain"
                type="button"
                key={item.id}
                onClick={() => {
                  setSelectedClassId(item.id);
                  setStudentSearch("");
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${selectedClassId === item.id ? "border-brand-300 bg-brand-50 ring-2 ring-brand-100" : "border-slate-100 hover:border-brand-200 hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-brand-600">{item.code}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                    <UsersRound className="size-3" /> {item.studentCount}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.isHomeroomTeacher ? <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">Giáo viên chủ nhiệm</span> : null}
                  {item.subjects.map((subject) => (
                    <span key={subject.id} className="rounded-md bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">
                      {subject.code}
                    </span>
                  ))}
                </div>
              </Button>
            ))}
          </div>
        </section>

        <section className="flex max-h-[calc(100dvh-88px)] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <header className="flex min-h-[73px] items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-black text-slate-900">{selectedClass?.name ?? "Danh sách học viên"}</h2>
              <p className="mt-1 truncate text-xs text-slate-500">
                {selectedClass ? `${selectedClass.code} · ${selectedClass.subjects.length ? selectedClass.subjects.map(getVietnameseSubjectName).join(", ") : "Lớp chủ nhiệm"}` : "Chọn một lớp để xem chi tiết"}
              </p>
            </div>
            {selectedClass ? <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:inline-flex">
                <BookOpenCheck className="size-4" /> Đang phụ trách
              </span>
              <Button size="sm" onClick={() => router.push(`/teacher/classes/${selectedClass.id}`)}>
                Vào lớp học <ArrowRight className="size-4" />
              </Button>
            </div> : null}
          </header>

          <div className="shrink-0 border-b border-slate-100 p-2.5">
            <div className="relative w-full max-w-[360px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Tìm theo tên hoặc tài khoản học viên"
                disabled={!selectedClass || isRosterLoading}
                className="h-[42px] w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <TableScrollArea className="min-h-0">
            <Table className="min-w-[720px]">
              <TableHeader className="!bg-brand-600 !text-white">
                <tr>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead>Học viên</TableHead>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {isRosterLoading ? <TableLoadingBarRow colSpan={4} /> : null}
                {!isRosterLoading && !selectedClass ? (
                  <TableEmptyRow colSpan={4} message="Chọn một lớp để xem danh sách học viên" icon={<School className="size-5 text-slate-400" />} />
                ) : null}
                {!isRosterLoading && selectedClass && !roster?.students.length ? (
                  <TableEmptyRow colSpan={4} message="Lớp chưa có học viên" />
                ) : null}
                {!isRosterLoading && selectedClass && Boolean(roster?.students.length) && filteredStudents.length === 0 ? (
                  <TableEmptyRow colSpan={4} message="Không tìm thấy học viên phù hợp" />
                ) : null}
                {!isRosterLoading ? filteredStudents.map((student, index) => (
                  <tr
                    key={student.id}
                    tabIndex={0}
                    onClick={() => router.push(`/teacher/students/${encodeURIComponent(student.id)}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/teacher/students/${encodeURIComponent(student.id)}`);
                      }
                    }}
                    className="cursor-pointer transition hover:bg-blue-50/70 focus-visible:bg-blue-50 focus-visible:outline-none"
                  >
                    <TableCell className="text-center text-xs text-slate-400">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand-700">
                          {student.fullName.trim().charAt(0).toUpperCase() || <UserRound className="size-4" />}
                        </span>
                        <span className="font-bold text-slate-900">{student.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-brand-700">{student.accountName}</TableCell>
                    <TableCell><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Đang hoạt động</span></TableCell>
                  </tr>
                )) : null}
              </TableBody>
            </Table>
          </TableScrollArea>
        </section>
      </div>
    </div>
  );
}
