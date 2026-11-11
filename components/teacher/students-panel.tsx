"use client";

import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { useRouter } from "@/lib/portal-navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableLoadingBarRow,
} from "@/components/ui/data-table";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { CustomSelect } from "@/components/ui/form-control";
import { academicDataService } from "@/lib/assessment-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import type {
  TeacherAssignedClass,
  TeacherManagedStudent,
} from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const statusLabels: Record<TeacherManagedStudent["status"], string> = {
  PENDING: "Chờ đăng nhập",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  INACTIVE: "Ngừng hoạt động",
};

function getStatusClass(status: TeacherManagedStudent["status"]): string {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "LOCKED") return "bg-rose-50 text-rose-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function getInitial(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "?";
}

export function TeacherStudentsPanel() {
  const router = useRouter();
  const [students, setStudents] = useState<TeacherManagedStudent[]>([]);
  const [classes, setClasses] = useState<TeacherAssignedClass[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [loadedStudents, loadedClasses] = await Promise.all([
        academicDataService.getTeacherManagedStudents(),
        academicDataService.getTeacherAssignedClasses(),
      ]);
      setStudents(loadedStudents);
      setClasses(loadedClasses);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể tải danh sách học sinh đang quản lý",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          (!classId
            || student.classes.some((schoolClass) => schoolClass.id === classId))
          && matchesSearchKeyword(student.keyword, submittedSearch),
      ),
    [classId, students, submittedSearch],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / pageSize),
  );
  const pagedStudents = filteredStudents.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="flex max-h-[calc(100dvh-88px)] min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
        <ResponsiveFilterToolbar
 search={<DebouncedSearchInput
              className="!h-[42px] !rounded-lg focus:!ring-0"
              value={search}
              onValueChange={setSearch}
              onSearch={(value) => {
                setPage(1);
                setSubmittedSearch(value);
              }}
              placeholder="Tìm theo tên, email hoặc tài khoản"
            />}
 filters={[
 { id: "class", label: "Lớp học", width: 260, active: Boolean(classId), content: (<CustomSelect
              value={classId}
              options={[
                { value: "", label: "Tất cả lớp phụ trách" },
                ...classes.map((schoolClass) => ({
                  value: schoolClass.id,
                  label: `${schoolClass.code} · ${schoolClass.name}`,
                })),
              ]}
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              ariaLabel="Lọc theo lớp"
              onValueChange={(value) => {
                setClassId(value);
                setPage(1);
              }}
            />) }
 ]}
 onReset={() => { setClassId(""); setPage(1); }}
 />
      </div>

      <section className="mt-2 flex min-h-0 shrink flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <XCircle className="size-4" /> {error}
          </p>
        ) : null}
        <TableScrollArea className="min-h-0 shrink">
          <Table className="min-w-[920px]">
            <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead>Học sinh</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Tài khoản</TableHead>
                <TableHead className="text-center">Lớp học</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingBarRow colSpan={6} /> : null}
              {!isLoading && filteredStudents.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  icon={<UsersRound className="size-5 text-slate-400" />}
                  message={
                    students.length === 0
                      ? "Chưa có học sinh trong các lớp được phân công"
                      : "Không tìm thấy học sinh phù hợp"
                  }
                />
              ) : null}
              {!isLoading
                ? pagedStudents.map((student, index) => (
                    <tr
                      key={student.id}
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/teacher/students/${encodeURIComponent(student.id)}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(
                            `/teacher/students/${encodeURIComponent(student.id)}`,
                          );
                        }
                      }}
                      className="cursor-pointer transition hover:bg-blue-50/70 focus-visible:bg-blue-50 focus-visible:outline-none"
                    >
                      <TableCell className="text-center text-xs text-slate-400">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-brand-700">
                            {student.avatarUrl ? (
                              <span
                                className="size-full bg-cover bg-center"
                                style={{ backgroundImage: `url(${student.avatarUrl})` }}
                              />
                            ) : (
                              getInitial(student.fullName)
                            )}
                          </span>
                          <span className="font-bold text-slate-900">{student.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.email ? (
                          <a
                            href={`mailto:${student.email}`}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
                          >
                            <Mail className="size-3.5" /> {student.email}
                          </a>
                        ) : (
                          <span className="text-slate-400">Chưa cập nhật</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold text-slate-600">
                        {student.accountName}
                      </TableCell>
                      <TableCell>
                        <div className="mx-auto flex max-w-72 flex-wrap justify-center gap-1.5">
                          {student.classes.map((schoolClass) => (
                            <span
                              key={schoolClass.id}
                              title={schoolClass.name}
                              className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand-700"
                            >
                              {schoolClass.code}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClass(student.status)}`}>
                          {statusLabels[student.status]}
                        </span>
                      </TableCell>
                    </tr>
                  ))
                : null}
            </TableBody>
          </Table>
        </TableScrollArea>
        <DataTableFooter
          className="shrink-0 bg-white"
          rowCount={pagedStudents.length}
          totalItems={filteredStudents.length}
          itemLabel="học sinh"
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </div>
  );
}
