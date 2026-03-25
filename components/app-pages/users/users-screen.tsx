"use client";

import { useState } from "react";
import {
  DialogShell,
  DialogHeader,
} from "@/components/app-pages/shared/dialogs";
import {
  PlusCircleIcon,
  ChevronDownIcon,
  DoubleChevronIcon,
} from "@/components/app-pages/shared/icons";

const USERS = [
  {
    id: "1",
    name: "Niles Cabrera",
    email: "niles.tristan.cabrera@student.ateneo.edu",
    role: "Admin",
  },
];

type User = (typeof USERS)[number];

export function UsersScreen() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <div className="px-4 py-4">
      {/* Search + Add */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
          Search
        </div>
        <button
          type="button"
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-1.5 rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Add
          <PlusCircleIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* User list */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        {USERS.map((user, i) => (
          <div key={user.id}>
            <button
              type="button"
              onClick={() => setSelectedUser(user)}
              className="flex w-full items-start justify-between px-4 py-3.5 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{user.name}</span>
                  <span className="flex items-center gap-0.5 rounded-full bg-stone-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    {user.role}
                    <ChevronDownIcon className="h-2.5 w-2.5" />
                  </span>
                </div>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <span className="ml-3 mt-0.5 shrink-0 text-slate-300">
                <DoubleChevronIcon className="h-4 w-4" />
              </span>
            </button>
            {i < USERS.length - 1 && <div className="mx-4 border-b border-slate-100" />}
          </div>
        ))}
      </div>

      {/* Add User Dialog */}
      <DialogShell open={showAddUser} onClose={() => setShowAddUser(false)}>
        <div className="flex items-center justify-between">
          <h2 className="text-3.5 font-bold text-slate-900">Add User</h2>
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-sm text-slate-500"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-700">Name</label>
            <input className="mt-1 h-8 w-full rounded-md border border-lime-300 px-3 text-sm outline-none focus:ring-1 focus:ring-lime-300" />
          </div>
          <div>
            <label className="text-xs text-slate-700">Ateneo Student Email</label>
            <input className="mt-1 h-8 w-full rounded-md border border-lime-300 px-3 text-sm outline-none focus:ring-1 focus:ring-lime-300" />
          </div>
          <div>
            <label className="text-xs text-slate-700">Role</label>
            <div className="relative mt-1 rounded-md border border-lime-300 bg-white">
              <select className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-10 text-sm text-slate-900">
                <option value="">&mdash;</option>
                <option>Admin</option>
                <option>Member</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">&#9660;</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Cancel
            <span className="ml-1">&#10005;</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddUser(false)}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Create
            <span className="ml-1">&#10003;</span>
          </button>
        </div>
      </DialogShell>

      {/* User Details Dialog */}
      {selectedUser && (
        <DialogShell open onClose={() => setSelectedUser(null)}>
          <DialogHeader title="User Details" onClose={() => setSelectedUser(null)} />
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Name</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedUser.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Ateneo Student Email Address</p>
              <p className="mt-0.5 text-sm text-slate-700">{selectedUser.email}</p>
            </div>
            <div>
              <label className="text-sm text-slate-700">Role</label>
              <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
                <select
                  key={selectedUser.id}
                  defaultValue={selectedUser.role}
                  className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900"
                >
                  <option>Admin</option>
                  <option>Member</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">&#9660;</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedUser(null)}
            className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
          >
            Save
          </button>
        </DialogShell>
      )}
    </div>
  );
}
