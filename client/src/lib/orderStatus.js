// Mirrors the server's transition rules (server/src/controllers/order.controller.js) just closely
// enough to decide which controls to show. UI convenience only — the server re-validates every
// transition itself and is the real source of truth. Shared between OrderDetailPage and AlertsPage
// so the two never disagree about which orders can be cancelled.
export const OPEN_STATUSES = new Set(["placed", "accepted", "preparing", "ready"]);
export const CANCELLABLE_STATUSES = new Set(["placed", "accepted"]);
