// An order is "open" (voidable, still changeable, and still occupying its table) for as long
// as it hasn't reached one of the two terminal states. Shared between order.controller.js and
// table.controller.js so "is this table occupied" and "is this order still active" never drift
// out of sync with each other.
export const OPEN_STATUSES = new Set(["placed", "accepted", "preparing", "ready"]);
