"use client";

import { useState, useCallback, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { SearchDialog } from "@/components/app-pages/shared/dialogs";
import {
  AddUserDialog,
  DeleteUserDialog,
  UserFiltersDialog,
  UserSortByDialog,
} from "@/components/app-pages/admin/user-dialogs";
import {
  ChevronDownIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/app-pages/shared/icons";
import {
  getAllowedEmails,
  addUser,
  removeAllowedEmail,
  editAllowedEmail,
} from "@/app/actions/users";
import type { findAllowedEmailsWithProfile } from "@/lib/repo/users.repo";
import type { RegionOption } from "@/lib/repo/regions.repo";
import { AUTH_ROLE_VALUES } from "@/lib/db/enums";
import type { AuthRole } from "@/lib/db/enums";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { USERS_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { CustomSelect } from "@/components/ui/custom-select";
import { RegionControls } from "./region-controls";
import { GSheetConfigControls } from "./gsheet-config-controls";

type AllowedEmailEntry = Awaited<ReturnType<typeof findAllowedEmailsWithProfile>>[number];

function AdminError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2"
    >
      <p className="text-xs font-medium text-red-700">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="shrink-0 text-red-400 transition-colors hover:text-red-700"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
    </div>
  );
}

function RoleSelect({
  user,
  onRoleChange,
}: {
  user: AllowedEmailEntry;
  onRoleChange: (id: string, role: AuthRole) => void;
}) {
  return (
    <div className="w-36" onClick={(e) => e.stopPropagation()}>
      <CustomSelect
        options={AUTH_ROLE_VALUES}
        value={user.auth_role ?? "Volunteer"}
        onChange={(v) => onRoleChange(user.id, v as AuthRole)}
        variant="white"
        size="sm"
      />
    </div>
  );
}

type AdminScreenProps = {
  initialUsers: AllowedEmailEntry[];
  initialSyncStatus: { frozen: boolean | null; reason: string | null };
  initialRegions: RegionOption[];
};

const USER_PAGE_SIZE = 10;

export function AdminScreen({
  initialUsers,
  initialSyncStatus,
  initialRegions,
}: AdminScreenProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [users, setUsers] = useState<AllowedEmailEntry[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userPage, setUserPage] = useState(0);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("Volunteer");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startRoleTransition] = useTransition();

  const {
    filtered: filteredUsers,
    activeFilters,
    activeFilterCount,
    sortKey,
    sortOrder,
    openDialog,
    openFilterDialog,
    openSortDialog,
    closeDialog,
    applyFilters: _applyFilters,
    applySort: _applySort,
    clearFilters: _clearFilters,
    search,
    setSearch,
  } = useFilterSort<AllowedEmailEntry>(
    users,
    USERS_CONFIG,
    (user, key) => (key === "auth_role" ? user.auth_role ?? null : null),
    (user, key) => {
      if (key === "name") return user.profile_name ?? "";
      if (key === "auth_role") return user.auth_role ?? "";
      return null;
    },
  );

  const applyFilters = useCallback((filters: Record<string, string>) => {
    setUserPage(0);
    _applyFilters(filters);
  }, [_applyFilters]);

  const applySort = useCallback((key: string | null, order: "asc" | "desc") => {
    setUserPage(0);
    _applySort(key, order);
  }, [_applySort]);

  const clearFilters = useCallback(() => {
    setUserPage(0);
    _clearFilters();
  }, [_clearFilters]);

  const searchedUsers = search
    ? filteredUsers.filter((u) => {
        const q = search.toLowerCase();
        return u.profile_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : filteredUsers;

  const totalUserPages = Math.ceil(searchedUsers.length / USER_PAGE_SIZE);
  const safeUserPage = Math.min(userPage, Math.max(0, totalUserPages - 1));
  const pagedUsers = searchedUsers.slice(
    safeUserPage * USER_PAGE_SIZE,
    safeUserPage * USER_PAGE_SIZE + USER_PAGE_SIZE,
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllowedEmails();
      if (result?.data) setUsers(result.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newEmail.trim()) { setError("Email is required."); return; }
    setCreating(true);
    setError(null);
    try {
      const result = await addUser({
        email: newEmail.trim(),
        name: newName || undefined,
        auth_role: (newRole || "Volunteer") as AuthRole,
      });
      if (result?.serverError) { setError(result.serverError); return; }
      setNewEmail(""); setNewName(""); setNewRole("Volunteer");
      setShowAddUser(false);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }, [newEmail, newName, newRole, fetchUsers]);

  const handleDeleteClick = useCallback((userId: string) => {
    setUserToDelete(userId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const result = await removeAllowedEmail.bind(null, userToDelete)();
      if (result?.serverError) { setError(result.serverError); return; }
      await fetchUsers();
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }, [userToDelete, fetchUsers]);

  // Optimistic role update — writes both allowedEmails.auth_role and
  // profiles.auth_role. Reverts on failure; without the rollback a rejected
  // change kept displaying as applied until reload.
  const handleRoleChange = useCallback(
    (userId: string, role: AuthRole) => {
      const previous = users.find((u) => u.id === userId)?.auth_role;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, auth_role: role } : u)),
      );
      startRoleTransition(async () => {
        const result = await editAllowedEmail.bind(null, userId)({
          auth_role: role,
        });
        if (result?.serverError) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId && previous
                ? { ...u, auth_role: previous }
                : u,
            ),
          );
          setError(result.serverError);
        }
      });
    },
    [users],
  );


  return (
    <>
      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
          <p className="mb-4 font-heading text-2xl font-bold text-brand-green">Admin</p>

          {error && !showAddUser ? (
            <AdminError message={error} onDismiss={() => setError(null)} />
          ) : null}

          {/* Users & Access */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-dark">Users &amp; Access</h2>
              <button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Add Entry <PlusIcon className="h-3 w-3" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-orange px-3 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                <span>Search</span> <SearchIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openFilterDialog()}
                className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Filter <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openSortDialog()}
                className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Sort By <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            {loading ? (
              <LoadingIndicator />
            ) : searchedUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-brand-dark/50">No users found.</div>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between overflow-hidden rounded-2xl bg-white p-3.5 ring-1 ring-brand-dark/8"
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="mb-0.5 truncate font-bold tracking-tight text-brand-dark">
                          {user.profile_name || user.email}
                        </p>
                        <p className="truncate text-xs font-medium text-brand-dark/65">{user.email}</p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <RoleSelect user={user} onRoleChange={handleRoleChange} />
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(user.id)}
                          className="flex h-7 w-8 items-center justify-center rounded-lg bg-brand-dark text-white shadow-sm transition-opacity hover:opacity-90"
                          aria-label="Delete user"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalUserPages > 1 && (
                  <div className="mt-3 flex items-center justify-between px-1">
                    <button
                      type="button"
                      disabled={safeUserPage === 0}
                      onClick={() => setUserPage(safeUserPage - 1)}
                      className="text-xs font-semibold text-brand-dark/60 hover:text-brand-dark disabled:opacity-30"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-brand-dark/40">
                      {safeUserPage + 1} / {totalUserPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeUserPage >= totalUserPages - 1}
                      onClick={() => setUserPage(safeUserPage + 1)}
                      className="text-xs font-semibold text-brand-dark/60 hover:text-brand-dark disabled:opacity-30"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4 pb-20">
            <GSheetConfigControls initialStatus={initialSyncStatus} />
            <RegionControls initialRegions={initialRegions} />
          </div>
        </div>
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight text-brand-dark">Admin</h1>

        {error && !showAddUser ? (
          <AdminError message={error} onDismiss={() => setError(null)} />
        ) : null}

        <div className="space-y-6">
          {/* Users & Access */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-dark">Users &amp; Access</h2>
              <button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                Add Entry <PlusIcon className="h-3 w-3" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
              {/* Search + filter + sort */}
              <div className="flex items-center gap-2 border-b border-border p-3">
                <div className="relative flex-1">
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/40" />
                  <input
                    type="text"
                    placeholder="Search by name or email"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setUserPage(0); }}
                    className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-brand-dark outline-none placeholder:text-brand-dark/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openFilterDialog()}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                >
                  Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => openSortDialog()}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                >
                  Sort <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>

              {loading ? (
                <LoadingIndicator />
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_1fr_10rem_3rem] gap-x-3 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Role</span>
                    <span />
                  </div>

                  <div className="divide-y divide-border">
                    {searchedUsers.length === 0 ? (
                      <div className="py-10 text-center text-sm text-brand-dark/50">No users found.</div>
                    ) : (
                      pagedUsers.map((user) => (
                        <div
                          key={`desktop-${user.id}`}
                          className="grid grid-cols-[1fr_1fr_10rem_3rem] items-center gap-x-3 px-5 py-2.5"
                        >
                          <p className="min-w-0 truncate font-heading text-sm font-bold text-brand-dark">
                            {user.profile_name || "—"}
                          </p>
                          <p className="min-w-0 truncate text-sm text-brand-dark/70">
                            {user.email}
                          </p>
                          <RoleSelect user={user} onRoleChange={handleRoleChange} />
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(user.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-white transition-opacity hover:opacity-90"
                            aria-label="Delete user"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {totalUserPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
                      <button
                        type="button"
                        disabled={safeUserPage === 0}
                        onClick={() => setUserPage(safeUserPage - 1)}
                        className="text-xs font-semibold text-brand-dark/60 hover:text-brand-dark disabled:opacity-30"
                      >
                        ← Prev
                      </button>
                      <span className="text-xs text-brand-dark/40">
                        {safeUserPage + 1} / {totalUserPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeUserPage >= totalUserPages - 1}
                        onClick={() => setUserPage(safeUserPage + 1)}
                        className="text-xs font-semibold text-brand-dark/60 hover:text-brand-dark disabled:opacity-30"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <GSheetConfigControls initialStatus={initialSyncStatus} />
          <RegionControls initialRegions={initialRegions} />
        </div>
      </div>

      {/* Dialogs */}
      <AddUserDialog
        open={showAddUser}
        onClose={() => { setShowAddUser(false); setError(null); }}
        name={newName}
        onNameChange={setNewName}
        email={newEmail}
        onEmailChange={setNewEmail}
        role={newRole}
        onRoleChange={setNewRole}
        roleOptions={AUTH_ROLE_VALUES}
        onCreate={handleCreate}
        creating={creating}
        error={showAddUser ? error : null}
      />
      <UserFiltersDialog
        open={openDialog === "filter"}
        onClose={closeDialog}
        categories={USERS_CONFIG.filters}
        activeFilters={activeFilters}
        onClear={clearFilters}
        onApply={applyFilters}
      />
      <UserSortByDialog
        open={openDialog === "sort"}
        onClose={closeDialog}
        options={USERS_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onApply={applySort}
      />
      <SearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        search={search}
        onSearchChange={(value) => { setSearch(value); setUserPage(0); }}
      />
      <DeleteUserDialog
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
      />
    </>
  );
}
