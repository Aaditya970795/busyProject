import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { atLeast } from "../lib/roles.js";

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // The token only proves identity, not current role — role comes from a fresh database read
  // on every request, not the JWT's `role` claim. Otherwise a manager demoted to waiter (or a
  // deleted user) keeps acting on their old role/access for as long as their existing token is
  // valid (up to 7 days), since nothing about the token itself changes when the database does.
  // Same reasoning covers `isActive`: a deactivated waiter's existing session stops working on
  // its very next request, not just on their next login attempt.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  next();
}

// requireRole("manager") passes for a manager OR an admin — admin outranks manager and can do
// everything a manager can, on top of account management. requireRole("admin") passes for
// admin only. See lib/roles.js for the rank order.
export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user || !atLeast(req.user.role, minRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
