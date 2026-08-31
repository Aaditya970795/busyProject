import { prisma } from "../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.ts";

function computeTotal(lines) {
  return lines
    .filter((line) => line.status === "active")
    .reduce((sum, line) => sum.plus(line.unitPrice.times(line.quantity)), new Prisma.Decimal(0))
    .toFixed(2);
}

export async function createOrder(req, res) {
  const { table_number } = req.body ?? {};

  if (!Number.isInteger(table_number) || table_number <= 0) {
    return res.status(400).json({ error: "table_number must be a positive integer" });
  }

  const order = await prisma.order.create({
    data: {
      tableNumber: table_number,
      primaryWaiterId: req.user.id,
    },
  });

  return res.status(201).json({ order });
}

export async function listOrders(req, res) {
  const orders = await prisma.order.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ orders });
}

export async function getOrder(req, res) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { include: { menuItem: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  return res.json({ order, total: computeTotal(order.lines) });
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

async function setArchived(req, res, isArchived) {
  const { id } = req.params;
  try {
    const order = await prisma.order.update({ where: { id }, data: { isArchived } });
    return res.json({ order });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    throw err;
  }
}

export function archiveOrder(req, res) {
  return setArchived(req, res, true);
}

export function unarchiveOrder(req, res) {
  return setArchived(req, res, false);
}

export async function deleteOrder(req, res) {
  const { id } = req.params;
  try {
    // OrderLine.order is onDelete: Cascade, so this also removes the order's lines.
    await prisma.order.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    throw err;
  }
}
