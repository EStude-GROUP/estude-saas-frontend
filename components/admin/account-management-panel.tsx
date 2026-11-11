"use client";

import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Download,
  FileSpreadsheet,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Upload,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { loadAccountDirectory } from "@/lib/account-directory";
import { AccountPasswordResetPanel } from "./account-password-reset-panel";
import { Button } from "@/components/ui/button";
import { AuditActor } from "@/components/admin/audit-actor";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { CustomSelect, Input, FileInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { usePermissions } from "@/context/permissions-context";
import { useActionNotification } from "@/components/ui/action-notification";
import {
  ApiError,
  authenticatedBlobRequest,
  authenticatedRequest,
  authenticatedUploadRequest,
} from "@/lib/auth-api";
import type { User, UserRole, UserStatus } from "@/types/auth";
import type { ImportUsersResult, UsersPage } from "@/types/users";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

type ImportRole = Extract<UserRole, "TEACHER" | "STUDENT" | "PARENT">;
type CreateRole = Extract<UserRole, "TEACHER" | "STUDENT" | "PARENT">;

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
  PARENT: "Phụ huynh",
};

const roleFilterOptions = [
  { value: "", label: "Tất cả vai trò" },
  { value: "TEACHER", label: "Giáo viên" },
  { value: "STUDENT", label: "Học sinh" },
  { value: "ADMIN", label: "Quản trị viên" },
  { value: "PARENT", label: "Phụ huynh" },
];

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ đăng nhập" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "LOCKED", label: "Đã khóa" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];

const importRoleOptions = [
  { value: "TEACHER", label: "Giáo viên" },
  { value: "STUDENT", label: "Học sinh" },
  { value: "PARENT", label: "Phụ huynh" },
];

const createRoleOptions = importRoleOptions;

function formatDate(value: string | null): string {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return error.details.length > 0 ? error.details.join(" · ") : error.message;
}

