import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { atLeast, canManage } from "../lib/roles.js";

const SALT_ROUNDS = 10;
const ALL_ROLES = ["admin", "manager", "waiter"];
// Never assignable through the API, by anyone — the only admin account comes from a one-time
// script run directly against the database, so there's zero HTTP path to the top privilege tier.
const ASSIGNABLE_ROLES = ["manager", "waiter"];

export async function listUsers(req, res) {
  const { role } = req.query;

  if (role !== undefined && !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALL_ROLES.join(", ")}` });
  }

  // Every authenticated user can call this (it powers the collaborator picker and the "waiter"
  // filter dropdown, both of which only ever need id/name/role) — but a coworker's email is
  // more than those features need, so it's only included for a manager or admin.
  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    select: { id: true, name: true, email: atLeast(req.user.role, "manager"), role: true },
    orderBy: { name: "asc" },
  });

  return res.json({ users });
}

// The only way any account gets created — there's no public registration. A manager can create
// a waiter account; only an admin can create a manager account. The caller sets the initial
// password directly and hands it to the new hire, since the new account never self-registers.
export async function createUser(req, res) {
  const { name, email, password, role } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "email is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` });
  }
  if (!canManage(req.user.role, role)) {
    return res.status(403).json({ error: "Only an admin can create a manager account" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role },
      select: { id: true, name: true, email: true, role: true },
    });
    return res.status(201).json({ user });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email already registered" });
    }
    throw err;
  }
}

// The only way a role changes after an account exists — admin only. A manager can create a
// waiter account (above) but can't promote one to manager; that's an admin-only decision.
export async function updateRole(req, res) {
  const { id } = req.params;
  const { role } = req.body ?? {};

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.role === "manager" && role === "waiter") {
    const managerCount = await prisma.user.count({ where: { role: "manager" } });
    if (managerCount <= 1) {
      return res.status(400).json({ error: "Can't demote the last manager — promote someone else first" });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return res.json({ user: updated });
}

// Since there's no self-registration and no email infrastructure to send a reset link, "forgot
// password" is handled the same way the account was created in the first place: whoever has
// authority over that account sets a new password directly and hands it to the person. Same
// canManage rule as createUser — an admin can reset a manager's or waiter's password, a manager
// can reset only a waiter's, and nobody can reset an admin's this way (see the bootstrap script).
export async function resetPassword(req, res) {
  const { id } = req.params;
  const { new_password } = req.body ?? {};

  if (typeof new_password !== "string" || new_password.length < 8) {
    return res.status(400).json({ error: "new_password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!canManage(req.user.role, user.role)) {
    return res.status(403).json({ error: "You don't have permission to reset this account's password" });
  }

  const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return res.json({ ok: true });
}
