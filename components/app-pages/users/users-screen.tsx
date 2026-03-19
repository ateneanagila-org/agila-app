"use client";

import { useState } from "react";

const USERS = [
  {
    id: "1",
    name: "Niles Cabrera",
    email: "niles.tristan.cabrera@student.ateneo.edu",
    role: "Admin",
  },
];

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

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
          onClick={() => setShowAddUser(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-600 text-white"
        >
          <PlusCircleIcon className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* User list */}
      <div className="space-y-0 overflow-hidden rounded-xl bg-white">
        {USERS.map((user, i) => (
          <div key={user.id}>
            <button
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
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </span>
            </button>
            {i < USERS.length - 1 && <div className="mx-4 border-b border-slate-100" />}
          </div>
        ))}
      </div>

      {/* Add User Dialog */}
      {showAddUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setShowAddUser(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">New User</h2>
              <button onClick={() => setShowAddUser(false)} className="text-xl leading-none text-slate-400">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-700">Name</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
              <div>
                <label className="text-sm text-slate-700">Ateneo Student Email Address</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
              <div>
                <label className="text-sm text-slate-700">Role</label>
                <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
                  <select className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900">
                    <option value="">—</option>
                    <option>Admin</option>
                    <option>Member</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddUser(false)}
                className="rounded-full bg-stone-600 px-6 py-2.5 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Dialog */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">User Details</h2>
              <button onClick={() => setSelectedUser(null)} className="text-xl leading-none text-slate-400">
                ✕
              </button>
            </div>
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
                    defaultValue={selectedUser.role}
                    className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900"
                  >
                    <option>Admin</option>
                    <option>Member</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
