import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const COOKIE_NAME = "token";
const TOKEN_TTL = "7d";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Locally, client and server share an origin (Vite proxies /api to localhost:4000), so a Lax,
// non-secure cookie works fine. In production, the client (Vercel) and this API (Render) are on
// two genuinely different domains and the client calls this API's absolute URL directly (see
// client/src/lib/api.js's VITE_API_BASE_URL) — that's a cross-site request from the browser's
// point of view. A Lax cookie is never attached to a cross-site fetch/XHR, only to a top-level
// navigation, so login would silently "succeed" (200 back, cookie set) and then every subsequent
// request would look logged-out. SameSite=None is the only value that gets a cookie sent on a
// cross-site request — and browsers require Secure whenever SameSite=None is used, which is why
// this is one flag, not two independent ones.
const isProd = process.env.NODE_ENV === "production";
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  path: "/",
};

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...AUTH_COOKIE_OPTIONS, maxAge: TOKEN_TTL_MS });
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

  // Checked only after the password already matched — a wrong password always gets the same
  // generic "Invalid email or password" regardless of active status, so a guess can't be used to
  // probe whether a given email belongs to a deactivated account.
  if (!user.isActive) {
    return res.status(403).json({ error: "This account has been deactivated. Contact your manager or admin." });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
  setAuthCookie(res, token);

  return res.json({ user: toPublicUser(user) });
}

export function logout(req, res) {
  // Must match sameSite/secure from setAuthCookie — some browsers only clear a cookie when the
  // clearing response's attributes match the ones it was originally set with.
  res.clearCookie(COOKIE_NAME, AUTH_COOKIE_OPTIONS);
  return res.status(200).json({ ok: true });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return res.json({ user: toPublicUser(user) });
}
