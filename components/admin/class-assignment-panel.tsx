"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect, Input, type CustomSelectOption, Checkbox } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableLoadingBarRow,
} from "@/components/ui/data-table";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import { normalizeSearchKeyword } from "@/lib/search-keyword";
import type { ClassRoster } from "@/types/assessment";
import type { UsersPage } from "@/types/users";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const AVAILABLE_STUDENT_LIMIT = 20;

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  return error.details.length > 0 ? error.details.join(" · ") : error.message;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

export function ClassStudentAssignmentContent({ classId }: { classId: string }) {
  const { notify } = useActionNotification();
  const [availableStudents, setAvailableStudents] = useState<ClassRoster["students"]>([]);
  const [availableStudentTotal, setAvailableStudentTotal] = useState(0);
  const [availableStudentOffset, setAvailableStudentOffset] = useState(0);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [teacherOptions, setTeacherOptions] = useState<CustomSelectOption[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isTeacherSearching, setIsTeacherSearching] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isAvailableLoading, setIsAvailableLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const availableRequestId = useRef(0);
  const teacherRequestId = useRef(0);
  const studentSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAvailableStudents = useCallback(async (offset = 0, search = "") => {
    const requestId = ++availableRequestId.current;
    setIsAvailableLoading(true);
    try {
      const result = await academicDataService.getAvailableStudents(classId, {
        offset,
        limit: AVAILABLE_STUDENT_LIMIT,
        search,
      });
      if (requestId !== availableRequestId.current) return;
      setAvailableStudents(shuffled(result.items));
      setAvailableStudentTotal(result.total);
      setAvailableStudentOffset(result.offset);
    } catch (cause) {
      if (requestId === availableRequestId.current) {
        setError(getErrorMessage(cause, "Không thể tải danh sách học sinh chưa có lớp"));
      }
    } finally {
      if (requestId === availableRequestId.current) setIsAvailableLoading(false);
    }
  }, [classId]);

  const loadRoster = useCallback(async () => {
    if (!classId) return;
    setIsRosterLoading(true);
    setError("");
    try {
      const result = await academicDataService.getClassRoster(classId);
      setRoster(result);
      setSelectedTeacherId(result.teachers[0]?.id ?? "");
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể tải danh sách phân công"));
    } finally {
      setIsRosterLoading(false);
    }
  }, [classId]);

  const loadTeachers = useCallback(async (search = "") => {
    const requestId = ++teacherRequestId.current;
    setIsTeacherSearching(true);
    try {
      const params = new URLSearchParams({ role: "TEACHER", status: "ACTIVE", limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      const result = await authenticatedRequest<UsersPage>(`/users?${params.toString()}`);
      if (requestId === teacherRequestId.current) {
        setTeacherOptions(result.items.map((teacher) => ({ value: teacher.id, label: `${teacher.fullName} · ${teacher.accountName}` })));
      }
    } catch (cause) {
      if (requestId === teacherRequestId.current) setError(getErrorMessage(cause, "Không thể tải danh sách giáo viên"));
    } finally {
      if (requestId === teacherRequestId.current) setIsTeacherSearching(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void loadRoster().finally(() => setIsLoading(false));
  }, [loadRoster]);

  useEffect(() => { void loadTeachers(); }, [loadTeachers]);

  useEffect(() => () => {
    if (studentSearchTimerRef.current) clearTimeout(studentSearchTimerRef.current);
  }, []);

  const availableStudentPage = Math.floor(availableStudentOffset / AVAILABLE_STUDENT_LIMIT) + 1;
  const availableStudentTotalPages = Math.max(1, Math.ceil(availableStudentTotal / AVAILABLE_STUDENT_LIMIT));
  const allPageSelected = availableStudents.length > 0
    && availableStudents.every((student) => selectedStudentIds.includes(student.id));
  const normalizedRosterSearch = normalizeSearchKeyword(rosterSearch);
  const filteredRosterStudents = (roster?.students ?? []).filter((student) =>
    !normalizedRosterSearch
    || normalizeSearchKeyword(student.keyword, student.fullName, student.accountName).includes(normalizedRosterSearch),
  );

  function openStudentPicker() {
    if (studentSearchTimerRef.current) clearTimeout(studentSearchTimerRef.current);
    setSelectedStudentIds([]);
    setStudentSearch("");
    setAvailableStudents([]);
    setAvailableStudentTotal(0);
    setAvailableStudentOffset(0);
    setIsStudentPickerOpen(true);
    void loadAvailableStudents(0, "");
  }

  function handleStudentSearchChange(value: string) {
    setStudentSearch(value);
    if (studentSearchTimerRef.current) clearTimeout(studentSearchTimerRef.current);
    studentSearchTimerRef.current = setTimeout(() => {
      void loadAvailableStudents(0, value);
    }, 300);
  }

  function changeAvailableStudentPage(page: number) {
    void loadAvailableStudents((page - 1) * AVAILABLE_STUDENT_LIMIT, studentSearch);
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  function toggleAllPageStudents() {
    const pageIds = availableStudents.map((student) => student.id);
    setSelectedStudentIds((current) => {
      if (allPageSelected) return current.filter((id) => !pageIds.includes(id));
      return [...new Set([...current, ...pageIds])];
    });
  }

  async function assignSelectedStudents() {
    if (selectedStudentIds.length === 0) return;
    setSaving("students");
    setError("");
    try {
      for (const studentId of selectedStudentIds) {
        await academicDataService.assignClassStudent(classId, studentId);
      }
      const assignedCount = selectedStudentIds.length;
      setSelectedStudentIds([]);
      setIsStudentPickerOpen(false);
      await loadRoster();
      notify(`Đã thêm ${assignedCount} học sinh vào lớp`, { key: "class-students-assigned" });
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể thêm học sinh vào lớp"));
      await Promise.all([loadRoster(), loadAvailableStudents(0, studentSearch)]);
    } finally {
      setSaving("");
    }
  }

  async function removeStudent(studentId: string) {
    setSaving(`student-${studentId}`);
    setError("");
    try {
      await academicDataService.removeClassStudent(classId, studentId);
      await loadRoster();
      notify("Đã xóa học sinh khỏi lớp", { key: "class-student-removed" });
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể xóa học sinh khỏi lớp"));
    } finally {
      setSaving("");
    }
  }

  async function assignHomeroomTeacher() {
    if (!selectedTeacherId || selectedTeacherId === roster?.teachers[0]?.id) return;
    setSaving("homeroom");
    setError("");
    try {
      await academicDataService.assignClassHomeroomTeacher(classId, selectedTeacherId);
      await loadRoster();
      notify("Đã phân công giáo viên chủ nhiệm", { key: "class-homeroom-assigned" });
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể phân công giáo viên chủ nhiệm"));
    } finally {
      setSaving("");
    }
  }

  async function removeHomeroomTeacher() {
    const teacherId = roster?.teachers[0]?.id;
    if (!teacherId) return;
    setSaving("homeroom");
    setError("");
    try {
      await academicDataService.removeClassHomeroomTeacher(classId, teacherId);
      await loadRoster();
      notify("Đã hủy phân công giáo viên chủ nhiệm", { key: "class-homeroom-removed" });
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể hủy phân công giáo viên chủ nhiệm"));
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5">
      {error ? <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"><XCircle className="size-4" />{error}</p> : null}
      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-black text-slate-900">Giáo viên chủ nhiệm</h3>
        <p className="mt-1 text-xs text-slate-500">Mỗi lớp có một giáo viên chủ nhiệm; người được phân công có thể theo dõi học sinh của lớp.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <CustomSelect
              label="Giáo viên"
              value={selectedTeacherId}
              options={[
                { value: "", label: "Chọn giáo viên chủ nhiệm" },
                ...(roster?.teachers[0] && !teacherOptions.some((option) => option.value === roster.teachers[0].id)
                  ? [{ value: roster.teachers[0].id, label: `${roster.teachers[0].fullName} · ${roster.teachers[0].accountName}` }]
                  : []),
                ...teacherOptions,
              ]}
              searchable
              isSearching={isTeacherSearching}
              onSearchChange={(value) => void loadTeachers(value)}
              searchPlaceholder="Tìm giáo viên..."
              onValueChange={setSelectedTeacherId}
            />
          </div>
          <Button permission="classes.assign" size="sm" disabled={!selectedTeacherId || selectedTeacherId === roster?.teachers[0]?.id || Boolean(saving)} onClick={() => void assignHomeroomTeacher()}>{saving === "homeroom" ? <LoaderCircle className="size-4 animate-spin" /> : null}Phân công</Button>
          {roster?.teachers[0] ? <Button permission="classes.assign" variant="outline" size="sm" disabled={Boolean(saving)} onClick={() => void removeHomeroomTeacher()}>Hủy phân công</Button> : null}
        </div>
      </section>
      {isLoading || isRosterLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải danh sách học sinh...</div>
      ) : (
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <h3 className="font-black">Danh sách học sinh</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {normalizedRosterSearch
                    ? `${filteredRosterStudents.length}/${roster?.students.length ?? 0} học sinh phù hợp`
                    : `${roster?.students.length ?? 0} học sinh trong lớp`}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  icon={Search}
                  type="search"
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                  placeholder="Tìm theo tên hoặc tài khoản"
                  aria-label="Tìm học sinh trong lớp"
                  className="sm:w-64"
                />
                <Button permission="classes.assign" size="sm" onClick={openStudentPicker} disabled={Boolean(saving)}><Plus className="size-4" />Thêm học sinh</Button>
              </div>
            </div>
            <TableScrollArea>
              <Table className="min-w-[620px]">
                <TableHeader className="sticky top-0 !bg-brand-600 !text-white"><tr><TableHead className="w-14 text-center">#</TableHead><TableHead>Họ và tên</TableHead><TableHead>Tài khoản</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-20 text-right">Thao tác</TableHead></tr></TableHeader>
                <TableBody>
                  {filteredRosterStudents.length ? filteredRosterStudents.map((item, index) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/70">
                      <TableCell className="text-center text-xs text-slate-400">{index + 1}</TableCell>
                      <TableCell className="font-bold text-slate-900">{item.fullName}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-brand-700">{item.accountName}</TableCell>
                      <TableCell><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Đang hoạt động</span></TableCell>
                      <TableCell className="text-right"><Button permission="classes.assign" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label={`Xóa ${item.fullName} khỏi lớp`} onClick={() => void removeStudent(item.id)} disabled={Boolean(saving)}>{saving === `student-${item.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</Button></TableCell>
                    </tr>
                  )) : <TableEmptyRow colSpan={5} message={normalizedRosterSearch ? "Không tìm thấy học sinh phù hợp" : "Lớp chưa có học sinh"} />}
                </TableBody>
              </Table>
            </TableScrollArea>
          </section>
      )}

      <Modal
        open={isStudentPickerOpen}
        title="Thêm học sinh vào lớp"
        description="Chỉ hiển thị học sinh chưa thuộc lớp nào trong năm học này."
        width="max-w-3xl"
        layerClassName="z-[110]"
        bodyClassName="!p-0"
        onClose={() => { if (saving !== "students") setIsStudentPickerOpen(false); }}
        footer={(
          <>
            <span className="mr-auto text-sm font-semibold text-slate-500">Đã chọn {selectedStudentIds.length} học sinh</span>
            <Button variant="outline" onClick={() => setIsStudentPickerOpen(false)} disabled={saving === "students"}>Hủy</Button>
            <Button permission="classes.assign" onClick={() => void assignSelectedStudents()} disabled={selectedStudentIds.length === 0 || saving === "students"}>
              {saving === "students" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Thêm {selectedStudentIds.length > 0 ? selectedStudentIds.length : ""} học sinh
            </Button>
          </>
        )}
      >
        <div className="border-b border-slate-100 p-4">
          <div className="max-w-sm">
            <Input icon={Search} value={studentSearch} onChange={(event) => handleStudentSearchChange(event.target.value)} placeholder="Tìm theo tên hoặc tài khoản" />
          </div>
        </div>
        <TableScrollArea>
          <Table className="min-w-[640px]">
            <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center"><Checkbox type="checkbox" checked={allPageSelected} onChange={toggleAllPageStudents} disabled={availableStudents.length === 0 || isAvailableLoading} className="size-4 accent-brand-600" aria-label="Chọn tất cả học sinh trên trang này" /></TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Tài khoản</TableHead>
                <TableHead className="w-36">Trạng thái</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isAvailableLoading ? <TableLoadingBarRow colSpan={4} /> : null}
              {!isAvailableLoading && availableStudents.length === 0 ? <TableEmptyRow colSpan={4} message={studentSearch ? "Không tìm thấy học sinh phù hợp" : "Không còn học sinh chưa có lớp"} /> : null}
              {!isAvailableLoading ? availableStudents.map((student) => (
                <tr key={student.id} className={`cursor-pointer transition hover:bg-slate-50/70 ${selectedStudentIds.includes(student.id) ? "bg-blue-50/70" : ""}`} onClick={() => toggleStudent(student.id)}>
                  <TableCell className="text-center"><Checkbox type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} onClick={(event) => event.stopPropagation()} className="size-4 accent-brand-600" aria-label={`Chọn ${student.fullName}`} /></TableCell>
                  <TableCell className="font-bold text-slate-900">{student.fullName}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-brand-700">{student.accountName}</TableCell>
                  <TableCell><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Chưa có lớp</span></TableCell>
                </tr>
              )) : null}
            </TableBody>
          </Table>
        </TableScrollArea>
        {!isAvailableLoading && availableStudentTotal > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-slate-500">
              Hiển thị <b className="text-slate-700">{availableStudentOffset + 1}–{Math.min(availableStudentOffset + availableStudents.length, availableStudentTotal)}</b> trong <b className="text-slate-700">{availableStudentTotal}</b> học sinh
            </span>
            <Pagination page={availableStudentPage} totalPages={availableStudentTotalPages} onChange={changeAvailableStudentPage} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
