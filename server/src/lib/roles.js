// Role hierarchy: an admin can do everything a manager can, plus manage accounts; a manager
// outranks a waiter. Kept in one place so "does this role qualify as at-least-manager" is never
// re-derived ad hoc (and drifts) at each call site.
const ROLE_RANK = { waiter: 0, manager: 1, admin: 2 };

export function atLeast(role, minRole) {
  return (ROLE_RANK[role] ?? -1) >= ROLE_RANK[minRole];
}

// Can a user with `callerRole` manage an account that currently has (or would be given)
// `targetRole` — i.e. create it, change its role, or reset its password? An admin manages
// managers and waiters; a manager manages only waiters; nobody manages an admin through the
// API at all (see the one-time bootstrap script for how the sole admin account is ever set).
export function canManage(callerRole, targetRole) {
  if (targetRole === "admin") return false;
  if (callerRole === "admin") return true;
  return callerRole === "manager" && targetRole === "waiter";
}
