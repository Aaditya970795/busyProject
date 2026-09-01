import { prisma } from "../lib/prisma.js";
import { OPEN_STATUSES } from "../lib/orderStatus.js";

async function getOccupiedTableNumbers() {
  const openOrders = await prisma.order.findMany({
    where: { isArchived: false, status: { in: [...OPEN_STATUSES] } },
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
  const table = existing
    ? await prisma.table.update({ where: { number }, data: { isArchived: false } })
    : await prisma.table.create({ data: { number } });

  return res.status(existing ? 200 : 201).json({ table });
}

async function setArchived(req, res, isArchived) {
  const { id } = req.params;
  try {
    const table = await prisma.table.update({ where: { id }, data: { isArchived } });
    return res.json({ table });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Table not found" });
    }
    throw err;
  }
}

export function archive(req, res) {
  return setArchived(req, res, true);
}

export function unarchive(req, res) {
  return setArchived(req, res, false);
}
