import { prisma } from "./prisma.js";
import { logEvent } from "./orderEvents.js";
import { autoClearMinutes } from "./orderAlerts.js";

const SWEEP_INTERVAL_MS = 60 * 1000;

// Auto-clearing cancels the order rather than deleting it — same rule as the manual "Clear table"
// action (Task 3's cancel transition: only legal for placed/accepted), and for the same reason:
// cancelling frees the table immediately while keeping the order in the Task 13 audit trail.
// Deleting it would cascade-destroy that history, which defeats the point of having it.
//
// Deliberately scoped to placed/accepted only, never preparing — the kitchen has already started
// on a preparing order, so silently cancelling it would be wrong, not just against the rules a
// human is already blocked from doing this from the alerts page too (see AlertsPage.jsx). A
// preparing order stuck past every threshold keeps alerting at the critical tier until a person
// actually resolves it.
//
// Also scoped to orders nobody has ever acknowledged (`alertAcknowledgedAt: null`). Once a human
// acknowledges an alert they've taken responsibility for a customer who's actually there waiting —
// the timer shouldn't override that judgment call. An acknowledged order that's still stuck just
// keeps escalating to the critical severity tier (and shows as a "repeat" alert once it reappears)
// so it stays visible for a manager to act on manually, instead of getting yanked out from under
// a customer automatically.
export async function runAutoClearSweep() {
  const cutoff = new Date(Date.now() - autoClearMinutes() * 60 * 1000);

  const stuckOrders = await prisma.order.findMany({
    where: {
      isArchived: false,
      deletedAt: null,
      status: { in: ["placed", "accepted"] },
      createdAt: { lt: cutoff },
      alertAcknowledgedAt: null,
    },
    select: { id: true, status: true, tableNumber: true, primaryWaiterId: true },
  });

  for (const order of stuckOrders) {
    const message = `Your order for Table ${order.tableNumber} was automatically cancelled — open longer than ${autoClearMinutes()} minutes with no action taken.`;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
      await logEvent(tx, {
        orderId: order.id,
        eventType: "status_change",
        oldValue: order.status,
        newValue: "cancelled",
        actorId: null,
        note: `Open longer than ${autoClearMinutes()} minutes with no action taken.`,
      });
      await tx.notification.create({
        data: { userId: order.primaryWaiterId, orderId: order.id, message },
      });
    });
    console.log(
      `[auto-clear] Cancelled order ${order.id} (table ${order.tableNumber}, was "${order.status}") — ` +
        `open past the ${autoClearMinutes()}-minute limit, never acknowledged.`
    );
  }

  return stuckOrders.length;
}

// Started once at boot (see index.js). A plain interval instead of a real job queue — this app
// has no background-worker infrastructure, and one process checking once a minute is more than
// enough for how few orders are ever actually stuck this long.
export function startAutoClearSweep() {
  setInterval(() => {
    runAutoClearSweep().catch((err) => console.error("[auto-clear] sweep failed:", err));
  }, SWEEP_INTERVAL_MS);
}
