import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { CANCELLABLE_STATUSES } from "../lib/orderStatus";
import { formatMinutes } from "../lib/format";
import { BellIcon, CheckIcon, ReceiptIcon, TrashIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkPanelCard, DarkEmptyState } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Skeleton } from "../components/ui/Skeleton";

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
      <PageHeader
        icon={<BellIcon width="22" height="22" className="text-red-400" />}
        title="Alerts"
        subtitle={
          thresholds
            ? `Open over ${formatMinutes(thresholds.slowOrderMinutes)} without reaching Ready. Acknowledging snoozes it for ${formatMinutes(thresholds.alertReappearMinutes)} — it comes back if still not Ready by then. A placed/accepted order left untouched past ${formatMinutes(thresholds.autoClearMinutes)} is automatically cancelled and its table freed.`
            : "Orders open too long without reaching Ready."
        }
      />

      <ErrorMessage error={error} className="mt-6" />

      {isLoading && (
        <DarkPanelCard className="mt-5 divide-y divide-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-24 bg-white/10" />
              <Skeleton className="h-4 w-16 bg-white/10" />
              <Skeleton className="h-4 w-32 bg-white/10" />
            </div>
          ))}
        </DarkPanelCard>
      )}

      {data && (
        <DarkPanelCard className="mt-5 animate-fade-in">
          <div className="divide-y divide-white/5">
            {data.alerts.map((order) => {
              const openMinutes = minutesSince(order.createdAt);
              const isCritical = openMinutes >= thresholds.criticalOrderMinutes;
              const isRepeat = Boolean(order.alertAcknowledgedBy);
              const canClear = CANCELLABLE_STATUSES.has(order.status);
              // Only placed/accepted orders are ever auto-cleared (see lib/autoClearSweep.js on
              // the server) — a preparing order has no countdown, since it never auto-clears.
              const minutesUntilAutoClear = canClear ? thresholds.autoClearMinutes - openMinutes : null;

              return (
                <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5">
                  <Link
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-200 transition-colors hover:text-indigo-300"
                  >
                    <ReceiptIcon width="14" height="14" className="text-indigo-400" />
                    Table {order.tableNumber}
                  </Link>
                  <StatusBadge status={order.status} />
                  <span className="text-xs text-white">{order.primaryWaiter.name}</span>

                  <Badge tone={isCritical ? "red" : "amber"} className="normal-case">
                    {isCritical ? "Critical" : "Slow"} — open {formatMinutes(openMinutes)}
                  </Badge>

                  {isRepeat && (
                    <Badge
                      tone="slate"
                      className="normal-case"
                      title={`Previously acknowledged by ${order.alertAcknowledgedBy.name}`}
                    >
                      Repeat — {order.alertAcknowledgedBy.name} acked {formatMinutes(minutesSince(order.alertAcknowledgedAt))} ago
                    </Badge>
                  )}

                  {minutesUntilAutoClear !== null && minutesUntilAutoClear <= 15 && (
                    <Badge tone="red" className="normal-case">
                      {minutesUntilAutoClear <= 0
                        ? "Auto-clearing shortly…"
                        : `Auto-clears in ${formatMinutes(minutesUntilAutoClear)}`}
                    </Badge>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="secondaryDark"
                      size="sm"
                      className="hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                      onClick={() => acknowledgeMutation.mutate(order.id)}
                      loading={acknowledgeMutation.isPending}
                    >
                      <CheckIcon width="14" height="14" />
                      Acknowledge
                    </Button>

                    {canClear ? (
                      confirmingClearId === order.id ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs animate-scale-in">
                          <span className="text-red-300">Cancel & free table?</span>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => clearMutation.mutate(order.id)}
                            loading={clearMutation.isPending}
                          >
                            Yes, clear
                          </Button>
                          <button
                            onClick={() => setConfirmingClearId(null)}
                            className="px-1 text-zinc-400 transition-colors hover:text-zinc-200"
                          >
                            Never mind
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="secondaryDark"
                          size="sm"
                          className="hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => setConfirmingClearId(order.id)}
                        >
                          <TrashIcon width="14" height="14" />
                          Clear table
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-zinc-500">Already {order.status} — can't clear</span>
                    )}
                  </div>
                </div>
              );
            })}
            {data.alerts.length === 0 && (
              <DarkEmptyState title="Nothing alerting right now — every open order is moving along fine." />
            )}
          </div>
        </DarkPanelCard>
      )}
      <ErrorMessage error={acknowledgeMutation.error} className="mt-2" />
      <ErrorMessage error={clearMutation.error} className="mt-2" />
    </div>
  );
}
