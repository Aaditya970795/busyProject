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
