import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove, isAdmin as isAdminRole, canManage } from "../lib/roles";
import { PlusIcon, CheckIcon } from "../components/icons";

const ROLE_BADGE_CLASS = {
  admin: "bg-violet-50 text-violet-700 ring-violet-600/20",
  manager: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  waiter: "bg-slate-100 text-slate-600 ring-slate-400/20",
};

export function TeamPage() {
  const { user } = useAuth();
  const isManager = isManagerOrAbove(user?.role);
  const isAdmin = isAdminRole(user?.role);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
    enabled: isManager,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("waiter");

  const [justCreated, setJustCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/users", payload),
    // `variables` is exactly what was passed to mutate() below — including the password, which
    // the server response never echoes back (and shouldn't). This is the only moment the
    // password is available anywhere after this request, so it's held in local state just long
    // enough to show it once, never sent anywhere else or persisted.
    onSuccess: (result, variables) => {
      invalidateUsers();
      setJustCreated({ name: result.user.name, email: result.user.email, password: variables.password });
      setCopied(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("waiter");
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role: newRole }) => api.patch(`/users/${id}/role`, { role: newRole }),
    onSuccess: invalidateUsers,
  });

  const [resettingId, setResettingId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, new_password }) => api.patch(`/users/${id}/password`, { new_password }),
    onSuccess: () => {
      setResettingId(null);
      setNewPassword("");
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    createMutation.mutate({ name: name.trim(), email: email.trim(), password, role });
  }

  function handleResetSubmit(e, id) {
    e.preventDefault();
    if (newPassword.length < 8) return;
    resetPasswordMutation.mutate({ id, new_password: newPassword });
  }

  async function handleCopyPassword() {
    try {
      await navigator.clipboard.writeText(justCreated.password);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked (permissions, non-secure context) — the password is
      // still shown in the card either way, so this just means they select-and-copy manually.
    }
  }

  if (!isManager) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
        <p className="mt-2 text-sm text-slate-500">Only managers can view the team list.</p>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {isAdmin
            ? "Add waiter or manager accounts, and change anyone's role."
            : "Add waiter accounts for new hires — only an admin can create a manager account."}
        </p>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}
      {roleMutation.error && <p className="mt-2 text-sm text-red-600">{roleMutation.error.message}</p>}
      {resetPasswordMutation.error && (
        <p className="mt-2 text-sm text-red-600">{resetPasswordMutation.error.message}</p>
      )}

      {data && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((person) => (
                <tr key={person.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {person.name}
                    {person.id === user.id && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{person.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${ROLE_BADGE_CLASS[person.role]}`}
                    >
                      {person.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && person.role === "waiter" && (
                        <button
                          onClick={() => roleMutation.mutate({ id: person.id, role: "manager" })}
                          disabled={roleMutation.isPending}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                        >
                          Promote to manager
                        </button>
                      )}
                      {isAdmin && person.role === "manager" && (
                        <button
                          onClick={() => roleMutation.mutate({ id: person.id, role: "waiter" })}
                          disabled={roleMutation.isPending}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                        >
                          Demote to waiter
                        </button>
                      )}
                      {canManage(user.role, person.role) &&
                        (resettingId === person.id ? (
                          <form onSubmit={(e) => handleResetSubmit(e, person.id)} className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="new password"
                              minLength={8}
                              required
                              className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={resetPasswordMutation.isPending}
                              className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Set
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResettingId(null);
                                setNewPassword("");
                              }}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => setResettingId(person.id)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                          >
                            Reset password
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {justCreated && (
        <div className="mt-6 max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-emerald-900">Account created — copy this now</h2>
            <button
              onClick={() => setJustCreated(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-xs text-emerald-700">
            This password won't be shown again. Share it with {justCreated.name} directly, then have
            them log in and it's safe to lose track of it — if it does get lost before you share it,
            just reset their password again from the list above.
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-emerald-700">Name</dt>
              <dd className="text-emerald-950">{justCreated.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-emerald-700">Email</dt>
              <dd className="text-emerald-950">{justCreated.email}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-emerald-700">Password</dt>
              <dd className="font-mono text-emerald-950">{justCreated.password}</dd>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                {copied ? (
                  <>
                    <CheckIcon width="12" height="12" />
                    Copied
                  </>
                ) : (
                  "Copy"
                )}
              </button>
            </div>
          </dl>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-6 flex max-w-2xl flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="min-w-[9rem] flex-1">
          <label className="block text-sm font-medium text-slate-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="min-w-[11rem] flex-1">
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <label className="block text-sm font-medium text-slate-700">Initial password</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="share this with them"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="w-36">
          <label className="block text-sm font-medium text-slate-700">Role</label>
          {isAdmin ? (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="waiter">Waiter</option>
              <option value="manager">Manager</option>
            </select>
          ) : (
            <input
              disabled
              value="Waiter"
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <PlusIcon />
          Add account
        </button>
      </form>
      {createMutation.error && <p className="mt-2 text-sm text-red-600">{createMutation.error.message}</p>}
    </div>
  );
}
