"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DialogShell,
  DialogHeader,
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

export function UsersScreen() {
  const [showAddUser, setShowAddUser] = useState(false);
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
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );

  return (
    <>
      <div className="px-4 py-4 tablet:hidden">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
            Search
          </div>
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-1.5 rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-700"
          >
            Add
            <PlusCircleIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <LoadingIndicator />
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No users found.</div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {users.map((user, i) => (
              <div key={user.id}>
                <button
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="flex w-full items-start justify-between px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold tracking-tight text-slate-900">
                        {user.name || "Unnamed"}
                      </span>
                      <span className="flex items-center gap-0.5 rounded-full bg-stone-600 px-2.5 py-0.5 text-xs font-medium text-white">
                        {roleLabel(user.auth_role)}
                        <ChevronDownIcon className="h-2.5 w-2.5" />
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      ID: {user.id.slice(0, 8)}...
                    </p>
                  </div>
                  <span className="ml-3 mt-0.5 shrink-0 text-slate-300">
                    <DoubleChevronIcon className="h-4 w-4" />
                  </span>
                </button>
                {i < users.length - 1 ? <div className="mx-4 border-b border-slate-100" /> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Control</h1>
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400"
          >
            <span>Add user</span>
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <section className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-slate-50 px-4 pr-10 text-sm text-slate-800 outline-none"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <button type="button" className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100">
              Filter role <span className="ml-1">&#9662;</span>
            </button>
            <button type="button" className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100">
              Sort by <span className="ml-1">&#9662;</span>
            </button>
          </div>
        </section>

        {loading ? (
          <LoadingIndicator />
        ) : (
          <section className="mt-4 rounded-2xl bg-white ring-1 ring-slate-100">
            <div className="divide-y divide-slate-100 px-5">
              {users.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No users found.</div>
              ) : (
                users.map((user) => (
                  <div key={`desktop-${user.id}`} className="flex items-center justify-between gap-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="min-w-0 text-left"
                    >
                      <p className="text-sm font-bold tracking-tight text-slate-900">
                        {user.name || "Unnamed"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        ID: {user.id.slice(0, 12)}...
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="flex h-8 min-w-32 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <span>{roleLabel(user.auth_role)}</span>
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50"
                        aria-label="More actions"
                      >
                        <span className="text-lg leading-none tracking-widest">···</span>
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
          <h2 className="text-base font-bold tracking-tight text-slate-900">Add User</h2>
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500"
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
            <label className="text-xs text-slate-700">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-lime-300 px-3 text-sm outline-none focus:ring-1 focus:ring-lime-300"
            />
          </div>
          <div>
            <label className="text-xs text-slate-700">
              Supabase User ID (UUID)
            </label>
            <input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="e.g. 123e4567-e89b-..."
              className="mt-1 h-8 w-full rounded-md border border-lime-300 px-3 text-sm outline-none focus:ring-1 focus:ring-lime-300"
            />
          </div>
          <div>
            <label className="text-xs text-slate-700">Role</label>
            <div className="relative mt-1 rounded-md border border-lime-300 bg-white">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-10 text-sm text-slate-900"
              >
                <option value="">&mdash;</option>
                {AUTH_ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                &#9660;
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Cancel
            <span className="ml-1">&#10005;</span>
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
            <span className="ml-1">&#10003;</span>
          </button>
        </div>
      </DialogShell>

      {/* User Details Dialog */}
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
              <p className="text-xs font-medium text-slate-500">Name</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {selectedUser.name || "Unnamed"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">
                User ID
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {selectedUser.id}
              </p>
            </div>
            <div>
              <label className="text-sm text-slate-700">Role</label>
              <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900"
                >
                  {AUTH_ROLE_VALUES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  &#9660;
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveRole}
            className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </DialogShell>
      ) : null}
    </>
  );
}
