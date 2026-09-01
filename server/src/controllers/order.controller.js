import { prisma } from "../lib/prisma.js";
import { canActOnOrder, orderInvolvesWaiter } from "../lib/orderAccess.js";
import { OPEN_STATUSES } from "../lib/orderStatus.js";
import { Prisma } from "../../generated/prisma/client.ts";
import { toCsv } from "../lib/csv.js";
import { atLeast } from "../lib/roles.js";

const WAITER_PUBLIC_SELECT = { id: true, name: true, email: true, role: true };
const SORT_FIELDS = { placed: "createdAt", status: "status", table: "tableNumber" };
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Thrown inside the createOrder transaction to bail out with a clean 409 instead of letting the
// generic error handler treat "the table is genuinely occupied" as an unexpected server error.
class TableOccupiedError extends Error {
  constructor(tableNumber) {
    super(`Table ${tableNumber} is currently occupied`);
    this.tableNumber = tableNumber;
  }
}

function computeTotal(lines) {
  return lines
    .filter((line) => line.status === "active")
    .reduce((sum, line) => sum.plus(line.unitPrice.times(line.quantity)), new Prisma.Decimal(0))
    .toFixed(2);
}

const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "served", "cancelled"];

// Explicit map of "current status" -> the set of statuses it's legal to move to next.
//
// The brief's own example ("don't allow skipping straight from Placed to Ready") settles the
// ambiguous case: the lifecycle only advances one step at a time
// (placed -> accepted -> preparing -> ready -> served), never skipping ahead and never moving
// backward. Cancellation is only legal while the order hasn't started being prepared yet
// (placed or accepted) — once it's preparing or beyond, `cancelled` is off the table for good.
// `served` and `cancelled` are both terminal: nothing is legal from either.
const ALLOWED_TRANSITIONS = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

// Returns null if the transition is legal, or a human-readable reason it isn't.
function describeIllegalTransition(currentStatus, requestedStatus) {
  if (!ORDER_STATUSES.includes(requestedStatus)) {
    return `"${requestedStatus}" is not a valid order status.`;
  }
  if (ALLOWED_TRANSITIONS[currentStatus].includes(requestedStatus)) {
    return null;
  }
  if (currentStatus === requestedStatus) {
    return `Order is already ${currentStatus}.`;
  }
  if (!OPEN_STATUSES.has(currentStatus)) {
    return `Cannot change status: the order is already ${currentStatus}, which is final.`;
  }
  if (requestedStatus === "cancelled") {
    return `Cannot cancel an order that is already ${currentStatus} — cancellation is only allowed while an order is placed or accepted.`;
  }
  return `Cannot move an order from ${currentStatus} to ${requestedStatus} — status can only advance one step at a time.`;
}

