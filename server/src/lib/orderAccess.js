import { prisma } from "./prisma.js";

// The single source of truth for "can this user act on this order?" — a manager can act on
// anything, and a waiter can act only on orders they're the primary waiter for or have been
// added to as a collaborator. Every order-mutating route should call this (with the order
// already loaded) instead of re-deriving the rule itself.
export async function canActOnOrder(user, order) {
  if (user.role === "manager") return true;
  if (order.primaryWaiterId === user.id) return true;

  const collaborator = await prisma.orderCollaborator.findUnique({
    where: { orderId_waiterId: { orderId: order.id, waiterId: user.id } },
  });
  return Boolean(collaborator);
}
