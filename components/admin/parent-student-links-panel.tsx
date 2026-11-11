"use client";

import { defineToolbarFilter, ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Edit3, Link2, LoaderCircle, Plus, Search, Unlink, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { CustomSelect, Textarea, Input } from "@/components/ui/form-control";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Modal } from "@/components/ui/modal";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import type { User } from "@/types/auth";
import type { ParentStudentLink, ParentStudentLinksPage, UsersPage } from "@/types/users";
import type { SchoolClass } from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  return error.details.length ? error.details.join(" · ") : error.message;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const relationshipLabels = {
  FATHER: "Cha",
  MOTHER: "Mẹ",
  GUARDIAN: "Người giám hộ",
  OTHER: "Khác",
} as const;

function classLabel(student: User) {
  const assigned = student.assignedClass;
  if (!assigned) return "Chưa xếp lớp";
  return assigned.name && assigned.name !== assigned.code ? `${assigned.code} · ${assigned.name}` : assigned.code || assigned.name;
}

function UserLookup({
  label,
  role,
  value,
  onChange,
  onSelect,
}: {
  label: string;
  role: "PARENT" | "STUDENT";
  value: User | null;
  onChange: (user: User | null) => void;
  onSelect?: (user: User) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);
  const lookupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!lookupRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ role, status: "ACTIVE", page: "1", limit: "20" });
        if (query.trim()) params.set("search", query.trim());
        const page = await authenticatedRequest<UsersPage>(`/users?${params.toString()}`);
        if (currentRequest === requestId.current) setResults(page.items);
      } catch {
        if (currentRequest === requestId.current) setResults([]);
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query, role]);

  return (
    <div ref={lookupRef} className="relative">
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={open ? query : value ? `${value.fullName} · ${value.accountName}` : ""}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          placeholder={`Tìm ${role === "PARENT" ? "phụ huynh" : "học sinh"} theo tên hoặc tài khoản`}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-blue-100"
        />
        {value ? <Button variant="plain" type="button" aria-label={`Bỏ chọn ${label.toLowerCase()}`} onClick={() => { onChange(null); setQuery(""); setOpen(false); }} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</Button> : null}
      </div>
      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {loading ? <p className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Đang tìm kiếm…</p> : null}
          {!loading && !results.length ? <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy tài khoản phù hợp.</p> : null}
          {!loading && results.map((user) => (
            <Button variant="plain" key={user.id} type="button" onClick={() => { if (onSelect) onSelect(user); else onChange(user); setOpen(false); setQuery(""); }} className="block w-full px-3 py-2.5 text-left hover:bg-blue-50">
              <span className="block text-sm font-semibold text-slate-800">{user.fullName}</span>
              <span className="block text-xs text-slate-500">{user.accountName}{role === "STUDENT" ? ` · ${classLabel(user)}` : ""}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ParentStudentLinksPanel() {
  const { notify } = useActionNotification();
  const [parent, setParent] = useState<User | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [relationshipType, setRelationshipType] = useState<"FATHER" | "MOTHER" | "GUARDIAN" | "OTHER">("GUARDIAN");
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [linkedDateRange, setLinkedDateRange] = useState({ from: "", to: "" });
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [removing, setRemoving] = useState<ParentStudentLink | null>(null);
  const [removingId, setRemovingId] = useState("");
  const [editing, setEditing] = useState<ParentStudentLink | null>(null);
  const [editRelationshipType, setEditRelationshipType] = useState<"FATHER" | "MOTHER" | "GUARDIAN" | "OTHER">("GUARDIAN");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (submittedSearch) params.set("search", submittedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (classFilter) params.set("classId", classFilter);
      if (linkedDateRange.from) params.set("createdFrom", linkedDateRange.from);
      if (linkedDateRange.to) params.set("createdTo", linkedDateRange.to);
      const result = await authenticatedRequest<ParentStudentLinksPage>(`/users/parent-student-links?${params.toString()}`);
      setLinks(result.items);
      setTotal(result.meta.total);
      setTotalPages(Math.max(1, result.meta.totalPages));
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải danh sách liên kết"));
    } finally {
      setLoading(false);
    }
  }, [classFilter, limit, linkedDateRange.from, linkedDateRange.to, page, statusFilter, submittedSearch]);

  useEffect(() => { void loadLinks(); }, [loadLinks]);
  useEffect(() => { void academicDataService.getClasses(undefined, true).then(setClasses).catch(() => setClasses([])); }, []);

  async function createLink() {
    if (!parent || !students.length) return;
    setLinking(true);
    setError("");
    try {
      const result = await authenticatedRequest<{ createdStudentIds: string[]; duplicateStudentIds: string[]; status: "PENDING" | "ACTIVE" }>("/users/parent-student-links", {
        method: "POST",
        body: JSON.stringify({ parentId: parent.id, studentIds: students.map((student) => student.id), relationshipType }),
      });
      if (result.createdStudentIds.length) {
        notify(result.status === "PENDING" ? `Đã gửi ${result.createdStudentIds.length} liên kết chờ duyệt` : `Đã tạo ${result.createdStudentIds.length} liên kết`, { key: "parent-student-link-created" });
      }
      setLinkModalOpen(false);
      setParent(null);
      setStudents([]);
      if (page === 1) await loadLinks();
      else setPage(1);
      if (result.duplicateStudentIds.length) setError(`${result.duplicateStudentIds.length} học sinh đã có liên kết đang hiệu lực hoặc chờ duyệt.`);
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tạo liên kết"));
    } finally {
      setLinking(false);
    }
  }

  async function removeLink() {
    if (!removing) return;
    setRemovingId(removing.id);
    setError("");
    try {
      await authenticatedRequest<Record<string, never>>(`/users/${encodeURIComponent(removing.parent.id)}/children/${encodeURIComponent(removing.student.id)}`, { method: "DELETE" });
      notify("Đã hủy liên kết phụ huynh với học sinh", { key: "parent-student-link-removed" });
      setRemoving(null);
      if (links.length === 1 && page > 1) setPage((current) => current - 1);
      else await loadLinks();
    } catch (cause) {
      setError(errorMessage(cause, "Không thể hủy liên kết"));
    } finally {
      setRemovingId("");
    }
  }

  async function updateLinkStatus(link: ParentStudentLink, action: "approve" | "reject") {
    setRemovingId(link.id);
    setError("");
    try {
      await authenticatedRequest<Record<string, never>>(
        `/users/${encodeURIComponent(link.parent.id)}/children/${encodeURIComponent(link.student.id)}/${action}`,
        { method: "PATCH" },
      );
      notify(action === "approve" ? "Đã duyệt liên kết" : "Đã từ chối liên kết", { key: `parent-student-link-${action}` });
      await loadLinks();
    } catch (cause) {
      setError(errorMessage(cause, action === "approve" ? "Không thể duyệt liên kết" : "Không thể từ chối liên kết"));
    } finally {
      setRemovingId("");
    }
  }

  function openEdit(link: ParentStudentLink) {
    setEditing(link);
    setEditRelationshipType(link.relationshipType);
    setEditNote(link.note ?? "");
    setError("");
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    setError("");
    try {
      await authenticatedRequest<Record<string, never>>(`/users/${encodeURIComponent(editing.parent.id)}/children/${encodeURIComponent(editing.student.id)}`, { method: "PATCH", body: JSON.stringify({ relationshipType: editRelationshipType, note: editNote }) });
      setEditing(null);
      await loadLinks();
      notify("Đã cập nhật thông tin liên kết", { key: "parent-student-link-updated" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể cập nhật liên kết"));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="w-full">
      <section className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
          <ResponsiveFilterToolbar
 search={<DebouncedSearchInput
            value={search}
            onValueChange={setSearch}
            onSearch={(value) => {
              setSubmittedSearch(value);
              setPage(1);
            }}
            placeholder="Tìm phụ huynh hoặc học sinh"
              />}
 filters={[
 defineToolbarFilter({ id: "status", label: "Trạng thái", width: 208, active: Boolean(statusFilter), value: String(statusFilter), defaultValue: "", onChange: (value) => { setStatusFilter(value); setPage(1); }, render: (value, onChange) => (<CustomSelect className="w-full sm:w-52" value={value} onValueChange={onChange} options={[{ value: "", label: "Tất cả trạng thái" }, { value: "ACTIVE", label: "Đang hiệu lực" }, { value: "PENDING", label: "Chờ duyệt" }, { value: "REJECTED", label: "Từ chối" }, { value: "REVOKED", label: "Đã hủy" }]} ariaLabel="Lọc theo trạng thái" />) }),
 defineToolbarFilter({ id: "class", label: "Lớp học", width: 224, active: Boolean(classFilter), value: String(classFilter), defaultValue: "", onChange: (value) => { setClassFilter(value); setPage(1); }, render: (value, onChange) => (<CustomSelect className="w-full sm:w-56" value={value} onValueChange={onChange} options={[{ value: "", label: "Tất cả lớp học" }, ...classes.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))]} ariaLabel="Lọc theo lớp học" searchable />) }),
 defineToolbarFilter({ id: "dates", label: "Ngày liên kết", width: 240, active: Boolean(linkedDateRange.from || linkedDateRange.to), fullWidth: true, value: linkedDateRange, defaultValue: { from: "", to: "" }, onChange: (value) => { setLinkedDateRange(value); setPage(1); }, render: (value, onChange) => (<DateRangePicker {...value} onChange={onChange} onClear={() => onChange({ from: "", to: "" })} className="w-full sm:w-60" buttonClassName="!h-[42px] !rounded-lg !px-2.5 !ring-0" />) })
 ]}

 actions={<Button
            permission="parent_links.assign"
            className="h-[42px] shrink-0 !rounded-lg"
            onClick={() => {
              setError("");
              setParent(null);
              setStudents([]);
              setLinkModalOpen(true);
            }}
          >
            <Plus className="size-4" /> Tạo mới
            </Button>}
 />
        </div>
        {error && !linkModalOpen ? (
          <p className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <TableScrollArea>
          <Table className="min-w-[940px]">
            <TableHeader className="!bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center">STT</TableHead>
                <TableHead>Phụ huynh</TableHead>
                <TableHead>Học sinh</TableHead>
                <TableHead>Lớp học</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày liên kết</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? <TableLoadingBarRow colSpan={7} /> : null}
              {!loading && !links.length ? (
                <TableEmptyRow colSpan={7} message="Chưa có liên kết phù hợp." />
              ) : null}
              {!loading
                ? links.map((link, index) => (
                    <tr key={link.id} className="transition hover:bg-slate-50/70">
                      <TableCell className="text-center text-slate-400">{(page - 1) * limit + index + 1}</TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-900">{link.parent.fullName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{link.parent.accountName} · {relationshipLabels[link.relationshipType]}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-900">{link.student.fullName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{link.student.accountName}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{classLabel(link.student)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${link.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : link.status === "PENDING" ? "bg-amber-50 text-amber-700" : link.status === "REVOKED" ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700"}`}>
                          {link.status === "ACTIVE" ? "Đang hiệu lực" : link.status === "PENDING" ? "Chờ duyệt" : link.status === "REVOKED" ? "Đã hủy" : "Từ chối"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        <p>{formatDate(link.createdAt)}</p>
                        {link.revokedAt ? <p className="mt-0.5 text-xs text-slate-400">Hủy: {formatDate(link.revokedAt)}</p> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button permission="parent_links.update" variant="ghost" size="sm" aria-label="Chỉnh sửa thông tin liên kết" onClick={() => openEdit(link)}><Edit3 className="size-4" />Chỉnh sửa</Button>
                        {link.status === "PENDING" ? <>
                        <Button permission="parent_links.approve" variant="ghost" size="sm" className="text-emerald-700 hover:bg-emerald-50" onClick={() => void updateLinkStatus(link, "approve")}><Check className="size-4" />Duyệt</Button>
                        <Button permission="parent_links.approve" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => void updateLinkStatus(link, "reject")}><XCircle className="size-4" />Từ chối</Button>
                        </> : null}
                        {link.status === "ACTIVE" ? <Button
                          permission="parent_links.delete"
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50"
                          disabled={Boolean(removingId)}
                          onClick={() => setRemoving(link)}
                        >
                          {removingId === link.id ? <LoaderCircle className="size-4 animate-spin" /> : <Unlink className="size-4" />}
                          Hủy liên kết
                        </Button> : null}
                      </TableCell>
                    </tr>
                  ))
                : null}
            </TableBody>
          </Table>
        </TableScrollArea>
        <DataTableFooter
          rowCount={links.length}
          totalItems={total}
          itemLabel="liên kết"
          page={page}
          totalPages={totalPages}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </section>
      <Modal
        open={linkModalOpen}
        title="Tạo liên kết phụ huynh – học sinh"
        description="Chọn phụ huynh và học sinh cần liên kết."
        width="max-w-2xl"
        onClose={() => !linking && setLinkModalOpen(false)}
        footer={(
          <>
            <Button variant="outline" onClick={() => setLinkModalOpen(false)} disabled={linking}>Hủy</Button>
            <Button
              permission="parent_links.assign"
              disabled={!parent || !students.length || linking}
              onClick={() => void createLink()}
            >
              {linking ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              {linking ? "Đang liên kết" : "Tạo liên kết"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <UserLookup label="Phụ huynh" role="PARENT" value={parent} onChange={setParent} />
          <div>
            <UserLookup label="Học sinh" role="STUDENT" value={null} onChange={() => undefined} onSelect={(student) => setStudents((current) => current.some((item) => item.id === student.id) ? current : [...current, student])} />
            {students.length ? <div className="mt-2 flex flex-wrap gap-2">{students.map((student) => <span key={student.id} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-sm font-semibold text-brand-700">{student.fullName}<Button variant="plain" type="button" aria-label={`Bỏ chọn ${student.fullName}`} onClick={() => setStudents((current) => current.filter((item) => item.id !== student.id))}>×</Button></span>)}</div> : <p className="mt-2 text-xs text-slate-500">Có thể chọn nhiều học sinh.</p>}
          </div>
        </div>
        <CustomSelect
          label="Mối quan hệ"
          className="mt-5"
          value={relationshipType}
          onValueChange={(value) => setRelationshipType(value as typeof relationshipType)}
          options={[
            { value: "FATHER", label: "Cha" },
            { value: "MOTHER", label: "Mẹ" },
            { value: "GUARDIAN", label: "Người giám hộ" },
            { value: "OTHER", label: "Khác" },
          ]}
        />
        {error ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(editing)}
        title="Chỉnh sửa thông tin liên kết"
        description="Chỉ cập nhật mối quan hệ và ghi chú; không thể đổi phụ huynh hoặc học sinh."
        onClose={() => !savingEdit && setEditing(null)}
        footer={<><Button variant="outline" disabled={savingEdit} onClick={() => setEditing(null)}>Hủy</Button><Button permission="parent_links.update" disabled={savingEdit} onClick={() => void saveEdit()}>{savingEdit ? <LoaderCircle className="size-4 animate-spin" /> : <Edit3 className="size-4" />}{savingEdit ? "Đang lưu" : "Lưu thay đổi"}</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-slate-400">Phụ huynh</p><p className="mt-1 font-bold text-slate-800">{editing?.parent.fullName}</p></div><div><p className="text-xs text-slate-400">Học sinh</p><p className="mt-1 font-bold text-slate-800">{editing?.student.fullName}</p></div></div>
        <CustomSelect className="mt-5" label="Mối quan hệ" value={editRelationshipType} onValueChange={(value) => setEditRelationshipType(value as typeof editRelationshipType)} options={[{ value: "FATHER", label: "Cha" }, { value: "MOTHER", label: "Mẹ" }, { value: "GUARDIAN", label: "Người giám hộ" }, { value: "OTHER", label: "Khác" }]} />
        <Textarea className="mt-5" label="Ghi chú" value={editNote} maxLength={500} onChange={(event) => setEditNote(event.target.value)} placeholder="Nhập ghi chú (nếu có)" />
        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p> : null}
      </Modal>
      <ConfirmationDialog
        open={Boolean(removing)}
        title="Hủy liên kết phụ huynh – học sinh?"
        confirmLabel="Hủy liên kết"
        confirmVariant="danger"
        loading={Boolean(removingId)}
        onClose={() => !removingId && setRemoving(null)}
        onConfirm={() => void removeLink()}
      >
        Phụ huynh <strong>{removing?.parent.fullName}</strong> sẽ không còn xem được thông tin của học sinh <strong>{removing?.student.fullName}</strong>.
      </ConfirmationDialog>
    </div>
  );
}