export async function createOrder(req, res) {
  const { table_number, menu_item_id, quantity, special_instructions } = req.body ?? {};

  if (!Number.isInteger(table_number) || table_number <= 0) {
    return res.status(400).json({ error: "table_number must be a positive integer" });
  }
  // An order with no items on it isn't a real order — require the first item up front instead
  // of allowing an empty shell to be created and left sitting there. Further items still go
  // through the normal POST /:id/lines route once the order exists.
  if (typeof menu_item_id !== "string" || !menu_item_id) {
    return res.status(400).json({ error: "menu_item_id is required — an order needs at least one item" });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "quantity must be a positive integer" });
  }
  if (special_instructions !== undefined && typeof special_instructions !== "string") {
    return res.status(400).json({ error: "special_instructions must be a string" });
  }

  // Waiters pick a table from the manager-maintained list (see table.controller.js) rather
  // than typing a number, but that's only a UI convenience — re-validate here so a request
  // that bypasses the picker can't open an order on a table that doesn't exist or is already
  // in use.
  const table = await prisma.table.findUnique({ where: { number: table_number } });
  if (!table || table.isArchived) {
    return res.status(400).json({ error: `Table ${table_number} does not exist` });
  }

  const menuItem = await prisma.menuItem.findUnique({ where: { id: menu_item_id } });
  if (!menuItem) {
    return res.status(404).json({ error: "Menu item not found" });
  }

  // The occupancy check and the create used to be two separate, unlocked statements — two
  // requests for the same table arriving close enough together could both pass the check
  // before either committed, double-booking the table. Serializable isolation makes Postgres
  // detect that overlap: whichever transaction commits second gets a P2034 write-conflict
  // error instead of silently succeeding, and gets told to retry.
  try {
    const order = await prisma.$transaction(
      async (tx) => {
        const occupyingOrder = await tx.order.findFirst({
          where: { tableNumber: table_number, isArchived: false, status: { in: [...OPEN_STATUSES] } },
        });
        if (occupyingOrder) {
          throw new TableOccupiedError(table_number);
        }

        // The order and its first line are created together in one nested write so the two
        // can never land as separate statements — either both exist or neither does.
        return tx.order.create({
          data: {
            tableNumber: table_number,
            primaryWaiterId: req.user.id,
            lines: {
              create: [
                {
                  menuItemId: menu_item_id,
                  quantity,
                  specialInstructions: special_instructions?.trim() || null,
                  unitPrice: menuItem.price,
                },
              ],
            },
          },
          include: { lines: { include: { menuItem: true } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return res.status(201).json({ order });
  } catch (err) {
    if (err instanceof TableOccupiedError) {
      return res.status(409).json({ error: `Table ${table_number} is currently occupied` });
    }
    // A Postgres serialization failure (SQLSTATE 40001) is how the two-concurrent-requests
    // case actually surfaces with the @prisma/adapter-pg driver this project uses — as a
    // DriverAdapterError, not the P2034 code Prisma's own docs describe for its default
    // engine. Checking the raw SQLSTATE is what's actually portable here.
    if (err.code === "P2034" || err.cause?.originalCode === "40001") {
      return res
        .status(409)
        .json({ error: `Table ${table_number} was just taken by another order — please try again` });
    }
    throw err;
  }
}

// Builds the list of order ids whose table number contains `search` as a substring. tableNumber
// is an Int, and Prisma's `contains` filter only works on string columns, so a partial text match
// against it can't be expressed as a plain `where` clause. Rather than drop the whole query to raw
// SQL, this isolates the raw SQL to just this one lookup (using Prisma's tagged-template
// `$queryRaw`, which parameterizes `search` safely — never string-concatenated) and feeds the
// resulting ids back into a normal `where: { id: { in: [...] } }`, so every other filter, the
// sort, the pagination, and the count stay ordinary Prisma query-builder code.
async function findOrderIdsByTableNumber(search) {
  const rows = await prisma.$queryRaw`SELECT "id" FROM "Order" WHERE "tableNumber"::text ILIKE ${`%${search}%`}`;
  return rows.map((row) => row.id);
}

export async function listOrders(req, res) {
  const { search, status, waiter, date, sort = "placed", dir = "desc" } = req.query;

  if (!(sort in SORT_FIELDS)) {
    return res.status(400).json({ error: `sort must be one of: ${Object.keys(SORT_FIELDS).join(", ")}` });
  }
  if (dir !== "asc" && dir !== "desc") {
    return res.status(400).json({ error: "dir must be 'asc' or 'desc'" });
  }
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(", ")}` });
  }

  const page = parseInt(req.query.page ?? "1", 10);
  const pageSize = parseInt(req.query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10);
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: "page must be a positive integer" });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return res.status(400).json({ error: `pageSize must be a positive integer up to ${MAX_PAGE_SIZE}` });
  }

  const and = [{ isArchived: false }];

  // Visibility: a manager (or admin) sees every order; a waiter only sees orders they're
  // attached to — the same rule listMyOrders uses (see orderInvolvesWaiter), just applied to
  // the caller instead of an arbitrary target, so this list can never return an order the
  // viewer couldn't otherwise see, no matter what filters they combine it with.
  if (!atLeast(req.user.role, "manager")) {
    and.push(orderInvolvesWaiter(req.user.id));
  }

  if (status !== undefined) {
    and.push({ status });
  }

  if (waiter !== undefined) {
    and.push(orderInvolvesWaiter(waiter));
  }

  if (date !== undefined) {
    const start = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date" });
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    and.push({ createdAt: { gte: start, lt: end } });
  }

  if (search !== undefined && search.trim() !== "") {
    and.push({ id: { in: await findOrderIdsByTableNumber(search.trim()) } });
  }

  const where = { AND: and };

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { primaryWaiter: { select: { id: true, name: true } } },
      orderBy: { [SORT_FIELDS[sort]]: dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({ data, total, page, pageSize });
}

// A waiter's own worklist: every order where they're the primary waiter or a collaborator.
// Exposed to every authenticated user rather than gated to waiters — a manager is never
// primary and can't be added as a collaborator (see addCollaborator), so this just comes back
// empty for them. Since `GET /orders` visibility now applies this exact same rule to a waiter's
// results, this route is redundant with an un-filtered `GET /orders` for a waiter — kept as-is
// since removing it wasn't asked for, but the frontend no longer has a separate use for it.
export async function listMyOrders(req, res) {
  const orders = await prisma.order.findMany({
    where: { isArchived: false, ...orderInvolvesWaiter(req.user.id) },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ orders });
}

const CSV_COLUMNS = [
  "order_id",
  "table_number",
  "order_status",
  "waiter",
  "placed_at",
  "menu_item",
  "quantity",
  "unit_price",
  "line_status",
  "void_reason",
  "order_total",
];

// One row per order line, with the order-level fields (id, table, status, waiter, placed time,
// total) repeated on every line's row — the simplest shape that still opens cleanly in a
// spreadsheet with one line item per row. An order with no lines yet still gets a single row
// (with the line-specific columns blank) so it isn't silently missing from the export.
function ordersToCsv(orders) {
  const rows = [];
  for (const order of orders) {
    const total = computeTotal(order.lines);
    const orderFields = [
      order.id,
      order.tableNumber,
      order.status,
      order.primaryWaiter.name,
      order.createdAt.toISOString(),
    ];

    if (order.lines.length === 0) {
      rows.push([...orderFields, "", "", "", "", "", total]);
      continue;
    }

    for (const line of order.lines) {
      rows.push([
        ...orderFields,
        line.menuItem.name,
        line.quantity,
        line.unitPrice.toFixed(2),
        line.status,
        line.voidReason ?? "",
        total,
      ]);
    }
  }
  return toCsv(CSV_COLUMNS, rows);
}

export async function exportOrders(req, res) {
  const { date } = req.query;

  if (typeof date !== "string" || !date) {
    return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
  }
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ error: "date must be a valid YYYY-MM-DD date" });
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  // Assumption: a waiter's export respects the same visibility as the order list (Task 6) —
  // they only get orders they're the primary waiter or a collaborator on for that day; a
  // manager gets every order placed that day, same as GET /orders.
  const where = {
    isArchived: false,
    createdAt: { gte: start, lt: end },
    ...(!atLeast(req.user.role, "manager") ? orderInvolvesWaiter(req.user.id) : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      lines: { include: { menuItem: true }, orderBy: { createdAt: "asc" } },
      primaryWaiter: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const csv = ordersToCsv(orders);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="orders-${date}.csv"`);
  return res.status(200).send(csv);
}

export async function getOrder(req, res) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { include: { menuItem: true }, orderBy: { createdAt: "asc" } },
      collaborators: { include: { waiter: { select: WAITER_PUBLIC_SELECT } }, orderBy: { addedAt: "asc" } },
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!(await canActOnOrder(req.user, order))) {
    return res.status(403).json({ error: "You do not have access to this order" });
  }

  return res.json({ order, total: computeTotal(order.lines) });
}

export async function addCollaborator(req, res) {
  const { id } = req.params;
  const { waiter_id } = req.body ?? {};

  if (typeof waiter_id !== "string" || !waiter_id) {
    return res.status(400).json({ error: "waiter_id is required" });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Assumption: the brief doesn't say who may attach collaborators, so this restricts it to
  // whoever is already accountable for the order — its primary waiter — or a manager. That
  // keeps a waiter from inserting themselves into someone else's order uninvited.
  if (!atLeast(req.user.role, "manager") && req.user.id !== order.primaryWaiterId) {
    return res.status(403).json({ error: "Only the primary waiter or a manager can add collaborators" });
  }

  if (waiter_id === order.primaryWaiterId) {
    return res.status(400).json({ error: "The primary waiter is already attached to this order" });
  }

  const waiter = await prisma.user.findUnique({ where: { id: waiter_id } });
  if (!waiter || waiter.role !== "waiter") {
    return res.status(404).json({ error: "Waiter not found" });
  }

  try {
    const collaborator = await prisma.orderCollaborator.create({
      data: { orderId: id, waiterId: waiter_id },
      include: { waiter: { select: WAITER_PUBLIC_SELECT } },
    });
    return res.status(201).json({ collaborator });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "This waiter is already a collaborator on this order" });
    }
    throw err;
  }
}

