"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DialogShell,
  DialogHeader,
  SearchDialog,
} from "@/components/app-pages/shared/dialogs";

import {
  AddUserDialog,
  DeleteUserDialog,
  UserFiltersDialog,
  UserSortByDialog,
} from "@/components/app-pages/users/user-dialogs";
import {
  ChevronDownIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import {
  getProfiles,
  createProfile,
  editProfile,
  removeProfile,
} from "@/app/actions/users";
import type { findProfiles } from "@/lib/repo/users.repo";
import { AUTH_ROLE_VALUES } from "@/lib/db/enums";
import type { AuthRole } from "@/lib/db/enums";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { USERS_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { SyncControls } from "./sync-controls";

type ProfileWithEmail = Awaited<ReturnType<typeof findProfiles>>[number];

export function UsersScreen() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileWithEmail | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [users, setUsers] = useState<ProfileWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Add user form
  const [newUserId, setNewUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Edit user form
  const [editRole, setEditRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const {
    filtered: filteredUsers,
    activeFilters,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
    search,
    setSearch,
  } = useFilterSort<ProfileWithEmail>(
    users,
    USERS_CONFIG,
    (user, key) => {
      if (key === "auth_role") return user.auth_role ?? null;
      return null;
    },
    (user, key) => {
      if (key === "name") return user.name ?? "";
      if (key === "auth_role") return user.auth_role ?? "";
      return null;
    },
  );

  const searchedUsers = search
    ? filteredUsers.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.user?.email.toLowerCase().includes(q)
        );
      })
    : filteredUsers;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProfiles({});
      if (result?.data) {
        setUsers(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = useCallback(async () => {
    if (!newUserId.trim()) {
      setError("User ID (Supabase UUID) is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await createProfile({
        id: newUserId,
        name: newName || undefined,
        auth_role: (newRole || "Volunteer") as AuthRole,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setNewUserId("");
      setNewName("");
      setNewRole("");
      setShowAddUser(false);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }, [newUserId, newName, newRole, fetchUsers]);

  const handleSaveRole = useCallback(async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      const result = await editProfile.bind(null, selectedUser.id)({
        id: selectedUser.id,
        auth_role: editRole as AuthRole,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [selectedUser, editRole, fetchUsers]);

  const handleDeleteClick = useCallback((userId: string) => {
    setUserToDelete(userId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const boundRemove = removeProfile.bind(null, userToDelete);
      await boundRemove();
      await fetchUsers();
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (err) {
      console.error("Failed to delete user:", err);
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }, [userToDelete, fetchUsers]);

  const handleSelectUser = useCallback((user: ProfileWithEmail) => {
    setSelectedUser(user);
    setEditRole(user.auth_role ?? "Volunteer");
  }, []);

  /** Map auth_role to display label */
  const roleLabel = (role: string | null | undefined): string => {
    return role ?? "Volunteer";
  };

  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green/30 border-t-brand-green" />
    </div>
  );

  return (
    <>
      <div className="relative flex min-h-screen flex-col tablet:hidden">
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="mb-4">
            <p className="font-heading text-2xl font-bold text-brand-green">User Control</p>
          </div>
          <div className="mb-4">
            <SyncControls />
          </div>
          {/* Add Entry Button */}
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-sm"
          >
            Add Entry <span className="text-xl">+</span>
          </button>

          {/* Search, Filter, Sort */}
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-orange px-3 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <span>Search</span> <SearchIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Filter <span className="text-xs">▼</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort By <span className="text-xs">▼</span>
            </button>
          </div>

          {/* User List */}
          {loading ? (
            <LoadingIndicator />
          ) : searchedUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/50">No users found.</div>
          ) : (
            <div className="space-y-2 pb-20">
              {searchedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-start justify-between overflow-hidden rounded-2xl bg-brand-green p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold tracking-tight text-brand-yellow">
                        {user.name || "Unnamed"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-brand-orange shadow-sm transition-opacity hover:opacity-90"
                      >
                        {roleLabel(user.auth_role)}
                        <span className="text-[10px] ml-0.5">▼</span>
                      </button>
                    </div>
                    <p className="text-xs font-medium text-white">
                      {user.user?.email ?? user.id.slice(0, 8) + "..."}
                    </p>
                  </div>
                  <div className="flex w-10 shrink-0 items-center justify-center">
                    <button
                        type="button"
                        onClick={() => handleDeleteClick(user.id)}
                        className="flex h-7 w-8 items-center justify-center rounded-lg bg-brand-dark text-white shadow-sm transition-opacity hover:opacity-90"
                        aria-label="Delete user"
                    >
                        🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAB Button - fixed above bottom nav */}
        <button
          type="button"
          onClick={() => setShowAddUser(true)}
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange shadow-lg transition-transform hover:scale-110 active:scale-95 tablet:hidden"
          aria-label="Add entry"
        >
          <span className="text-2xl font-bold text-white">+</span>
        </button>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-dark">
              User Control
            </h1>
            <p className="mt-1 text-xs font-semibold text-brand-green">
              {searchedUsers.length} users registered
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <span>Add entry</span>
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <div className="mt-5">
          <SyncControls />
        </div>

        <section className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-border">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/40" />
            <input
              type="text"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl bg-brand-cream pl-10 pr-4 text-sm text-brand-dark outline-none placeholder:text-brand-dark/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Filter role{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Sort by <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        </section>

        {loading ? (
          <LoadingIndicator />
        ) : (
          <section className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-border">
            <div className="grid grid-cols-[1fr_1fr_10rem_3rem] gap-x-3 border-b border-border bg-brand-cream px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {searchedUsers.length === 0 ? (
                <div className="py-10 text-center text-sm text-brand-dark/50">
                  No users found.
                </div>
              ) : (
                searchedUsers.map((user) => (
                  <div
                    key={`desktop-${user.id}`}
                    className="grid grid-cols-[1fr_1fr_10rem_3rem] items-center gap-x-3 px-5 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate font-heading text-sm font-bold text-brand-dark">
                        {user.name || "Unnamed"}
                      </p>
                    </button>
                    <p className="truncate text-sm text-brand-dark/70">
                      {user.user?.email ?? user.id.slice(0, 12) + "…"}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="flex h-8 items-center justify-between rounded-full bg-brand-mint px-3 text-xs font-bold text-brand-green transition-opacity hover:opacity-90"
                    >
                      <span>{roleLabel(user.auth_role)}</span>
                      <ChevronDownIcon className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(user.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-white transition-opacity hover:opacity-90"
                      aria-label="Delete user"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      <AddUserDialog
        open={showAddUser}
        onClose={() => { setShowAddUser(false); setError(null); }}
        name={newName}
        onNameChange={setNewName}
        userId={newUserId}
        onUserIdChange={setNewUserId}
        role={newRole}
        onRoleChange={setNewRole}
        roleOptions={AUTH_ROLE_VALUES}
        onCreate={handleCreate}
        creating={creating}
        error={showAddUser ? error : null}
      />

      <UserFiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={USERS_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <UserSortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={USERS_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />

      {selectedUser ? (
        <DialogShell open onClose={() => { setSelectedUser(null); setError(null); }}>
          <DialogHeader
            title="User Details"
            onClose={() => { setSelectedUser(null); setError(null); }}
          />

          {error && selectedUser ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-white/70">Name</p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                {selectedUser.name || "Unnamed"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-white/70">Email</p>
              <p className="mt-0.5 text-sm text-white/80">
                {selectedUser.user?.email ?? selectedUser.id}
              </p>
            </div>
            <div>
              <label className="text-sm text-white/70">Role</label>
              <div className="relative mt-1 rounded-lg border border-white/20 bg-white/15">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg bg-white/15 px-3 pr-10 text-sm text-white"
                >
                  {AUTH_ROLE_VALUES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
                  &#9660;
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveRole}
            className="w-full rounded-full bg-brand-orange py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </DialogShell>
      ) : null}

      {/* Search Dialog */}
      <SearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteUserDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
      />
    </>
  );
}
