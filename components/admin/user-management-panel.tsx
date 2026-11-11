"use client";

import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "@/lib/portal-navigation";
import { Eye, LoaderCircle, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuditActor } from "@/components/admin/audit-actor";
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
import { DateRangePicker, DateInput } from "@/components/ui/date-range-picker";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import { useActionNotification } from "@/components/ui/action-notification";
import type { User, UserRole, UserStatus } from "@/types/auth";
import type { UsersPage } from "@/types/users";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

type ManagedRole = Extract<UserRole, "TEACHER" | "STUDENT" | "PARENT">;

const roleLabels: Record<ManagedRole, string> = {
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
  PARENT: "Phụ huynh",
};

const statusFilterOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ đăng nhập" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "LOCKED", label: "Đã khóa" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];

const statusLabels: Record<UserStatus, string> = {
  PENDING: "Chờ đăng nhập",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  INACTIVE: "Ngừng hoạt động",
};

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

function formatDateOnly(value?: string | null): string {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatBirthYear(value?: string | null): string {
  if (!value) return "--";
  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? "--" : String(year);
}

function displayValue(value?: string | null): string {
  return value?.trim() || "--";
}

function formatGender(gender?: User["gender"]): string {
  if (gender === "M") return "Nam";
  if (gender === "F") return "Nữ";
  return "--";
}

function getInitial(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "?";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return error.details.length > 0 ? error.details.join(" · ") : error.message;
}

function getStatusClass(status: UserStatus): string {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "LOCKED") return "bg-rose-50 text-rose-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function getAssignedClassLabel(schoolClass: NonNullable<User["assignedClass"]>): string {
  return schoolClass.name && schoolClass.name !== schoolClass.code
    ? `${schoolClass.code} · ${schoolClass.name}`
    : schoolClass.code || schoolClass.name;
}

function AssignedClassesCell({ user }: { user: User }) {
  if (user.role === "STUDENT") {
    return user.assignedClass ? (
      <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-brand-700">
        {getAssignedClassLabel(user.assignedClass)}
      </span>
    ) : <span className="text-slate-400">--</span>;
  }

  const assignedClasses = user.assignedClasses ?? [];
  if (assignedClasses.length === 0) return <span className="text-slate-400">--</span>;
  return (
    <div className="flex max-h-24 min-w-64 flex-wrap gap-1.5 overflow-y-auto py-1">
      {assignedClasses.map((schoolClass) => (
        <span key={schoolClass.id} className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-brand-700">
          {getAssignedClassLabel(schoolClass)}
        </span>
      ))}
    </div>
  );
}

