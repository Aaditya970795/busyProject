// Mirrors the server's role hierarchy (see server/src/lib/roles.js) — admin outranks manager,
// so anywhere a manager gets to do something, an admin should too.
export function isManagerOrAbove(role) {
  return role === "manager" || role === "admin";
}

export function isAdmin(role) {
  return role === "admin";
}

// Mirrors the server's canManage — can a user with `callerRole` manage (edit role, reset
// password) an account with `targetRole`? Used only to decide which controls to show; the
// server re-checks this on every request regardless.
export function canManage(callerRole, targetRole) {
  if (targetRole === "admin") return false;
  if (callerRole === "admin") return true;
  return callerRole === "manager" && targetRole === "waiter";
}
