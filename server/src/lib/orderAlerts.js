// Read once at call time (not module load) so a changed env var takes effect without a restart
// being the only thing that matters here — in practice these only ever change via a real
// deploy/restart, but there's no reason to lock the value in earlier than necessary.
function slowOrderMinutes() {
  return Number(process.env.SLOW_ORDER_MINUTES) || 15;
}

function alertReappearMinutes() {
  return Number(process.env.ALERT_REAPPEAR_MINUTES) || 10;
}

// A second, more urgent tier on top of "alerting at all" — an order twice as overdue as the base
// threshold shouldn't look identical to one that just crossed it. Independent env var (not a
// multiplier on SLOW_ORDER_MINUTES) so it can be tuned on its own.
function criticalOrderMinutes() {
  return Number(process.env.CRITICAL_ORDER_MINUTES) || 30;
}

// Past this point nobody's coming back to it — see lib/autoClearSweep.js, which cancels a
// placed/accepted order left this long with no action, freeing its table automatically.
function autoClearMinutes() {
  return Number(process.env.AUTO_CLEAR_MINUTES) || 45;
}

// Handed to the frontend so its copy ("open over 15 minutes...") always matches the real
// configured values instead of a number hard-coded into the UI that can drift from `.env`.
export function alertThresholds() {
  return {
    slowOrderMinutes: slowOrderMinutes(),
    alertReappearMinutes: alertReappearMinutes(),
    criticalOrderMinutes: criticalOrderMinutes(),
    autoClearMinutes: autoClearMinutes(),
  };
}

export { autoClearMinutes };

// The Prisma `where` fragment for "this order is currently alerting": open longer than
// SLOW_ORDER_MINUTES and not Ready yet, and either never acknowledged or acknowledged long enough
// ago that ALERT_REAPPEAR_MINUTES has since passed. Both cutoffs are computed once in JS and
// handed to Postgres as plain timestamp comparisons — the filtering itself still happens in the
// database, not by fetching every open order into JS.
export function alertingWhere() {
  const slowCutoff = new Date(Date.now() - slowOrderMinutes() * 60 * 1000);
  const reappearCutoff = new Date(Date.now() - alertReappearMinutes() * 60 * 1000);

  return {
    status: { notIn: ["ready", "served", "cancelled"] },
    createdAt: { lt: slowCutoff },
    OR: [{ alertAcknowledgedAt: null }, { alertAcknowledgedAt: { lt: reappearCutoff } }],
  };
}