export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body ?? {};

  if (typeof status !== "string" || !status) {
    return res.status(400).json({ error: "status is required" });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!(await canActOnOrder(req.user, order))) {
    return res.status(403).json({ error: "You do not have access to this order" });
  }

  const rejectionReason = describeIllegalTransition(order.status, status);
  if (rejectionReason) {
    return res.status(400).json({ error: rejectionReason });
  }

  const updated = await prisma.order.update({ where: { id }, data: { status } });
  return res.json({ order: updated });
}

function mergeInstructions(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing === incoming) return existing;
  return `${existing}; ${incoming}`;
}

export async function addLine(req, res) {
  const { id } = req.params;
  const { menu_item_id, quantity, special_instructions } = req.body ?? {};

  if (typeof menu_item_id !== "string" || !menu_item_id) {
    return res.status(400).json({ error: "menu_item_id is required" });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "quantity must be a positive integer" });
  }
  if (special_instructions !== undefined && typeof special_instructions !== "string") {
    return res.status(400).json({ error: "special_instructions must be a string" });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!(await canActOnOrder(req.user, order))) {
    return res.status(403).json({ error: "You do not have access to this order" });
  }
  if (!OPEN_STATUSES.has(order.status)) {
    return res
      .status(400)
      .json({ error: `Cannot add items to an order that is already ${order.status}.` });
  }

  const menuItem = await prisma.menuItem.findUnique({ where: { id: menu_item_id } });
  if (!menuItem) {
    return res.status(404).json({ error: "Menu item not found" });
  }

  const trimmedInstructions = special_instructions?.trim() || null;

  // Same item, still active, still priced the way it was when it was first added to this
  // order — treat it as "more of the same" and bump the quantity instead of adding a
  // duplicate row. A price change on the menu item since the first add breaks the match on
  // purpose, so the two prices stay traceable as separate lines.
  const existingLine = await prisma.orderLine.findFirst({
    where: {
      orderId: id,
      menuItemId: menu_item_id,
      status: "active",
      unitPrice: menuItem.price,
    },
  });

  if (existingLine) {
    const orderLine = await prisma.orderLine.update({
      where: { id: existingLine.id },
      data: {
        quantity: existingLine.quantity + quantity,
        specialInstructions: mergeInstructions(existingLine.specialInstructions, trimmedInstructions),
      },
      include: { menuItem: true },
    });
    return res.status(200).json({ orderLine });
  }

  const orderLine = await prisma.orderLine.create({
    data: {
      orderId: id,
      menuItemId: menu_item_id,
      quantity,
      specialInstructions: trimmedInstructions,
      unitPrice: menuItem.price,
    },
    include: { menuItem: true },
  });

  return res.status(201).json({ orderLine });
}