export function AccountManagementPanel() {
  const { can } = usePermissions();
  const { notify } = useActionNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [statusConfirmationUser, setStatusConfirmationUser] =
    useState<User | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [resetUser, setResetUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editAccountName, setEditAccountName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [parentChildren, setParentChildren] = useState<User[]>([]);
  const [studentCandidates, setStudentCandidates] = useState<User[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loadingParentLinks, setLoadingParentLinks] = useState(false);
  const [updatingParentLinkId, setUpdatingParentLinkId] = useState("");

  const [importRole, setImportRole] = useState<ImportRole>("TEACHER");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressLabel, setImportProgressLabel] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<ImportUsersResult | null>(
    null,
  );

  const [newFullName, setNewFullName] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newRole, setNewRole] = useState<CreateRole>("TEACHER");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const buildQuery = useCallback(
    (withPagination = true) => {
      const params = new URLSearchParams();
      if (withPagination) {
        params.set("page", String(page));
        params.set("limit", String(limit));
      }
      if (submittedSearch) params.set("search", submittedSearch);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      return params;
    },
    [
      createdFrom,
      createdTo,
      limit,
      page,
      roleFilter,
      statusFilter,
      submittedSearch,
    ],
  );

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setListError("");
    try {
      const result = await authenticatedRequest<UsersPage>(
        `/users?${buildQuery().toString()}`,
      );
      setUsers(result.items);
      setTotalUsers(result.meta.total);
      setTotalPages(Math.max(result.meta.totalPages, 1));
    } catch (error) {
      setListError(getErrorMessage(error, "Không thể tải danh sách tài khoản"));
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleExport() {
    setIsExporting(true);
    setListError("");
    try {
      const blob = await authenticatedBlobRequest(
        `/users/export?${buildQuery(false).toString()}`,
      );
      downloadBlob(blob, "danh-sach-tai-khoan.xlsx");
    } catch (error) {
      setListError(
        getErrorMessage(error, "Không thể export danh sách tài khoản"),
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportError("");
    setImportResult(null);
    if (!file) {
      setImportError("Vui lòng chọn tệp Excel .xlsx");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", importRole);
    setIsImportOpen(false);
    setIsImporting(true);
    setImportProgress(3);
    setImportProgressLabel("Đang chuẩn bị tệp Excel...");
    let processingTimer: ReturnType<typeof setInterval> | null = null;
    let completedResult: ImportUsersResult | null = null;
    const startProcessingTimer = () => {
      if (processingTimer) return;
      processingTimer = setInterval(() => {
        setImportProgress((current) => (current < 94 ? current + 1 : current));
      }, 450);
    };
    try {
      const result = await authenticatedUploadRequest<ImportUsersResult>(
        "/users/import",
        formData,
        (percent, phase) => {
          if (phase === "uploading") {
            setImportProgressLabel("Đang tải tệp Excel lên máy chủ...");
            setImportProgress((current) => Math.max(current, percent));
            return;
          }
          setImportProgressLabel("Đang kiểm tra và tạo tài khoản...");
          setImportProgress((current) => Math.max(current, 70));
          startProcessingTimer();
        },
      );
      if (processingTimer) clearInterval(processingTimer);
      setImportProgress(96);
      setImportProgressLabel("Đang cập nhật danh sách tài khoản...");
      completedResult = result;
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPage(1);
      await loadUsers();
      setImportProgress(100);
      setImportProgressLabel("Import hoàn tất");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
    } catch (error) {
      setImportError(getErrorMessage(error, "Không thể import tệp Excel"));
      setIsImportOpen(true);
    } finally {
      if (processingTimer) clearInterval(processingTimer);
      setIsImporting(false);
      setImportProgress(0);
      setImportProgressLabel("");
    }

    if (completedResult) {
      if (completedResult.failedCount > 0) {
        setImportResult(completedResult);
        setIsImportOpen(true);
      } else {
        setImportResult(null);
        notify("Đã import danh sách tài khoản thành công", {
          key: "accounts-imported",
        });
      }
    }
  }

  async function handleDownloadTemplate() {
    setIsDownloading(true);
    setImportError("");
    try {
      const blob = await authenticatedBlobRequest(
        `/users/import-template?role=${importRole}`,
      );
      downloadBlob(
        blob,
        importRole === "TEACHER"
          ? "mau-giao-vien.xlsx"
          : importRole === "PARENT"
            ? "mau-phu-huynh.xlsx"
            : "mau-sinh-vien.xlsx",
      );
    } catch (error) {
      setImportError(getErrorMessage(error, "Không thể tải tệp mẫu"));
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setIsCreating(true);
    try {
      await authenticatedRequest<User>("/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: newFullName,
          accountName: newAccountName,
          role: newRole,
        }),
      });
      setNewFullName("");
      setNewAccountName("");
      setIsCreateOpen(false);
      notify("Đã tạo tài khoản mới", { key: "account-created" });
      setPage(1);
      await loadUsers();
    } catch (error) {
      setCreateError(getErrorMessage(error, "Không thể tạo tài khoản"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleStatus(user: User) {
    const nextStatus: UserStatus =
      user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    setUpdatingUserId(user.id);
    setListError("");
    try {
      await authenticatedRequest<User>(
        `/users/${encodeURIComponent(user.id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      await loadUsers();
      setStatusConfirmationUser(null);
      notify("Đã cập nhật trạng thái tài khoản", {
        key: "account-status-updated",
      });
    } catch (error) {
      setListError(getErrorMessage(error, "Không thể cập nhật tài khoản"));
    } finally {
      setUpdatingUserId(null);
    }
  }

  function openEditor(user: User) {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditAccountName(user.accountName);
    setEditError("");
    setParentChildren([]);
    setStudentCandidates([]);
    setSelectedStudentId("");
    if (user.role === "PARENT" && can('parent_links.read')) void loadParentLinks(user.id);
  }

  async function loadParentLinks(parentId: string) {
    setLoadingParentLinks(true);
    setEditError("");
    try {
      const [linked, studentsPage] = await Promise.all([
        authenticatedRequest<User[]>(`/users/${encodeURIComponent(parentId)}/children`),
        loadAccountDirectory("STUDENT"),
      ]);
      setParentChildren(linked);
      setStudentCandidates(studentsPage);
      const linkedIds = new Set(linked.map((student) => student.id));
      setSelectedStudentId(studentsPage.find((student) => !linkedIds.has(student.id))?.id ?? "");
    } catch (error) {
      setEditError(getErrorMessage(error, "Không thể tải quan hệ phụ huynh - học sinh"));
    } finally {
      setLoadingParentLinks(false);
    }
  }

  async function linkStudent() {
    if (!editingUser || !selectedStudentId) return;
    setUpdatingParentLinkId(selectedStudentId);
    setEditError("");
    try {
      const result = await authenticatedRequest<{ createdStudentIds: string[]; duplicateStudentIds: string[]; status: "PENDING" | "ACTIVE" }>(
        "/users/parent-student-links",
        { method: "POST", body: JSON.stringify({ parentId: editingUser.id, studentIds: [selectedStudentId], relationshipType: "GUARDIAN" }) },
      );
      if (result.duplicateStudentIds.length) {
        setEditError("Học sinh này đã có liên kết đang hiệu lực hoặc chờ duyệt.");
        return;
      }
      const linked = result.status === "ACTIVE"
        ? await authenticatedRequest<User[]>(`/users/${encodeURIComponent(editingUser.id)}/children`)
        : parentChildren;
      setParentChildren(linked);
      const linkedIds = new Set(linked.map((student) => student.id));
      setSelectedStudentId(studentCandidates.find((student) => !linkedIds.has(student.id))?.id ?? "");
      notify(result.status === "PENDING" ? "Đã gửi liên kết chờ duyệt" : "Đã liên kết học sinh với phụ huynh", { key: "parent-student-linked" });
    } catch (error) {
      setEditError(getErrorMessage(error, "Không thể liên kết học sinh"));
    } finally {
      setUpdatingParentLinkId("");
    }
  }

  async function unlinkStudent(studentId: string) {
    if (!editingUser) return;
    setUpdatingParentLinkId(studentId);
    setEditError("");
    try {
      await authenticatedRequest<Record<string, never>>(
        `/users/${encodeURIComponent(editingUser.id)}/children/${encodeURIComponent(studentId)}`,
        { method: "DELETE" },
      );
      const linked = parentChildren.filter((student) => student.id !== studentId);
      setParentChildren(linked);
      const linkedIds = new Set(linked.map((student) => student.id));
      setSelectedStudentId(studentCandidates.find((student) => !linkedIds.has(student.id))?.id ?? "");
      notify("Đã hủy liên kết học sinh", { key: "parent-student-unlinked" });
    } catch (error) {
      setEditError(getErrorMessage(error, "Không thể hủy liên kết học sinh"));
    } finally {
      setUpdatingParentLinkId("");
    }
  }

  function closeEditor() {
    if (isSavingEdit) return;
    setEditingUser(null);
    setEditError("");
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    setEditError("");
    setIsSavingEdit(true);
    try {
      await authenticatedRequest<User>(
        `/users/${encodeURIComponent(editingUser.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: editFullName.trim(),
            accountName: editAccountName.trim().toLowerCase(),
          }),
        },
      );
      setEditingUser(null);
      notify("Đã cập nhật thông tin tài khoản", {
        key: "account-information-updated",
      });
      await loadUsers();
    } catch (error) {
      setEditError(
        getErrorMessage(error, "Không thể cập nhật thông tin tài khoản"),
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="flex max-h-[calc(100dvh-88px)] min-h-0 w-full flex-col overflow-hidden">
      {isImporting ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tiến độ import tài khoản"
          className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-600">
                <FileSpreadsheet className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-extrabold text-slate-950">
                  Đang import tài khoản
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {file?.name} · {roleLabels[importRole]}
                </p>
              </div>
              <span className="text-lg font-black tabular-nums text-brand-600">
                {importProgress}%
              </span>
            </div>

            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-300 ease-out"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <LoaderCircle className="size-4 shrink-0 animate-spin text-brand-600" />
              <span aria-live="polite">{importProgressLabel}</span>
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              Vui lòng không đóng trang cho đến khi quá trình import hoàn tất.
            </p>
          </div>
        </div>
      ) : null}

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
              placeholder="Tìm theo họ tên hoặc tên tài khoản"
            />}
 filters={[
 { id: "role", label: "Vai trò", width: 150, active: Boolean(roleFilter), content: (<CustomSelect
              value={roleFilter}
              options={roleFilterOptions}
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              ariaLabel="Lọc theo vai trò"
              onValueChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}
            />) },
 { id: "status", label: "Trạng thái", width: 180, active: Boolean(statusFilter), content: (<CustomSelect
              value={statusFilter}
              options={statusFilterOptions}
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              ariaLabel="Lọc theo trạng thái"
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />) },
 { id: "dates", label: "Ngày tạo", width: 230, active: Boolean(createdFrom || createdTo), fullWidth: true, content: (<DateRangePicker
              from={createdFrom}
              to={createdTo}
              buttonClassName="!h-[42px] !rounded-lg"
              onChange={(value) => {
                setCreatedFrom(value.from);
                setCreatedTo(value.to);
                setPage(1);
              }}
            />) }
 ]}
 onReset={() => { setRoleFilter(""); setStatusFilter(""); setCreatedFrom(""); setCreatedTo(""); setPage(1); }}
 actions={<div className="flex shrink-0 flex-nowrap justify-end gap-2">
            <Button permission="accounts.export"
              variant="outline"
              className="!h-[42px] !rounded-lg"
              disabled={isExporting}
              onClick={() => void handleExport()}
            >
              {isExporting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Export
            </Button>
            <Button permission="accounts.create"
              className="!h-[42px] !rounded-lg"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="size-4" /> Tạo mới
            </Button>
          </div>}
 />
      </div>

      <section className="mt-2 flex min-h-0 shrink flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {listError ? (
          <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <XCircle className="size-4" /> {listError}
          </p>
        ) : null}

        <TableScrollArea className="min-h-0 shrink">
          <Table className="min-w-[1250px]">
            <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Tên tài khoản</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Lần đăng nhập cuối</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Đang hoạt động</TableHead>
                <TableHead className="w-28 text-right">Thao tác</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingBarRow colSpan={9} /> : null}
              {!isLoading && users.length === 0 ? (
                <TableEmptyRow colSpan={9} />
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className="transition hover:bg-slate-50/70">
                    <TableCell className="text-center text-xs text-slate-400">
                      {(page - 1) * limit + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand-700">
                          {getInitial(user.fullName)}
                        </span>
                        <span className="font-bold text-slate-900">
                          {user.fullName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-brand-700">
                      {user.accountName}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {roleLabels[user.role]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="min-w-56 whitespace-nowrap">
                      <AuditActor user={user} />
                    </TableCell>
                    <TableCell>
                      <ToggleSwitch
                        permission="accounts.status"
                        checked={user.status === "ACTIVE"}
                        aria-label={
                          user.status === "ACTIVE"
                            ? `Khóa tài khoản ${user.fullName}`
                            : `Mở khóa tài khoản ${user.fullName}`
                        }
                        title={
                          user.role === "ADMIN"
                            ? "Không thể thay đổi trạng thái quản trị viên"
                            : user.status === "PENDING"
                              ? "Tài khoản chưa đăng nhập lần đầu"
                              : user.status === "ACTIVE"
                                ? "Khóa tài khoản"
                                : "Mở khóa tài khoản"
                        }
                        disabled={
                          user.role === "ADMIN" || user.status === "PENDING"
                        }
                        loading={updatingUserId === user.id}
                        onCheckedChange={() => setStatusConfirmationUser(user)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {user.role !== "ADMIN" && can("accounts.reset_password") && <Button permission="accounts.reset_password" variant="ghost" size="sm" onClick={() => setResetUser(user)} aria-label={`Đặt lại mật khẩu ${user.fullName}`} title="Đặt lại mật khẩu"><KeyRound size={18} strokeWidth={2.5} /></Button>}
                      <Button permission="accounts.update"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditor(user)}
                        aria-label={`Chỉnh sửa tài khoản ${user.fullName}`}
                        title="Chỉnh sửa tài khoản"
                      >
                        <Pencil size={18} strokeWidth={2.5} />
                      </Button>
                    </TableCell>
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollArea>

        <DataTableFooter
          className="shrink-0 bg-white"
          rowCount={users.length}
          totalItems={totalUsers}
          itemLabel="tài khoản"
          page={page}
          totalPages={totalPages}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(pageSize) => {
            setLimit(pageSize);
            setPage(1);
          }}
        />
      </section>

      {resetUser && <AccountPasswordResetPanel key={resetUser.id} user={resetUser} onClose={() => setResetUser(null)} onSaved={() => {setResetUser(null); notify("Đã đặt lại mật khẩu. Người nhận phải đổi mật khẩu khi đăng nhập lại.", {key:"account-password-reset"});}} />}
      <ConfirmationDialog
        open={statusConfirmationUser !== null}
        title="ĐỔI TRẠNG THÁI"
        loading={Boolean(updatingUserId)}
        onClose={() => {
          setStatusConfirmationUser(null);
        }}
        onConfirm={() => {
          if (statusConfirmationUser) {
            void handleToggleStatus(statusConfirmationUser);
          }
        }}
      >
        <p>
          Bạn có chắc chắn muốn đổi trạng thái hoạt động của tài khoản{" "}
          <strong className="text-slate-950">
            {statusConfirmationUser?.fullName}
          </strong>{" "}
          không?
        </p>
      </ConfirmationDialog>

      <Modal
        open={editingUser !== null}
        title="Chỉnh sửa tài khoản"
        description="Cập nhật thông tin đăng nhập và thông tin hiển thị của tài khoản."
        onClose={closeEditor}
        width={editingUser?.role === "PARENT" ? "max-w-2xl" : "max-w-xl"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void handleEdit(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              className="!rounded-lg"
              label="Họ và tên"
              required
              minLength={2}
              maxLength={150}
              value={editFullName}
              onChange={(event) => setEditFullName(event.target.value)}
              placeholder="Nhập họ và tên"
              autoFocus
            />
            <Input
              className="!rounded-lg"
              label="Tên tài khoản"
              required
              minLength={3}
              maxLength={50}
              pattern="[a-z0-9._-]{3,50}"
              value={editAccountName}
              onChange={(event) =>
                setEditAccountName(event.target.value.toLowerCase())
              }
              placeholder="Nhập tên tài khoản"
              autoComplete="username"
            />
          </div>


          {editingUser ? (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Vai trò</p>
                <p className="mt-1 font-bold text-slate-800">
                  {roleLabels[editingUser.role]}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái</p>
                <p className="mt-1 font-bold text-slate-800">
                  {statusFilterOptions.find(
                    (option) => option.value === editingUser.status,
                  )?.label ?? editingUser.status}
                </p>
              </div>
            </div>
          ) : null}

          {editingUser?.role === "PARENT" && can('parent_links.read') ? (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Học sinh liên kết</p>
                <p className="mt-1 text-xs text-slate-500">Phụ huynh chỉ xem được hồ sơ học sinh đã liên kết tại đây.</p>
              </div>
              {loadingParentLinks ? (
                <p className="flex items-center gap-2 py-3 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Đang tải danh sách...</p>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <CustomSelect
                        label="Chọn học sinh"
                        value={selectedStudentId}
                        options={studentCandidates
                          .filter((student) => !parentChildren.some((linked) => linked.id === student.id))
                          .map((student) => ({ value: student.id, label: `${student.fullName} · ${student.accountName}` }))}
                        disabled={!studentCandidates.some((student) => !parentChildren.some((linked) => linked.id === student.id))}
                        onValueChange={setSelectedStudentId}
                      />
                    </div>
                    <Button permission="parent_links.assign" variant="secondary" className="shrink-0" disabled={!selectedStudentId || Boolean(updatingParentLinkId)} onClick={() => void linkStudent()}>
                      {updatingParentLinkId === selectedStudentId ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Liên kết
                    </Button>
                  </div>
                  {parentChildren.length ? (
                    <div className="space-y-2">
                      {parentChildren.map((student) => (
                        <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{student.fullName}</p>
                            <p className="truncate text-xs text-slate-500">{student.accountName}{student.assignedClass ? ` · ${student.assignedClass.code}` : ""}</p>
                          </div>
                          <Button permission="parent_links.assign" variant="ghost" size="sm" className="shrink-0 text-rose-600 hover:bg-rose-50" disabled={Boolean(updatingParentLinkId)} onClick={() => void unlinkStudent(student.id)}>
                            {updatingParentLinkId === student.id ? <LoaderCircle className="size-4 animate-spin" /> : <XCircle className="size-4" />} Hủy liên kết
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center text-sm text-slate-500">Chưa liên kết học sinh nào.</p>
                  )}
                </>
              )}
            </div>
          ) : null}

          {editError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {editError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button permission="accounts.update"
              variant="outline"
              className="!rounded-lg"
              disabled={isSavingEdit}
              onClick={closeEditor}
            >
              Hủy
            </Button>
            <Button permission="accounts.update"
              type="submit"
              className="!rounded-lg"
              disabled={isSavingEdit}
            >
              {isSavingEdit ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-4" />
              )}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isImportOpen}
        title="Import danh sách tài khoản"
        description="Import tối đa 10.000 giáo viên, học sinh hoặc phụ huynh từ một tệp Excel .xlsx."
        onClose={() => {
          if (!isImporting) setIsImportOpen(false);
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void handleImport(event)}
        >
          <CustomSelect
            label="Loại tài khoản"
            value={importRole}
            options={importRoleOptions}
            onValueChange={(value) => setImportRole(value as ImportRole)}
          />
          <Button permission="accounts.import"
            className="w-full"
            variant="secondary"
            disabled={isDownloading}
            onClick={() => void handleDownloadTemplate()}
          >
            {isDownloading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Tải file Excel mẫu
          </Button>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Danh sách Excel
            </span>
            <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-brand-400 hover:bg-blue-50">
              <FileSpreadsheet className="size-5 text-brand-600" />
              <span className="mt-2 max-w-full truncate text-sm font-semibold text-slate-700">
                {file?.name ?? "Chọn tệp .xlsx"}
              </span>
              <span className="mt-1 text-xs text-slate-400">Tối đa 10 MB</span>
            </span>
            <FileInput
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
            Tài khoản sẽ dùng mật khẩu mặc định của vai trò đã thiết lập trong
            Cấu hình hệ thống.
          </p>
          {importError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {importError}
            </p>
          ) : null}
          {importResult ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-bold text-emerald-700">
                Đã tạo {importResult.createdCount}/{importResult.totalRows} tài
                khoản
              </p>
              {importResult.failedCount > 0 && importResult.createdCount === 0 ? (
                <p className="mt-2 text-rose-700">Tệp có lỗi nên chưa tạo tài khoản nào. Hãy sửa các dòng bên dưới và tải lại toàn bộ tệp.</p>
              ) : null}
              {importResult.errors.length > 0 ? (
                <div className="mt-3 max-h-36 space-y-1 overflow-y-auto border-t border-slate-100 pt-3 text-xs text-rose-600">
                  {importResult.errors.map((error) => (
                    <p key={`${error.row}-${error.accountName ?? ""}`}>
                      Dòng {error.row}
                      {error.accountName ? ` · ${error.accountName}` : ""}:{" "}
                      {error.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Hủy
            </Button>
            <Button permission="accounts.import" type="submit" disabled={isImporting}>
              {isImporting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import tài khoản
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isCreateOpen}
        title="Tạo tài khoản mới"
        description="Tài khoản sẽ chờ kích hoạt đến lần đăng nhập hợp lệ đầu tiên."
        onClose={() => setIsCreateOpen(false)}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void handleCreate(event)}
        >
          <Input
            className="!rounded-lg"
            label="Họ và tên"
            required
            minLength={2}
            maxLength={150}
            value={newFullName}
            onChange={(event) => setNewFullName(event.target.value)}
            placeholder="Nhập họ và tên"
          />
          <Input
            className="!rounded-lg"
            label="Tên đăng nhập"
            required
            minLength={3}
            maxLength={50}
            value={newAccountName}
            onChange={(event) =>
              setNewAccountName(event.target.value.toLowerCase())
            }
            placeholder="Nhập tên đăng nhập"
          />
          <CustomSelect
            label="Vai trò"
            buttonClassName="!rounded-lg"
            value={newRole}
            options={createRoleOptions}
            onValueChange={(value) => setNewRole(value as CreateRole)}
          />
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
            <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> Mật khẩu mặc định</p>
            <p className="mt-1" aria-live="polite">
              Tự động sử dụng mật khẩu mặc định của vai trò {roleLabels[newRole].toLowerCase()} đã thiết lập trong Cấu hình hệ thống. Bạn không cần nhập mật khẩu tại đây.
            </p>
          </div>
          {createError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {createError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button permission="accounts.import"
              variant="secondary"
              className="!rounded-lg"
              onClick={() => {
                setIsCreateOpen(false);
                setIsImportOpen(true);
              }}
            >
              <Upload className="size-4" /> Import từ Excel
            </Button>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="!rounded-lg"
                onClick={() => setIsCreateOpen(false)}
              >
                Hủy
              </Button>
              <Button permission="accounts.create"
                type="submit"
                className="!rounded-lg"
                disabled={isCreating}
              >
                {isCreating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <UserRoundCheck className="size-4" />
                )}
                Tạo tài khoản
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getInitial(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "?";
}
