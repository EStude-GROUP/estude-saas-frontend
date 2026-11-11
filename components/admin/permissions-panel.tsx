"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { authenticatedRequest } from "@/lib/auth-api";
import { usePermissions } from "@/context/permissions-context";
import { Button } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/form-control";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";

interface Group {
  id: string;
  name: string;
  category: string;
  permissions: string[];
  defaultFor?: string;
}
interface Snapshot {
  revision: number;
  automaticNotification?: {
    recipientCount: number;
    delivered: boolean;
  };
  policy: {
    groups: Group[];
    assignments: Record<string, string[]>;
    history: { at: string; actorName: string; action: string }[];
  };
}
interface Catalog {
  features: {
    key: string;
    name: string;
    category: string;
    actions: string[];
  }[];
  actions: Record<string, string>;
}
interface Account {
  id: string;
  fullName: string;
  accountName: string;
  role: string;
  groupIds: string[];
  custom: boolean;
}
const emptyGroup = (): Group => ({
  id: "",
  name: "",
  category: "Nhóm tùy chỉnh",
  permissions: [],
});

export function PermissionsPanel() {
  const { can, refresh } = usePermissions();
  const writable = can("authorization.manage");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<Group>(emptyGroup);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [featureSearch, setFeatureSearch] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<"matrix" | "accounts" | "history">("matrix");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [data, vocabulary] = await Promise.all([
        authenticatedRequest<Snapshot>("/permissions/policy"),
        authenticatedRequest<Catalog>("/permissions/catalog"),
      ]);
      setSnapshot(data);
      setCatalog(vocabulary);
      setDraft(data.policy.groups[0] ?? emptyGroup());
      setDirty(false);
      setSelected(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tải cấu hình",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (tab !== "accounts" || !writable) return;
    let active = true;
    setLoadingAccounts(true);
    setError("");
    authenticatedRequest<Account[]>(
      `/permissions/users?search=${encodeURIComponent(submittedSearch)}`,
    )
      .then((data) => {
        if (active) {
          setAccounts(data);
          setSelected(null);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải tài khoản",
          );
      })
      .finally(() => {
        if (active) setLoadingAccounts(false);
      });
    return () => {
      active = false;
    };
  }, [submittedSearch, snapshot?.revision, tab, writable]);

  function choose(group: Group) {
    if (dirty && !window.confirm("Bỏ các thay đổi chưa lưu của nhóm hiện tại?"))
      return;
    setDraft({ ...group, permissions: [...group.permissions] });
    setDirty(false);
    setNotice("");
  }
  function toggle(
    feature: Catalog["features"][number],
    action: string,
    checked: boolean,
  ) {
    const next = new Set(draft.permissions);
    const key = `${feature.key}.${action}`;
    if (checked) {
      next.add(key);
      if (feature.actions.includes("read")) next.add(`${feature.key}.read`);
    } else if (action === "read")
      feature.actions.forEach((item) => next.delete(`${feature.key}.${item}`));
    else next.delete(key);
    setDraft({ ...draft, permissions: [...next] });
    setDirty(true);
  }
  async function mutate(
    path: string,
    method: string,
    data: Record<string, unknown>,
  ) {
    if (!snapshot || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authenticatedRequest<Snapshot>(path, {
        method,
        body: JSON.stringify({ ...data, revision: snapshot.revision }),
      });
      setSnapshot(result);
      setDirty(false);
      const saved = result.policy.groups.find(
        (group) =>
          group.id === draft.id ||
          (!draft.id && group.name === draft.name.trim()),
      );
      if (saved) setDraft(saved);
      else setDraft(result.policy.groups[0] ?? emptyGroup());
      const delivery = result.automaticNotification;
      setNotice(
        delivery?.delivered === false
          ? "Đã lưu quyền, nhưng thông báo tự động chưa thể gửi. Hệ thống đã ghi nhận sự cố để kiểm tra."
          : delivery?.recipientCount
            ? `Đã lưu và tự động thông báo đến ${delivery.recipientCount} tài khoản bị ảnh hưởng.`
            : "Đã lưu thay đổi. Không có tài khoản nào bị thay đổi quyền tính năng nên không phát sinh thông báo.",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu cấu hình",
      );
    } finally {
      setBusy(false);
    }
  }

  const features = (catalog?.features ?? []).filter(
    (feature) =>
      (!category || feature.category === category) &&
      feature.name
        .toLocaleLowerCase("vi")
        .includes(featureSearch.toLocaleLowerCase("vi")),
  );
  const actions = Object.keys(catalog?.actions ?? {});
  const groups = snapshot?.policy.groups ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h1 className="text-xl font-extrabold text-brand-700">
            Phân quyền động
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Nhóm quyền theo module và thao tác. Phạm vi lớp học, chủ sở hữu và
            liên kết học sinh vẫn được kiểm tra.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Tải lại và bỏ thay đổi chưa lưu?"))
              void load();
          }}
        >
          <RefreshCw className="size-4" />
          Tải lại
        </Button>
      </div>
      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Quản lý phân quyền"
      >
        {(
          [
            ["matrix", "Nhóm quyền / Ma trận"],
            ...(writable ? [["accounts", "Gán cho tài khoản"]] : []),
            ["history", "Lịch sử"],
          ] as [typeof tab, string][]
        ).map(([value, label]) => (
          <Button variant="plain" type="submit"
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === value ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}
          >
            {label}
          </Button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {!snapshot || !catalog ? (
        <LoaderCircle className="size-6 animate-spin text-brand-600" />
      ) : tab === "matrix" ? (
        <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Input
              containerClassName="search-field"
              aria-label="Tìm nhóm quyền"
              placeholder="Tìm nhóm quyền..."
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
            />
            <div className="max-h-[55vh] space-y-3 overflow-y-auto">
              {[...new Set(groups.map((group) => group.category))].map(
                (name) => (
                  <div key={name}>
                    <h2 className="mb-1 text-xs font-bold uppercase text-slate-400">
                      {name}
                    </h2>
                    {groups
                      .filter(
                        (group) =>
                          group.category === name &&
                          group.name
                            .toLocaleLowerCase("vi")
                            .includes(groupSearch.toLocaleLowerCase("vi")),
                      )
                      .map((group) => (
                        <Button variant="plain" type="submit"
                          key={group.id}
                          disabled={busy}
                          onClick={() => choose(group)}
                          className={`mb-1 w-full rounded-lg p-3 text-left text-sm ${group.id === draft.id ? "bg-blue-50 font-bold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}
                        >
                          {group.name}
                          <span className="mt-1 block text-xs text-slate-400">
                            {group.permissions.length} quyền
                            {group.defaultFor ? " · Mặc định" : ""}
                          </span>
                        </Button>
                      ))}
                  </div>
                ),
              )}
            </div>
            <Button
              permission="authorization.manage"
              className="w-full"
              disabled={busy}
              onClick={() => choose(emptyGroup())}
            >
              <Plus className="size-4" />
              Tạo nhóm quyền
            </Button>
          </aside>
          <div className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Tên nhóm quyền"
                maxLength={100}
                disabled={!writable || busy}
                value={draft.name}
                onChange={(event) => {
                  setDraft({ ...draft, name: event.target.value });
                  setDirty(true);
                }}
              />
              <Input
                label="Nhóm module / phân loại"
                maxLength={100}
                disabled={!writable || busy}
                value={draft.category}
                onChange={(event) => {
                  setDraft({ ...draft, category: event.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                permission="authorization.manage"
                disabled={
                  busy || draft.name.trim().length < 2 || !draft.category.trim()
                }
                onClick={() =>
                  void mutate("/permissions/groups", "POST", {
                    ...(draft.id ? { id: draft.id } : {}),
                    name: draft.name,
                    category: draft.category,
                    permissions: draft.permissions,
                  })
                }
              >
                <Save className="size-4" />
                {busy ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
              <Button
                permission="authorization.manage"
                variant="outline"
                disabled={busy || !draft.id}
                onClick={() => {
                  choose({
                    ...draft,
                    id: "",
                    defaultFor: undefined,
                    name: `${draft.name} (bản sao)`,
                  });
                  setDirty(true);
                }}
              >
                <Copy className="size-4" />
                Nhân bản
              </Button>
              {!draft.defaultFor && draft.id && (
                <Button
                  permission="authorization.manage"
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Xóa nhóm “${draft.name}”?`))
                      void mutate(
                        `/permissions/groups/${draft.id}`,
                        "DELETE",
                        {},
                      );
                  }}
                >
                  <Trash2 className="size-4" />
                  Xóa nhóm
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="plain" type="submit"
                className={`rounded-lg px-3 py-2 text-sm ${!category ? "bg-brand-600 text-white" : "bg-slate-50"}`}
                onClick={() => setCategory("")}
              >
                Tất cả module
              </Button>
              {[
                ...new Set(catalog.features.map((feature) => feature.category)),
              ].map((name) => (
                <Button variant="plain" type="submit"
                  key={name}
                  onClick={() => setCategory(name)}
                  className={`rounded-lg px-3 py-2 text-sm ${category === name ? "bg-brand-600 text-white" : "bg-slate-50"}`}
                >
                  {name}
                </Button>
              ))}
            </div>
            <Input
              containerClassName="search-field"
              aria-label="Tìm chức năng"
              placeholder="Tìm chức năng..."
              value={featureSearch}
              onChange={(event) => setFeatureSearch(event.target.value)}
            />
            <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-blue-50">
                  <tr>
                    <th className="min-w-64 p-3 text-left">Chức năng</th>
                    {actions.map((action) => (
                      <th
                        key={action}
                        className="min-w-24 p-3 text-center text-xs text-brand-700"
                      >
                        {catalog.actions[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr key={feature.key} className="border-t border-slate-100">
                      <td className="p-3 font-semibold">{feature.name}</td>
                      {actions.map((action) => (
                        <td key={action} className="p-3 text-center">
                          {feature.actions.includes(action) ? (
                            <Checkbox
                              type="checkbox"
                              aria-label={`${feature.name}: ${catalog.actions[action]}`}
                              className="size-4 accent-brand-600"
                              checked={draft.permissions.includes(
                                `${feature.key}.${action}`,
                              )}
                              disabled={!writable || busy}
                              onChange={(event) =>
                                toggle(feature, action, event.target.checked)
                              }
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === "accounts" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <DebouncedSearchInput
              value={search}
              onValueChange={setSearch}
              onSearch={setSubmittedSearch}
              placeholder="Tìm họ tên hoặc tài khoản..."
            />
            <p className="text-xs text-slate-500">
              Hiển thị tối đa 50 tài khoản phù hợp. Nhập tên để tìm thêm.
            </p>
            {loadingAccounts ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-auto">
                {accounts.map((account) => (
                  <Button variant="plain" type="submit"
                    key={account.id}
                    disabled={busy}
                    className={`w-full rounded-lg border p-3 text-left ${selected?.id === account.id ? "border-brand-400 bg-blue-50" : "border-slate-100"}`}
                    onClick={() => {
                      setSelected(account);
                      setGroupIds(account.groupIds);
                    }}
                  >
                    <span className="block text-sm font-bold">
                      {account.fullName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {account.accountName} · {account.role} ·{" "}
                      {account.custom ? "Gán riêng" : "Nhóm mặc định"}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold">
              {selected
                ? `Nhóm quyền của ${selected.fullName}`
                : "Chọn tài khoản để gán nhóm quyền"}
            </h2>
            <p className="text-sm text-slate-500">
              Các nhóm được chọn thay thế nhóm mặc định của tài khoản. Quyền là
              tổng quyền của các nhóm. Không chọn nhóm nào sẽ thu hồi toàn bộ
              quyền chức năng.
            </p>
            {selected && (
              <>
                <div className="max-h-[45vh] space-y-3 overflow-auto">
                  {groups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <Checkbox
                        type="checkbox"
                        disabled={busy}
                        className="size-4 accent-brand-600"
                        checked={groupIds.includes(group.id)}
                        onChange={(event) =>
                          setGroupIds(
                            event.target.checked
                              ? [...groupIds, group.id]
                              : groupIds.filter((id) => id !== group.id),
                          )
                        }
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/permissions/users/${selected.id}`,
                        "PATCH",
                        { groupIds },
                      )
                    }
                  >
                    Lưu nhóm quyền
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/permissions/users/${selected.id}`,
                        "PATCH",
                        { groupIds: null },
                      )
                    }
                  >
                    Dùng nhóm mặc định
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm text-slate-500">
            100 thay đổi gần nhất · Phiên bản {snapshot.revision}
          </p>
          {[...snapshot.policy.history].reverse().map((item, index) => (
            <div key={index} className="border-b border-slate-100 py-3 text-sm">
              <span className="font-bold">{item.actorName}</span> ·{" "}
              {item.action}
              <span className="mt-1 block text-xs text-slate-400">
                {new Date(item.at).toLocaleString("vi-VN")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
