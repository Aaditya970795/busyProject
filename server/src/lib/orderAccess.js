import { prisma } from "./prisma.js";
import { atLeast } from "./roles.js";

// The shape of "this waiter has a relationship to the order" — primary waiter or a listed
// collaborator — as a Prisma `where` fragment instead of a check against an already-loaded
// order. Used to build the visibility rule for order *lists* (a waiter only sees orders they're
// attached to; a manager sees everything) and to filter a list down to one specific waiter's
// orders, so that shape only lives in one place instead of being copy-pasted per query.
export function orderInvolvesWaiter(waiterId) {
  return { OR: [{ primaryWaiterId: waiterId }, { collaborators: { some: { waiterId } } }] };
}

// The single source of truth for "can this user act on this order?" — a manager can act on
// anything, and a waiter can act only on orders they're the primary waiter for or have been
// added to as a collaborator. Every order-mutating route should call this (with the order
// already loaded) instead of re-deriving the rule itself.
export async function canActOnOrder(user, order) {
  if (atLeast(user.role, "manager")) return true;
  if (order.primaryWaiterId === user.id) return true;

  const collaborator = await prisma.orderCollaborator.findUnique({
    where: { orderId_waiterId: { orderId: order.id, waiterId: user.id } },
  });
  return Boolean(collaborator);
}
