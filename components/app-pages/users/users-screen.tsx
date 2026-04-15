"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DialogShell,
  DialogHeader,
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import {
  PlusCircleIcon,
  ChevronDownIcon,
  DoubleChevronIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import {
  getProfiles,
  createProfile,
  editProfile,
  removeProfile,
} from "@/app/actions/users";
import type { SelectProfile } from "@/lib/validation/users";
import { AUTH_ROLE_VALUES } from "@/lib/db/enums";
import type { AuthRole } from "@/lib/db/enums";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { USERS_CONFIG } from "@/lib/hooks/filter-sort-configs";

export function UsersScreen() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectProfile | null>(null);
  const [users, setUsers] = useState<SelectProfile[]>([]);
  const [loading, setLoading] = useState(true);

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
  } = useFilterSort<SelectProfile>(
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
          u.id.toLowerCase().includes(q)
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
      const boundEdit = editProfile.bind(null, selectedUser.id);
      const result = await boundEdit({
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

  const handleDelete = useCallback(
    async (userId: string) => {
      if (!confirm("Are you sure you want to remove this user?")) return;
      try {
        const boundRemove = removeProfile.bind(null, userId);
        await boundRemove();
        await fetchUsers();
      } catch (err) {
        console.error("Failed to delete user:", err);
      }
    },
    [fetchUsers],
  );

  const handleSelectUser = useCallback((user: SelectProfile) => {
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
      <div className="px-4 py-4 tablet:hidden">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            className="flex flex-1 items-center gap-2 rounded-full bg-brand-orange px-3 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            <span className="text-white/70">Search</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            Add Entry
            <PlusCircleIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <LoadingIndicator />
        ) : searchedUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/50">No users found.</div>
        ) : (
          <div className="space-y-2">
            {searchedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-start justify-between overflow-hidden rounded-2xl bg-brand-green p-3.5"
              >
                <button
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-yellow-200">
                      {user.name || "Unnamed"}
                    </span>
                    <span className="flex items-center gap-0.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                      {roleLabel(user.auth_role)}
                      <ChevronDownIcon className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <p className="text-xs text-white/70">
                    {user.id.slice(0, 8)}...
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(user.id)}
                  className="ml-3 mt-0.5 shrink-0 text-white transition-opacity hover:opacity-90"
                  aria-label="Delete user"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">User Control</h1>
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <span>Add entry</span>
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl bg-brand-green p-3 ring-1 ring-brand-green">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-full bg-white/15 px-4 pr-10 text-sm text-white outline-none placeholder:text-white/60"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Filter role{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="flex items-center gap-1 rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Sort by <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {loading ? (
          <LoadingIndicator />
        ) : (
          <section className="mt-4 rounded-2xl bg-brand-green ring-1 ring-brand-green">
            <div className="divide-y divide-white/10 px-5">
              {searchedUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-white/50">No users found.</div>
              ) : (
                searchedUsers.map((user) => (
                  <div key={`desktop-${user.id}`} className="flex items-center justify-between gap-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="min-w-0 text-left"
                    >
                      <p className="font-heading text-sm font-bold tracking-tight text-yellow-200">
                        {user.name || "Unnamed"}
                      </p>
                      <p className="mt-0.5 text-xs text-white/70">
                        ID: {user.id.slice(0, 12)}...
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="flex h-8 min-w-32 items-center justify-between rounded-lg border border-white/20 bg-white/15 px-3 text-sm text-white transition-opacity hover:opacity-90"
                      >
                        <span>{roleLabel(user.auth_role)}</span>
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90"
                        aria-label="Delete user"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* Add User Dialog */}
      <DialogShell open={showAddUser} onClose={() => setShowAddUser(false)}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-white">Add User</h2>
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm text-white"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>

        {error && showAddUser ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/70">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-white/20 bg-white/15 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/70">
              Supabase User ID (UUID)
            </label>
            <input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="e.g. 123e4567-e89b-..."
              className="mt-1 h-8 w-full rounded-md border border-white/20 bg-white/15 px-3 text-sm text-white outline-none placeholder:text-white/50 focus:ring-1 focus:ring-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/70">Role</label>
            <div className="relative mt-1 rounded-md border border-white/20 bg-white/15">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-8 w-full appearance-none rounded-md bg-white/15 px-3 pr-10 text-sm text-white"
              >
                <option value="">&mdash;</option>
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
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="rounded-full border border-brand-orange bg-transparent px-3 py-1 text-xs font-medium text-brand-orange"
          >
            Cancel
            <span className="ml-1">&#10005;</span>
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="rounded-full bg-brand-orange px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
            <span className="ml-1">&#10003;</span>
          </button>
        </div>
      </DialogShell>

      {/* User Details Dialog */}
      <FiltersDialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={USERS_CONFIG.filters}
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        activeCount={activeFilterCount}
      />
      <SortByDialog
        open={showSort}
        onClose={() => setShowSort(false)}
        options={USERS_CONFIG.sortOptions}
        activeKey={sortKey}
        order={sortOrder}
        onSort={setSortKey}
        onOrder={setSortOrder}
      />

      {selectedUser ? (
        <DialogShell open onClose={() => setSelectedUser(null)}>
          <DialogHeader
            title="User Details"
            onClose={() => setSelectedUser(null)}
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
              <p className="text-xs font-medium text-white/70">
                User ID
              </p>
              <p className="mt-0.5 text-sm text-white/80">
                {selectedUser.id}
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
    </>
  );
}
