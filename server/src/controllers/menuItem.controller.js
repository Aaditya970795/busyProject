import { prisma } from "../lib/prisma.js";

function isValidPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function list(req, res) {
  const includeArchived = req.query.include_archived === "true";
  const menuItems = await prisma.menuItem.findMany({
    where: includeArchived ? {} : { isArchived: false },
    orderBy: { name: "asc" },
  });
  return res.json({ menuItems });
}

export async function create(req, res) {
  const { name, price, is_available } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!isValidPrice(price)) {
    return res.status(400).json({ error: "price must be a number >= 0" });
  }
  if (is_available !== undefined && typeof is_available !== "boolean") {
    return res.status(400).json({ error: "is_available must be a boolean" });
  }

  const menuItem = await prisma.menuItem.create({
    data: {
      name: name.trim(),
      price,
      isAvailable: is_available ?? true,
    },
  });

  return res.status(201).json({ menuItem });
}

export async function update(req, res) {
  const { id } = req.params;
  const { name, price, is_available } = req.body ?? {};

  const data = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }
    data.name = name.trim();
  }
  if (price !== undefined) {
    if (!isValidPrice(price)) {
      return res.status(400).json({ error: "price must be a number >= 0" });
    }
    data.price = price;
  }
  if (is_available !== undefined) {
    if (typeof is_available !== "boolean") {
      return res.status(400).json({ error: "is_available must be a boolean" });
    }
    data.isAvailable = is_available;
  }

  try {
    const menuItem = await prisma.menuItem.update({ where: { id }, data });
    return res.json({ menuItem });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Menu item not found" });
    }
    throw err;
  }
}

export async function bulkUpdate(req, res) {
  const { ids, changes } = req.body ?? {};

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && id)) {
    return res.status(400).json({ error: "ids must be a non-empty array of menu item ids" });
  }
  if (typeof changes !== "object" || changes === null || Array.isArray(changes)) {
    return res.status(400).json({ error: "changes is required" });
  }
  if (changes.price === undefined && changes.is_available === undefined) {
    return res.status(400).json({ error: "changes must include price and/or is_available" });
  }
  if (changes.price !== undefined && typeof changes.price !== "number") {
    return res.status(400).json({ error: "price must be a number" });
  }
  if (changes.is_available !== undefined && typeof changes.is_available !== "boolean") {
    return res.status(400).json({ error: "is_available must be a boolean" });
  }

  // Each id is validated and updated independently, in its own try/catch, rather than one
  // prisma.$transaction covering the whole batch — a $transaction would roll every item back
  // the moment one fails, but the actual requirement is partial success: report per item what
  // happened instead of failing the whole batch over one bad id.
  const results = [];
  for (const id of ids) {
    if (changes.price !== undefined && !isValidPrice(changes.price)) {
      results.push({ id, status: "rejected", reason: "price must be a number >= 0" });
      continue;
    }

    const data = {};
    if (changes.price !== undefined) data.price = changes.price;
    if (changes.is_available !== undefined) data.isAvailable = changes.is_available;

    try {
      await prisma.menuItem.update({ where: { id }, data });
      results.push({ id, status: "ok" });
    } catch (err) {
      if (err.code === "P2025") {
        results.push({ id, status: "rejected", reason: "Menu item not found" });
      } else {
        throw err;
      }
    }
  }

  return res.json({ results });
}

async function setArchived(req, res, isArchived) {
  const { id } = req.params;
  try {
    const menuItem = await prisma.menuItem.update({ where: { id }, data: { isArchived } });
    return res.json({ menuItem });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Menu item not found" });
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
