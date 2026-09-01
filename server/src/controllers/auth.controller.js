import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const COOKIE_NAME = "token";
const TOKEN_TTL = "7d";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// There's no public registration endpoint at all — every account is created by an admin or a
// manager (see POST /api/users in user.controller.js), never self-service. A stranger who finds
// this API shouldn't be able to create even a waiter account, let alone anything higher.

export async function login(req, res) {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
  setAuthCookie(res, token);

  return res.json({ user: toPublicUser(user) });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.status(200).json({ ok: true });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return res.json({ user: toPublicUser(user) });
}
