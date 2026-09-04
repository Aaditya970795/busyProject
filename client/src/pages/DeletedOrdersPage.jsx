import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { ArchiveIcon, ReceiptIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkPanelCard, DarkEmptyState } from "../components/ui/DarkCard";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Skeleton } from "../components/ui/Skeleton";

// Deleted orders are never actually removed from the database (see decision #76 and
// server/src/controllers/order.controller.js's deleteOrder) — this page is where that history
// stays reachable: what was ordered, its full timeline, who deleted it and when. Same visibility
// rule as every other order list (a manager sees every deleted order, a waiter only sees ones they
// were the primary waiter or a collaborator on).
export function DeletedOrdersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", "deleted"],
    queryFn: () => api.get("/orders/deleted"),
  });

  return (
    <div>
      <PageHeader
        icon={<ArchiveIcon width="22" height="22" className="text-zinc-400" />}
        title="Deleted orders"
        subtitle="Deleting an order never erases its history — every deleted order and its full timeline stay here, permanently."
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
            {data.orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                <Link
                  to={`/orders/${order.id}`}
                  className="flex items-center gap-2 text-sm font-medium text-zinc-200 transition-colors hover:text-indigo-300"
                >
                  <ReceiptIcon width="14" height="14" className="text-indigo-400" />
                  Table {order.tableNumber}
                </Link>
                <StatusBadge status={order.status} />
                <span className="text-xs text-white">{order.primaryWaiter?.name ?? "—"}</span>
                <span className="ml-auto text-xs text-zinc-400">
                  Deleted {new Date(order.deletedAt).toLocaleString()}
                  {order.deletedBy && ` by ${order.deletedBy.name}`}
                </span>
              </div>
            ))}
            {data.orders.length === 0 && (
              <DarkEmptyState title="No deleted orders — nothing has been removed yet." />
            )}
          </div>
        </DarkPanelCard>
      )}
    </div>
  );
}
