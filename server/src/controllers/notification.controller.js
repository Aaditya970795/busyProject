import { prisma } from "../lib/prisma.js";

// Polled by the recipient's own browser every 30s (AppShell.jsx) — the closest thing this app has
// to a notification bell, without adding a push channel it doesn't otherwise need.
export async function listUnreadNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id, readAt: null },
    orderBy: { createdAt: "asc" },
  });

  return res.json({ notifications });
}

// Scoped to the caller's own id in the `where`, not just checked after loading — a notification
// belongs to exactly one person, and this doubles as the 404 check for one that isn't theirs.
export async function markNotificationRead(req, res) {
  const { id } = req.params;

  const result = await prisma.notification.updateMany({
    where: { id, userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return res.status(404).json({ error: "Notification not found" });
  }

  return res.json({ ok: true });
}
