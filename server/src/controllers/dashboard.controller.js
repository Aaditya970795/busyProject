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

  const [openOrders, placedToday, servedTodayOrders, byStatusRaw, byWaiterRaw] = await Promise.all([
    prisma.order.count({ where: { isArchived: false, status: { in: [...OPEN_STATUSES] } } }),
    prisma.order.count({ where: { isArchived: false, createdAt: { gte: todayStart, lt: todayEnd } } }),
    // Known limitation: there's no status-change-events table yet (that's later timeline work,
    // not built), so "served today" is approximated as "currently served, and last updated
    // today." updatedAt also moves on archive/unarchive, so an order served yesterday that gets
    // archived-then-unarchived today would be miscounted as served today — an acceptable, rare
    // edge case for now, but worth fixing for real once a proper event log exists.
    prisma.order.findMany({
      where: { isArchived: false, status: "served", updatedAt: { gte: todayStart, lt: todayEnd } },
      include: { lines: { include: { menuItem: { select: { name: true } } } } },
    }),
    prisma.order.groupBy({ by: ["status"], where: { isArchived: false }, _count: true }),
    prisma.order.groupBy({ by: ["primaryWaiterId"], where: { isArchived: false }, _count: true }),
  ]);

  const servedToday = servedTodayOrders.length;
  const activeLinesToday = servedTodayOrders.flatMap((order) => order.lines).filter((line) => line.status === "active");
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
  // option, and it keeps this endpoint free of raw SQL entirely.
  const windowStart = new Date(todayStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - (SERVED_PER_DAY_WINDOW - 1));

  const recentServed = await prisma.order.findMany({
    where: { isArchived: false, status: "served", updatedAt: { gte: windowStart, lt: todayEnd } },
    select: { updatedAt: true, lines: { where: { status: "active" }, select: { unitPrice: true, quantity: true } } },
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
  for (const order of recentServed) {
    const bucket = bucketByDate.get(order.updatedAt.toISOString().slice(0, 10));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.revenue = bucket.revenue.plus(sumLines(order.lines));
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