export async function voidLine(req, res) {
  const { id, lineId } = req.params;
  const { reason } = req.body ?? {};

  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "reason is required to void a line" });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!(await canActOnOrder(req.user, order))) {
    return res.status(403).json({ error: "You do not have access to this order" });
  }
  if (!OPEN_STATUSES.has(order.status)) {
    return res
      .status(400)
      .json({ error: `Cannot void a line on an order that is already ${order.status}.` });
  }

  const line = await prisma.orderLine.findUnique({ where: { id: lineId } });
  if (!line || line.orderId !== id) {
    return res.status(404).json({ error: "Order line not found on this order" });
  }
  if (line.status === "void") {
    return res.status(400).json({ error: "This line has already been voided." });
  }

  const orderLine = await prisma.orderLine.update({
    where: { id: lineId },
    data: { status: "void", voidReason: reason.trim() },
    include: { menuItem: true },
  });

  return res.json({ orderLine });
}

async function setArchived(req, res, isArchived) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!(await canActOnOrder(req.user, order))) {
    return res.status(403).json({ error: "You do not have access to this order" });
  }

  const updated = await prisma.order.update({ where: { id }, data: { isArchived } });
  return res.json({ order: updated });
}

export function archiveOrder(req, res) {
  return setArchived(req, res, true);
}

export function unarchiveOrder(req, res) {
  return setArchived(req, res, false);
}

export async function deleteOrder(req, res) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (!(await canActOnOrder(req.user, order))) {
    return res.status(403).json({ error: "You do not have access to this order" });
  }

  // OrderLine.order and OrderCollaborator.order are both onDelete: Cascade, so this also
  // removes the order's lines and collaborator rows.
  await prisma.order.delete({ where: { id } });
  return res.status(204).send();
}
