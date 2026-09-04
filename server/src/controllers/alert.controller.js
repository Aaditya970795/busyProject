import { prisma } from "../lib/prisma.js";
import { orderInvolvesWaiter } from "../lib/orderAccess.js";
import { alertingWhere, alertThresholds } from "../lib/orderAlerts.js";
import { atLeast } from "../lib/roles.js";

// Same visibility rule as GET /orders (Task 6): a manager sees every alerting order, a waiter
// only sees the ones they're the primary waiter or a collaborator on.
export async function listAlerts(req, res) {
  const and = [{ isArchived: false }, { deletedAt: null }, alertingWhere()];
  if (!atLeast(req.user.role, "manager")) {
    and.push(orderInvolvesWaiter(req.user.id));
  }

  const alerts = await prisma.order.findMany({
    where: { AND: and },
    include: {
      primaryWaiter: { select: { id: true, name: true } },
      // Present whenever this order alerted before, got acknowledged, and came back — lets the
      // UI flag a repeat alert differently from one nobody has looked at yet.
      alertAcknowledgedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return res.json({ alerts, count: alerts.length, thresholds: alertThresholds() });
}
