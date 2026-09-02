import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { CANCELLABLE_STATUSES } from "../lib/orderStatus";
import { formatMinutes } from "../lib/format";
import { BellIcon, CheckIcon, ReceiptIcon, TrashIcon } from "../components/icons";

// Matches the badge in AppShell.jsx — both poll the same query key, so this page's list and the
// nav count never disagree with each other for more than one tick.
const ALERTS_POLL_INTERVAL_MS = 30 * 1000;

function minutesSince(isoString) {
  return Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
}

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [confirmingClearId, setConfirmingClearId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.get("/alerts"),
    refetchInterval: ALERTS_POLL_INTERVAL_MS,
  });

  const invalidateAlerts = () => queryClient.invalidateQueries({ queryKey: ["alerts"] });

  const acknowledgeMutation = useMutation({
    mutationFn: (orderId) => api.post(`/orders/${orderId}/acknowledge-alert`),
    onSuccess: invalidateAlerts,
  });

  // "Clear table" is just the existing cancel-order transition (Task 3) — same server-side rule
  // (only legal while placed/accepted), so an order already being prepared can't be clobbered from
  // this list any more than it could from the order-detail page.
  const clearMutation = useMutation({
    mutationFn: (orderId) => api.patch(`/orders/${orderId}/status`, { status: "cancelled" }),
    onSuccess: () => {
      invalidateAlerts();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setConfirmingClearId(null);
    },
  });

  const thresholds = data?.thresholds;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <BellIcon width="22" height="22" className="text-red-600" />
            Alerts
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {thresholds
              ? `Open over ${formatMinutes(thresholds.slowOrderMinutes)} without reaching Ready. Acknowledging snoozes it for ${formatMinutes(thresholds.alertReappearMinutes)} — it comes back if still not Ready by then. A placed/accepted order left untouched past ${formatMinutes(thresholds.autoClearMinutes)} is automatically cancelled and its table freed.`
              : "Orders open too long without reaching Ready."}
          </p>
        </div>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      {data && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {data.alerts.map((order) => {
              const openMinutes = minutesSince(order.createdAt);
              const isCritical = openMinutes >= thresholds.criticalOrderMinutes;
              const isRepeat = Boolean(order.alertAcknowledgedBy);
              const canClear = CANCELLABLE_STATUSES.has(order.status);
              // Only placed/accepted orders are ever auto-cleared (see lib/autoClearSweep.js on
              // the server) — a preparing order has no countdown, since it never auto-clears.
              const minutesUntilAutoClear = canClear ? thresholds.autoClearMinutes - openMinutes : null;

              return (
                <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Link
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-2 text-sm font-medium text-slate-800 transition-colors hover:text-indigo-700"
                  >
                    <ReceiptIcon width="14" height="14" className="text-indigo-600" />
                    Table {order.tableNumber}
                  </Link>
                  <StatusBadge status={order.status} />
                  <span className="text-xs text-slate-500">{order.primaryWaiter.name}</span>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isCritical ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {isCritical ? "Critical" : "Slow"} — open {formatMinutes(openMinutes)}
                  </span>

                  {isRepeat && (
                    <span
                      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      title={`Previously acknowledged by ${order.alertAcknowledgedBy.name}`}
                    >
                      Repeat — {order.alertAcknowledgedBy.name} acked {formatMinutes(minutesSince(order.alertAcknowledgedAt))} ago
                    </span>
                  )}

                  {minutesUntilAutoClear !== null && minutesUntilAutoClear <= 15 && (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                      {minutesUntilAutoClear <= 0
                        ? "Auto-clearing shortly…"
                        : `Auto-clears in ${formatMinutes(minutesUntilAutoClear)}`}
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => acknowledgeMutation.mutate(order.id)}
                      disabled={acknowledgeMutation.isPending}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                    >
                      <CheckIcon width="14" height="14" />
                      Acknowledge
                    </button>

                    {canClear ? (
                      confirmingClearId === order.id ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs">
                          <span className="text-red-700">Cancel & free table?</span>
                          <button
                            onClick={() => clearMutation.mutate(order.id)}
                            disabled={clearMutation.isPending}
                            className="rounded-md bg-red-600 px-2 py-0.5 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                          >
                            {clearMutation.isPending ? "Clearing…" : "Yes, clear"}
                          </button>
                          <button
                            onClick={() => setConfirmingClearId(null)}
                            className="px-1 text-slate-500 hover:text-slate-700"
                          >
                            Never mind
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingClearId(order.id)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        >
                          <TrashIcon width="14" height="14" />
                          Clear table
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">Already {order.status} — can't clear</span>
                    )}
                  </div>
                </div>
              );
            })}
            {data.alerts.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">
                Nothing alerting right now — every open order is moving along fine.
              </p>
            )}
          </div>
        </div>
      )}
      {acknowledgeMutation.error && (
        <p className="mt-2 text-sm text-red-600">{acknowledgeMutation.error.message}</p>
      )}
      {clearMutation.error && <p className="mt-2 text-sm text-red-600">{clearMutation.error.message}</p>}
    </div>
  );
}
