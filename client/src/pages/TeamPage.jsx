import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove, isAdmin as isAdminRole, canManage } from "../lib/roles";
import { PlusIcon, CheckIcon, ArchiveIcon, RestoreIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkCard, DarkPanelCard } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/DarkInput";
import { Badge } from "../components/ui/Badge";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { TableSkeleton } from "../components/ui/Skeleton";

const ROLE_TONE = { admin: "violet", manager: "indigo", waiter: "slate" };

export function TeamPage() {
  const { user } = useAuth();
  const isManager = isManagerOrAbove(user?.role);
  const isAdmin = isAdminRole(user?.role);
  const queryClient = useQueryClient();

  const [showDeactivated, setShowDeactivated] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", showDeactivated],
    queryFn: () => api.get(`/users${showDeactivated ? "?include_inactive=true" : ""}`),
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

  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState(null);

  // "Delete" in the UI, deactivate underneath — see server/prisma/schema.prisma's isActive
  // comment for why a real delete isn't just undesirable but actually impossible once someone
  // has any order history.
  const deactivateMutation = useMutation({
    mutationFn: (id) => api.post(`/users/${id}/deactivate`),
    onSuccess: () => {
      invalidateUsers();
      setConfirmingDeactivateId(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => api.post(`/users/${id}/reactivate`),
    onSuccess: invalidateUsers,
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
        <PageHeader title="Team" subtitle="Only managers can view the team list." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={
          isAdmin
            ? "Add waiter or manager accounts, and change anyone's role."
            : "Add waiter accounts for new hires — only an admin can create a manager account."
        }
        action={
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-indigo-500"
            />
            Show deactivated
          </label>
        }
      />

      <ErrorMessage error={error} className="mt-6" />
      <ErrorMessage error={roleMutation.error} className="mt-2" />
      <ErrorMessage error={resetPasswordMutation.error} className="mt-2" />
      <ErrorMessage error={deactivateMutation.error} className="mt-2" />
      <ErrorMessage error={reactivateMutation.error} className="mt-2" />

      {isLoading && (
        <DarkPanelCard className="mt-5">
          <TableSkeleton cols={4} />
        </DarkPanelCard>
      )}

      {data && (
        <DarkPanelCard className="mt-5 animate-fade-in">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.users.map((person) => (
                <tr
                  key={person.id}
                  className={`transition-colors hover:bg-white/5 ${person.isActive ? "" : "opacity-50"}`}
                >
                  <td className="px-5 py-3 font-medium text-white">
                    {person.name}
                    {person.id === user.id && <span className="ml-1.5 text-xs text-zinc-500">(you)</span>}
                    {!person.isActive && <span className="ml-1.5 text-xs text-zinc-500">(deactivated)</span>}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{person.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={ROLE_TONE[person.role]}>{person.role}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && person.isActive && person.role === "waiter" && (
                        <Button
                          variant="secondaryDark"
                          size="sm"
                          className="hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-300"
                          onClick={() => roleMutation.mutate({ id: person.id, role: "manager" })}
                          loading={roleMutation.isPending}
                        >
                          Promote to manager
                        </Button>
                      )}
                      {isAdmin && person.isActive && person.role === "manager" && (
                        <Button
                          variant="secondaryDark"
                          size="sm"
                          className="hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-300"
                          onClick={() => roleMutation.mutate({ id: person.id, role: "waiter" })}
                          loading={roleMutation.isPending}
                        >
                          Demote to waiter
                        </Button>
                      )}
                      {canManage(user.role, person.role) && person.isActive &&
                        (resettingId === person.id ? (
                          <form onSubmit={(e) => handleResetSubmit(e, person.id)} className="flex items-center gap-1.5 animate-scale-in">
                            <input
                              autoFocus
                              type="text"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="new password"
                              minLength={8}
                              required
                              className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <Button type="submit" size="sm" loading={resetPasswordMutation.isPending}>
                              Set
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                setResettingId(null);
                                setNewPassword("");
                              }}
                              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <Button variant="secondaryDark" size="sm" onClick={() => setResettingId(person.id)}>
                            Reset password
                          </Button>
                        ))}
                      {canManage(user.role, person.role) && person.id !== user.id && (
                        person.isActive ? (
                          confirmingDeactivateId === person.id ? (
                            <div className="flex items-center gap-1.5 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs animate-scale-in">
                              <span className="text-red-300">Deactivate {person.name}?</span>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => deactivateMutation.mutate(person.id)}
                                loading={deactivateMutation.isPending}
                              >
                                Yes, deactivate
                              </Button>
                              <button
                                onClick={() => setConfirmingDeactivateId(null)}
                                className="px-1 text-zinc-400 transition-colors hover:text-zinc-200"
                              >
                                Never mind
                              </button>
                            </div>
                          ) : (
                            <Button
                              variant="secondaryDark"
                              size="sm"
                              className="hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                              onClick={() => setConfirmingDeactivateId(person.id)}
                            >
                              <ArchiveIcon width="14" height="14" />
                              Deactivate
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="secondaryDark"
                            size="sm"
                            className="hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                            onClick={() => reactivateMutation.mutate(person.id)}
                            loading={reactivateMutation.isPending}
                          >
                            <RestoreIcon width="14" height="14" />
                            Reactivate
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </DarkPanelCard>
      )}

      {justCreated && (
        <DarkCard className="mt-6 max-w-2xl border-emerald-400/30 bg-emerald-500/10 animate-fade-in-fast">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-emerald-200">Account created — copy this now</h2>
            <button
              onClick={() => setJustCreated(null)}
              className="text-xs text-emerald-300 transition-colors hover:text-emerald-100"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-xs text-emerald-300/80">
            This password won't be shown again. Share it with {justCreated.name} directly, then have
            them log in and it's safe to lose track of it — if it does get lost before you share it,
            just reset their password again from the list above.
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-emerald-300">Name</dt>
              <dd className="text-emerald-50">{justCreated.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-emerald-300">Email</dt>
              <dd className="text-emerald-50">{justCreated.email}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-emerald-300">Password</dt>
              <dd className="font-mono text-emerald-50">{justCreated.password}</dd>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-white/5 px-2 py-0.5 text-xs text-emerald-200 transition-colors hover:bg-emerald-500/20"
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
        </DarkCard>
      )}

      <DarkCard as="form" onSubmit={handleCreate} className="mt-6 flex max-w-2xl flex-wrap items-end gap-3">
        <Input
          label="Name"
          labelClassName="text-zinc-300"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          containerClassName="min-w-[9rem] flex-1"
        />
        <Input
          label="Email"
          labelClassName="text-zinc-300"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          containerClassName="min-w-[11rem] flex-1"
        />
        <Input
          label="Initial password"
          labelClassName="text-zinc-300"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="share this with them"
          containerClassName="min-w-[9rem] flex-1"
        />
        <div className="w-full sm:w-36">
          {isAdmin ? (
            <Select label="Role" labelClassName="text-zinc-300" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="waiter">Waiter</option>
              <option value="manager">Manager</option>
            </Select>
          ) : (
            <Input label="Role" labelClassName="text-zinc-300" disabled value="Waiter" />
          )}
        </div>
        <Button type="submit" loading={createMutation.isPending}>
          <PlusIcon />
          Add account
        </Button>
      </DarkCard>
      <ErrorMessage error={createMutation.error} className="mt-2" />
    </div>
  );
}
