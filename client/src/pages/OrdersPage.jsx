import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import { PlusIcon, ReceiptIcon, SearchIcon } from "../components/icons";

const SCOPE_TAB_CLASS = (isActive) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
  }`;

export function OrdersPage() {
  const { user } = useAuth();
  const isWaiter = user?.role === "waiter";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [scope, setScope] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", scope],
    queryFn: () => api.get(scope === "mine" ? "/orders/mine" : "/orders"),
  });

  const { data: tableData } = useQuery({
    queryKey: ["tables", "available"],
    queryFn: () => api.get("/tables?available=true"),
  });

  const availableTables = (tableData?.tables ?? []).filter((table) =>
    table.number.toString().includes(tableSearch.trim())
  );

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/orders", payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setSelectedTable(null);
      setTableSearch("");
      navigate(`/orders/${result.order.id}`);
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    if (!selectedTable) return;
    createMutation.mutate({ table_number: selectedTable });
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
        <p className="mt-0.5 text-sm text-slate-500">Open a new ticket or jump back into one.</p>
      </div>

      {isWaiter && (
        <div className="mt-4 flex items-center gap-1">
          <button className={SCOPE_TAB_CLASS(scope === "all")} onClick={() => setScope("all")}>
            All orders
          </button>
          <button className={SCOPE_TAB_CLASS(scope === "mine")} onClick={() => setScope("mine")}>
            My orders
          </button>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-5 max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="block text-sm font-medium text-slate-700">Table</label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <SearchIcon width="14" height="14" />
          </span>
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search a free table…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {availableTables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelectedTable(table.number)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedTable === table.number
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              Table {table.number}
            </button>
          ))}
          {availableTables.length === 0 && (
            <p className="py-1 text-sm text-slate-400">
              {tableSearch ? "No free tables match your search." : "No free tables right now."}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!selectedTable || createMutation.isPending}
          className="mt-4 flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
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
            <p className="col-span-full py-10 text-center text-slate-400">
              {scope === "mine" ? "You're not on any orders yet." : "No orders yet — start one above."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
