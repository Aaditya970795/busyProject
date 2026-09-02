// The one place that writes to OrderEvent. Every call site passes an already-open transaction
// (`tx`) so the mutation being audited and its event row commit or fail together — never two
// separate statements that could drift apart if one succeeds and the other doesn't.
//
// Hard rule: nothing in this app ever calls `prisma.orderEvent.update` or
// `.delete`/`.deleteMany`. An audit trail that can be edited after the fact isn't an audit trail.
export function logEvent(tx, { orderId, eventType, oldValue, newValue, actorId, note }) {
  return tx.orderEvent.create({
    data: {
      orderId,
      eventType,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      actorId,
      note: note ?? null,
    },
  });
}
