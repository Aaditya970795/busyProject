import { prisma } from "../lib/prisma.js";
import { OPEN_STATUSES } from "../lib/orderStatus.js";

async function getOccupiedTableNumbers() {
  const openOrders = await prisma.order.findMany({
    where: { isArchived: false, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
    select: { tableNumber: true },
  });
  return new Set(openOrders.map((order) => order.tableNumber));
}

export async function list(req, res) {
  const includeArchived = req.query.include_archived === "true";
  const onlyAvailable = req.query.available === "true";

  const tables = await prisma.table.findMany({
    where: includeArchived ? {} : { isArchived: false },
    orderBy: { number: "asc" },
  });

  const occupiedNumbers = await getOccupiedTableNumbers();
  const withStatus = tables.map((table) => ({ ...table, isOccupied: occupiedNumbers.has(table.number) }));

  return res.json({ tables: onlyAvailable ? withStatus.filter((table) => !table.isOccupied) : withStatus });
}

export async function create(req, res) {
  const { number } = req.body ?? {};

  if (!Number.isInteger(number) || number <= 0) {
    return res.status(400).json({ error: "number must be a positive integer" });
  }

  const existing = await prisma.table.findUnique({ where: { number } });
  if (existing && !existing.isArchived) {
    return res.status(409).json({ error: `Table ${number} already exists` });
  }

  // Re-adding a number that was previously removed restores the same row instead of creating
  // a second one, since `number` is unique — this keeps the table's history (and the unique
  // constraint) intact rather than erroring on a number the manager clearly wants back.
  try {
    const table = existing
      ? await prisma.table.update({ where: { number }, data: { isArchived: false } })
      : await prisma.table.create({ data: { number } });

    return res.status(existing ? 200 : 201).json({ table });
  } catch (err) {
    // Two managers adding the same new table number at the same instant can both pass the
    // `existing` check above before either commits — the database's own unique constraint on
    // `number` is what actually prevents the duplicate; this just turns that into the same
    // clean 409 instead of an unhandled 500.
    if (err.code === "P2002") {
      return res.status(409).json({ error: `Table ${number} already exists` });
    }
    throw err;
  }
}

async function setArchived(req, res, isArchived) {
  const { id } = req.params;

  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) {
    return res.status(404).json({ error: "Table not found" });
  }

  // Only removing a table needs this check — restoring one is always safe. A waiter could be
  // mid-order on this table right now (placed/accepted/preparing/ready); pulling the table out
  // from under them wouldn't cancel or affect their order (Order.tableNumber isn't a real foreign
  // key — see decision #17), but it would strand it: gone from the table picker, invisible to the
  // occupancy check, yet still fully active. A table can only be removed once it's free — the
  // order on it has to reach Served/Cancelled (or be deleted, while still eligible) first.
  if (isArchived) {
    const occupiedNumbers = await getOccupiedTableNumbers();
    if (occupiedNumbers.has(table.number)) {
      return res.status(400).json({
        error: `Table ${table.number} has an order in progress and can't be removed yet — it'll free up once that order is served or cancelled.`,
      });
    }
  }

  const updated = await prisma.table.update({ where: { id }, data: { isArchived } });
  return res.json({ table: updated });
}

export function archive(req, res) {
  return setArchived(req, res, true);
}

export function unarchive(req, res) {
  return setArchived(req, res, false);
}
