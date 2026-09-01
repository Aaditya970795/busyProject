import { prisma } from "../lib/prisma.js";

const VALID_ROLES = ["manager", "waiter"];

export async function listUsers(req, res) {
  const { role } = req.query;

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }

  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  return res.json({ users });
}