export function UserManagementPanel({ role }: { role: ManagedRole }) {
  const router = useRouter();
  const { notify } = useActionNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("role", role);
    if (submittedSearch) params.set("search", submittedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);
    return params;
  }, [
    createdFrom,
    createdTo,
    limit,
    page,
    role,
    statusFilter,
    submittedSearch,
  ]);

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
      setListError(
        getErrorMessage(error, "Không thể tải danh sách người dùng"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
    setViewedUser(null);
    setSelectedUser(null);
  }, [role]);

  function openEditor(user: User) {
    setViewedUser(null);
    setSelectedUser(user);
    setFullName(user.fullName);
    setAccountName(user.accountName);
    setAvatarUrl(user.avatarUrl ?? "");
    setPhoneNumber(user.phoneNumber ?? "");
    setEmail(user.email ?? "");
    setGender(user.gender ?? "");
    setBirthday(user.birthday?.slice(0, 10) ?? "");
    setEditError("");
  }

  function openViewer(user: User) {
    if (user.role === "STUDENT") {
      router.push(`/admin/users/students/${encodeURIComponent(user.id)}`);
      return;
    }
    setViewedUser(user);
  }

  function closeEditor() {
    if (isSaving) return;
    setSelectedUser(null);
    setEditError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;

    setEditError("");
    setIsSaving(true);
    try {
      await authenticatedRequest<User>(
        `/users/${encodeURIComponent(selectedUser.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: fullName.trim(),
            accountName: accountName.trim().toLowerCase(),
            avatarUrl: avatarUrl.trim() || null,
            phoneNumber: phoneNumber.trim() || null,
            email: email.trim().toLowerCase() || null,
            gender: gender || null,
            birthday: birthday || null,
          }),
        },
      );
      setSelectedUser(null);
      notify("Đã cập nhật thông tin người dùng", {
        key: "user-information-updated",
      });
      await loadUsers();
    } catch (error) {
      setEditError(
        getErrorMessage(error, "Không thể cập nhật thông tin người dùng"),
      );
    } finally {
      setIsSaving(false);
    }
  }

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
            placeholder="Tìm theo họ tên hoặc mã người dùng"
          />}
 filters={[
 { id: "status", label: "Trạng thái", width: 190, active: Boolean(statusFilter), content: (<CustomSelect
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
 onReset={() => { setStatusFilter(""); setCreatedFrom(""); setCreatedTo(""); setPage(1); }}
 />
      </div>

      <section className="mt-2 flex min-h-0 shrink flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {listError ? (
          <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <XCircle className="size-4" /> {listError}
          </p>
        ) : null}

        <TableScrollArea className="min-h-0 shrink">
          <Table
            className={`${
              role === "STUDENT"
                ? "min-w-[2390px]"
                : role === "PARENT"
                  ? "min-w-[1850px]"
                  : "min-w-[2330px]"
            } [&_td]:whitespace-nowrap`}
          >
            <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead className="min-w-[260px]">Họ và tên</TableHead>
                <TableHead className="min-w-[170px]">Mã người dùng</TableHead>
                <TableHead className="min-w-[130px]">
                  {role === "PARENT" ? "Năm sinh" : "Ngày sinh"}
                </TableHead>
                <TableHead className="min-w-[110px]">Giới tính</TableHead>
                {role !== "PARENT" ? (
                  <TableHead className="min-w-[180px]">Tỉnh/Thành phố</TableHead>
                ) : null}
                {role !== "STUDENT" ? (
                  <TableHead className="min-w-[240px]">Email</TableHead>
                ) : null}
                <TableHead className="min-w-[160px]">Số điện thoại</TableHead>
                {role === "STUDENT" ? (
                  <>
                    <TableHead className="min-w-[150px]">Niên khóa</TableHead>
                    <TableHead className="min-w-[150px]">Lớp</TableHead>
                  </>
                ) : null}
                {role !== "PARENT" ? (
                  <TableHead className="min-w-[270px]">Lớp học phân công</TableHead>
                ) : null}
                <TableHead className="min-w-[170px]">Trạng thái</TableHead>
                <TableHead className="min-w-[190px]">
                  Lần đăng nhập cuối
                </TableHead>
                <TableHead className="min-w-[240px]">Người thực hiện</TableHead>
                <TableHead className="min-w-[110px] text-right">
                  Thao tác
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingBarRow
                  colSpan={role === "STUDENT" ? 14 : role === "PARENT" ? 11 : 13}
                />
              ) : null}
              {!isLoading && users.length === 0 ? (
                <TableEmptyRow
                  colSpan={role === "STUDENT" ? 14 : role === "PARENT" ? 11 : 13}
                  message={`Không có ${roleLabels[role].toLowerCase()} phù hợp.`}
                />
              ) : (
                users.map((user, index) => (
                  <tr
                    key={user.id}
                    className="cursor-pointer transition hover:bg-slate-50/70 focus-visible:bg-blue-50 focus-visible:outline-none"
                    tabIndex={0}
                    onClick={() => openViewer(user)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openViewer(user);
                      }
                    }}
                  >
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
                    <TableCell className="whitespace-nowrap text-xs text-slate-700">
                      {role === "PARENT"
                        ? formatBirthYear(user.birthday)
                        : formatDateOnly(user.birthday)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-700">
                      {formatGender(user.gender)}
                    </TableCell>
                    {role !== "PARENT" ? (
                      <TableCell className="min-w-36 text-slate-700">
                        {displayValue(user.provinceCity)}
                      </TableCell>
                    ) : null}
                    {role !== "STUDENT" ? (
                      <TableCell className="min-w-52 text-slate-700">
                        {displayValue(user.email)}
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-nowrap text-slate-700">
                      {displayValue(user.phoneNumber)}
                    </TableCell>
                    {role === "STUDENT" ? (
                      <>
                        <TableCell className="whitespace-nowrap text-slate-700">
                          {displayValue(user.course)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-700">
                          {displayValue(user.grade)}
                        </TableCell>
                      </>
                    ) : null}
                    {role !== "PARENT" ? (
                      <TableCell className="!whitespace-normal align-top">
                        <AssignedClassesCell user={user} />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusClass(user.status)}`}
                      >
                        {statusLabels[user.status]}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="min-w-56 whitespace-nowrap">
                      <AuditActor user={user} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-9 !rounded-lg px-0 text-slate-500 hover:bg-blue-50 hover:text-brand-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            openViewer(user);
                          }}
                          aria-label={`Xem thông tin ${user.fullName}`}
                          title="Xem thông tin"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button permission="accounts.update"
                          variant="ghost"
                          size="sm"
                          className="size-9 !rounded-lg px-0 text-brand-700 hover:bg-blue-50"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditor(user);
                          }}
                          aria-label={`Chỉnh sửa thông tin ${user.fullName}`}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
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
          itemLabel={
            role === "TEACHER"
              ? "giáo viên"
              : role === "PARENT"
                ? "phụ huynh"
                : "học sinh"
          }
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

      <Modal
        open={viewedUser !== null}
        title={`Thông tin ${roleLabels[role].toLowerCase()}`}
        description={`Thông tin chi tiết của ${roleLabels[role].toLowerCase()}.`}
        onClose={() => setViewedUser(null)}
        width="max-w-4xl"
      >
        {viewedUser ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-base font-bold text-brand-700">
                {getInitial(viewedUser.fullName)}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold text-slate-950">
                  {viewedUser.fullName}
                </h3>
                <p className="font-mono text-xs font-semibold text-brand-700">
                  {viewedUser.accountName}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Đối tượng</p>
                <p className="mt-1 font-bold text-slate-800">
                  {roleLabels[viewedUser.role as ManagedRole]}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái</p>
                <p className="mt-1 font-bold text-slate-800">
                  {statusLabels[viewedUser.status]}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Ngày tạo</p>
                <p className="mt-1 font-bold text-slate-800">
                  {formatDate(viewedUser.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Lần đăng nhập cuối</p>
                <p className="mt-1 font-bold text-slate-800">
                  {formatDate(viewedUser.lastLoginAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cập nhật bởi</p>
                <p className="mt-1 font-bold text-slate-800">
                  {viewedUser.updatedByFullName ??
                    viewedUser.updatedByAccountName ??
                    "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cập nhật lúc</p>
                <p className="mt-1 font-bold text-slate-800">
                  {formatDate(viewedUser.updatedByAt ?? null)}
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-extrabold text-slate-900">
                Thông tin hồ sơ đã import
              </h4>
              <div className="grid gap-x-5 gap-y-4 rounded-xl border border-slate-100 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Ngày sinh</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {formatDateOnly(viewedUser.birthday)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Giới tính</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {formatGender(viewedUser.gender)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tỉnh/Thành phố</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {displayValue(viewedUser.provinceCity)}
                  </p>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-slate-400">Địa chỉ cụ thể</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {displayValue(viewedUser.specificAddress)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">CCCD</p>
                  <p className="mt-1 font-mono font-semibold text-slate-800">
                    {displayValue(viewedUser.cccd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="mt-1 break-all font-semibold text-slate-800">
                    {displayValue(viewedUser.email)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Số điện thoại</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {displayValue(viewedUser.phoneNumber)}
                  </p>
                </div>
                {viewedUser.role === "STUDENT" ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-400">Niên khóa</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {displayValue(viewedUser.course)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Lớp</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {displayValue(viewedUser.grade)}
                      </p>
                    </div>
                  </>
                ) : null}
                {viewedUser.role === "TEACHER" ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-400">Bằng cấp</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {displayValue(viewedUser.degree)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Ngày cấp</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatDateOnly(viewedUser.issueDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Ngày tham gia</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatDateOnly(viewedUser.joinDate)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="!rounded-lg"
                onClick={() => setViewedUser(null)}
              >
                Đóng
              </Button>
              <Button permission="accounts.update"
                className="!rounded-lg"
                onClick={() => openEditor(viewedUser)}
              >
                <Pencil className="size-4" /> Chỉnh sửa
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={selectedUser !== null}
        title="Cập nhật thông tin người dùng"
        description={`Chỉnh sửa thông tin cơ bản của ${roleLabels[role].toLowerCase()}.`}
        onClose={closeEditor}
        width="max-w-xl"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void handleSave(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              className="!rounded-lg"
              label="Họ và tên"
              required
              minLength={2}
              maxLength={150}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nhập họ và tên"
            />
            <Input
              className="!rounded-lg"
              label="Mã người dùng"
              required
              minLength={3}
              maxLength={50}
              value={accountName}
              onChange={(event) =>
                setAccountName(event.target.value.toLowerCase())
              }
              placeholder="Nhập mã người dùng"
            />
          </div>

          <Input
            className="!rounded-lg"
            label="Ảnh đại diện"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
            hint="Có thể để trống nếu chưa có ảnh đại diện."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              className="!rounded-lg"
              label="Số điện thoại"
              type="tel"
              maxLength={20}
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Nhập số điện thoại"
            />
            <Input
              className="!rounded-lg"
              label="Email"
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Nhập email"
            />
            <CustomSelect
              label="Giới tính"
              value={gender}
              options={[
                { value: "", label: "Chưa cập nhật" },
                { value: "M", label: "Nam" },
                { value: "F", label: "Nữ" },
              ]}
              onValueChange={setGender}
            />
            <DateInput
              className="!rounded-lg"
              label="Ngày sinh"
              type="date"
              value={birthday}
              onChange={(event) => setBirthday(event.target.value)}
            />
          </div>

          {selectedUser ? (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Đối tượng</p>
                <p className="mt-1 font-bold text-slate-800">
                  {roleLabels[selectedUser.role as ManagedRole]}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái tài khoản</p>
                <p className="mt-1 font-bold text-slate-800">
                  {statusLabels[selectedUser.status]}
                </p>
              </div>
            </div>
          ) : null}

          {editError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {editError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="!rounded-lg"
              disabled={isSaving}
              onClick={closeEditor}
            >
              Hủy
            </Button>
            <Button permission="accounts.update" type="submit" className="!rounded-lg" disabled={isSaving}>
              {isSaving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              Lưu thông tin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
