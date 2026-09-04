import { prisma } from "../lib/prisma.js";
import { OPEN_STATUSES } from "../lib/orderStatus.js";
import { Prisma } from "../../generated/prisma/client.ts";

const ALL_STATUSES = ["placed", "accepted", "preparing", "ready", "served", "cancelled"];
const SERVED_PER_DAY_WINDOW = 14;
const TOP_ITEMS_LIMIT = 5;

// Expects lines already scoped to active-only (either via a `where: { status: "active" }` on the
// Prisma query, or pre-filtered in JS) — it doesn't re-check status itself, since some callers
// select just `unitPrice`/`quantity` and never fetch `status` in the first place.
function sumLines(lines) {
  return lines.reduce((sum, line) => sum.plus(line.unitPrice.times(line.quantity)), new Prisma.Decimal(0));
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getSummary(req, res) {
  const todayStart = startOfUtcDay(new Date());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [openOrders, placedToday, servedTodayEvents, byStatusRaw, byWaiterRaw] = await Promise.all([
    prisma.order.count({
      where: { isArchived: false, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.order.count({
      where: { isArchived: false, deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    // "Served today" now comes from the OrderEvent audit trail added for the timeline feature,
    // instead of approximating it from `orders.updatedAt` (which also moves on archive/unarchive
    // and could miscount a day-old order as served today). `served` is a terminal status — an
    // order can only ever get one status_change event with `newValue: "served"` — so this is
    // exactly "when did this order actually become served," not an approximation.
    prisma.orderEvent.findMany({
      where: {
        eventType: "status_change",
        newValue: "served",
        createdAt: { gte: todayStart, lt: todayEnd },
        order: { isArchived: false, deletedAt: null },
      },
      include: { order: { include: { lines: { include: { menuItem: { select: { name: true } } } } } } },
    }),
    prisma.order.groupBy({ by: ["status"], where: { isArchived: false, deletedAt: null }, _count: true }),
    prisma.order.groupBy({
      by: ["primaryWaiterId"],
      where: { isArchived: false, deletedAt: null },
      _count: true,
    }),
  ]);

  const servedToday = servedTodayEvents.length;
  const activeLinesToday = servedTodayEvents
    .flatMap((event) => event.order.lines)
    .filter((line) => line.status === "active");
  // Same exact-math pattern as computeTotal() in order.controller.js, scoped to today's served
  // orders' active lines only, instead of fetching every order to sum in JS.
  const revenueTodayDecimal = activeLinesToday.reduce(
    (sum, line) => sum.plus(line.unitPrice.times(line.quantity)),
    new Prisma.Decimal(0)
  );
  const revenueToday = revenueTodayDecimal.toFixed(2);
  const avgOrderValueToday = servedToday > 0 ? revenueTodayDecimal.dividedBy(servedToday).toFixed(2) : "0.00";

  // What's actually selling today — grouped in JS from the same lines already fetched above,
  // not a separate query.
  const itemTotals = new Map();
  for (const line of activeLinesToday) {
    const existing = itemTotals.get(line.menuItemId) ?? {
      menuItemId: line.menuItemId,
      name: line.menuItem.name,
      quantity: 0,
      revenue: new Prisma.Decimal(0),
    };
    existing.quantity += line.quantity;
    existing.revenue = existing.revenue.plus(line.unitPrice.times(line.quantity));
    itemTotals.set(line.menuItemId, existing);
  }
  const topItemsToday = [...itemTotals.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, TOP_ITEMS_LIMIT)
    .map((item) => ({ ...item, revenue: item.revenue.toFixed(2) }));

  const countByStatus = new Map(byStatusRaw.map((row) => [row.status, row._count]));
  const byStatus = ALL_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));

  const waiters = await prisma.user.findMany({
    where: { id: { in: byWaiterRaw.map((row) => row.primaryWaiterId) } },
    select: { id: true, name: true },
  });
  const waiterNameById = new Map(waiters.map((w) => [w.id, w.name]));
  const byWaiter = byWaiterRaw
    .map((row) => ({
      waiterId: row.primaryWaiterId,
      waiterName: waiterNameById.get(row.primaryWaiterId) ?? "Unknown",
      count: row._count,
    }))
    .sort((a, b) => b.count - a.count);

  // servedPerDay: one query for the whole window, bucketed by day in JS, rather than either raw
  // SQL with date_trunc or 14 separate count() round trips — this data is small enough (at most
  // a few weeks of served orders) that fetching once and grouping in JS is the simplest correct
  // option, and it keeps this endpoint free of raw SQL entirely. Bucketed by the status_change
  // event's own `createdAt` — the moment the order actually became served — not `orders.updatedAt`,
  // for the same reason as `servedToday` above.
  const windowStart = new Date(todayStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - (SERVED_PER_DAY_WINDOW - 1));

  const recentServedEvents = await prisma.orderEvent.findMany({
    where: {
      eventType: "status_change",
      newValue: "served",
      createdAt: { gte: windowStart, lt: todayEnd },
      order: { isArchived: false, deletedAt: null },
    },
    select: {
      createdAt: true,
      order: { select: { lines: { where: { status: "active" }, select: { unitPrice: true, quantity: true } } } },
    },
  });

  const servedPerDay = [];
  const bucketByDate = new Map();
  for (let i = 0; i < SERVED_PER_DAY_WINDOW; i++) {
    const day = new Date(windowStart);
    day.setUTCDate(day.getUTCDate() + i);
    const bucket = { date: day.toISOString().slice(0, 10), count: 0, revenue: new Prisma.Decimal(0) };
    bucketByDate.set(bucket.date, bucket);
    servedPerDay.push(bucket);
  }
  for (const event of recentServedEvents) {
    const bucket = bucketByDate.get(event.createdAt.toISOString().slice(0, 10));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.revenue = bucket.revenue.plus(sumLines(event.order.lines));
  }
  for (const bucket of servedPerDay) {
    bucket.revenue = bucket.revenue.toFixed(2);
  }

  return res.json({
    openOrders,
    placedToday,
    servedToday,
    revenueToday,
    avgOrderValueToday,
    topItemsToday,
    byStatus,
    byWaiter,
    servedPerDay,
  });
}
