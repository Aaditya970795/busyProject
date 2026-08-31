import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { PlusIcon, ReceiptIcon } from "../components/icons";

export function OrdersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tableNumber, setTableNumber] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get("/orders"),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/orders", payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setTableNumber("");
      navigate(`/orders/${result.order.id}`);
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    const parsed = parseInt(tableNumber, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    createMutation.mutate({ table_number: parsed });
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
        <p className="mt-0.5 text-sm text-slate-500">Open a new ticket or jump back into one.</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mt-5 flex max-w-sm items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">Table number</label>
          <input
            type="number"
            min="1"
            step="1"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            required
            placeholder="e.g. 12"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <PlusIcon />
          New order
        </button>
      </form>
      {createMutation.error && (
        <p className="mt-2 text-sm text-red-600">{createMutation.error.message}</p>
      )}

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      {data && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <ReceiptIcon width="18" height="18" />
                </span>
                <div>
                  <p className="font-medium text-slate-900">Table {order.tableNumber}</p>
                  <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <StatusBadge status={order.status} />
            </Link>
          ))}
          {data.orders.length === 0 && (
            <p className="col-span-full py-10 text-center text-slate-400">No orders yet — start one above.</p>
          )}
        </div>
      )}
    </div>
  );
}
