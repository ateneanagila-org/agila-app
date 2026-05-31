"use client";

import { useState, useCallback } from "react";
import { SearchDialog } from "@/components/app-pages/shared/dialogs";

import {
  AddUserDialog,
  DeleteUserDialog,
  UserFiltersDialog,
  UserSortByDialog,
} from "@/components/app-pages/users/user-dialogs";
import { UserDetailsDialog } from "@/components/app-pages/shared/user-details-dialog";
import {
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";
import {
  getAllowedEmails,
  addUser,
  removeAllowedEmail,
} from "@/app/actions/users";
import type { findAllowedEmailsWithProfile } from "@/lib/repo/users.repo";
import { AUTH_ROLE_VALUES } from "@/lib/db/enums";
import type { AuthRole } from "@/lib/db/enums";
import { useFilterSort } from "@/lib/hooks/use-filter-sort";
import { USERS_CONFIG } from "@/lib/hooks/filter-sort-configs";
import { SyncControls } from "./sync-controls";

type AllowedEmailEntry = Awaited<ReturnType<typeof findAllowedEmailsWithProfile>>[number];

type UsersScreenProps = {
  initialUsers: AllowedEmailEntry[];
  initialSyncStatus: {
    frozen: boolean | null;
    reason: string | null;
  };
};

export function UsersScreen({
  initialUsers,
  initialSyncStatus,
}: UsersScreenProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AllowedEmailEntry | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [users, setUsers] = useState<AllowedEmailEntry[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("Volunteer");
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);

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
    applyFilters,
    applySort,
    clearFilters,
    search,
    setSearch,
  } = useFilterSort<AllowedEmailEntry>(
    users,
    USERS_CONFIG,
    (user, key) => {
      if (key === "auth_role") return user.auth_role ?? null;
      return null;
    },
    (user, key) => {
      if (key === "name") return user.profile_name ?? "";
      if (key === "auth_role") return user.auth_role ?? "";
      return null;
    },
  );

  const searchedUsers = search
    ? filteredUsers.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.profile_name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
    : filteredUsers;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllowedEmails();
      if (result?.data) {
        setUsers(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newEmail.trim()) {
      setError("Email is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await addUser({
        email: newEmail.trim(),
        name: newName || undefined,
        auth_role: (newRole || "Volunteer") as AuthRole,
      });
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
      setNewEmail("");
      setNewName("");
      setNewRole("Volunteer");
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
      const boundRemove = removeAllowedEmail.bind(null, userToDelete);
      const result = await boundRemove();
      if (result?.serverError) {
        setError(result.serverError);
        return;
      }
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

  const handleSelectUser = useCallback((user: AllowedEmailEntry) => {
    setSelectedUser(user);
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
            <SyncControls initialStatus={initialSyncStatus} />
          </div>
          {/* Add Entry Button */}
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 shadow-sm"
          >
            Add Entry <PlusIcon className="h-4 w-4" />
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

          {/* User List */}
          {loading ? (
            <LoadingIndicator />
          ) : searchedUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-brand-dark/50">No users found.</div>
          ) : (
            <div className="space-y-2 pb-20">
              {searchedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-start justify-between overflow-hidden rounded-2xl bg-white p-3.5 ring-1 ring-brand-dark/8"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold tracking-tight text-brand-dark">
                        {user.profile_name || user.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="flex items-center gap-0.5 rounded-full bg-brand-mint px-2.5 py-0.5 text-xs font-bold text-brand-green transition-opacity hover:opacity-90"
                      >
                        {roleLabel(user.auth_role)}
                        <ChevronDownIcon className="ml-0.5 h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs font-medium text-brand-dark/65">
                      {user.email}
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
          className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange p-0 leading-none shadow-lg transition-transform hover:scale-110 active:scale-95 tablet:hidden"
          aria-label="Add entry"
        >
          <PlusIcon className="h-6 w-6 text-white" />
        </button>
      </div>

      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-dark">
              User Control
            </h1>
            <p className="mt-1 text-xs font-semibold text-brand-green">
              {searchedUsers.length} allowed users
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 rounded-full bg-brand-dark px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <span>Add entry</span>
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <SyncControls initialStatus={initialSyncStatus} />
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
            onClick={() => openFilterDialog()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Filter role{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}{" "}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openSortDialog()}
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
                        {user.profile_name || "—"}
                      </p>
                    </button>
                    <p className="truncate text-sm text-brand-dark/70">
                      {user.email}
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

      <UserDetailsDialog
        open={selectedUser !== null}
        onClose={() => {
          setSelectedUser(null);
          setError(null);
        }}
        name={selectedUser?.profile_name}
        email={selectedUser?.email}
        role={roleLabel(selectedUser?.auth_role)}
      />

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
