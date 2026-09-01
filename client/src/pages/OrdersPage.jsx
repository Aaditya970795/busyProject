import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { PlusIcon, ReceiptIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon } from "../components/icons";

const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "served", "cancelled"];
const PAGE_SIZE = 10;
const SORT_COLUMNS = [
  { field: "table", label: "Table" },
  { field: "status", label: "Status" },
  { field: "placed", label: "Placed" },
];

export function OrdersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tableSearch, setTableSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState({ field: "placed", dir: "desc" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter) params.set("status", statusFilter);
  if (waiterFilter) params.set("waiter", waiterFilter);
  if (dateFilter) params.set("date", dateFilter);
  params.set("sort", sort.field);
  params.set("dir", sort.dir);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", debouncedSearch, statusFilter, waiterFilter, dateFilter, sort.field, sort.dir, page],
    queryFn: () => api.get(`/orders?${params.toString()}`),
  });

  const { data: waiterData } = useQuery({
    queryKey: ["users", "waiter"],
    queryFn: () => api.get("/users?role=waiter"),
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

  function toggleSort(field) {
    setSort((prev) => (prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
    setPage(1);
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleWaiterFilterChange(value) {
    setWaiterFilter(value);
    setPage(1);
  }

  function handleDateFilterChange(value) {
    setDateFilter(value);
    setPage(1);
  }

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
        <p className="mt-0.5 text-sm text-slate-500">Open a new ticket or jump back into one.</p>
      </div>

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

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[10rem] flex-1">
          <label className="block text-sm font-medium text-slate-700">Search</label>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center pt-5 text-slate-400">
            <SearchIcon width="14" height="14" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Table number…"
            className="mt-1 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="w-40">
          <label className="block text-sm font-medium text-slate-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm capitalize focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Any status</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status} className="capitalize">
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="block text-sm font-medium text-slate-700">Waiter</label>
          <select
            value={waiterFilter}
            onChange={(e) => handleWaiterFilterChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Any waiter</option>
            {waiterData?.users.map((waiter) => (
              <option key={waiter.id} value={waiter.id}>
                {waiter.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="block text-sm font-medium text-slate-700">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      {data && (
        <>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {SORT_COLUMNS.map((column) => (
                    <th key={column.field} className="px-5 py-3 font-medium">
                      <button
                        onClick={() => toggleSort(column.field)}
                        className="flex items-center gap-1 hover:text-slate-800"
                      >
                        {column.label}
                        {sort.field === column.field &&
                          (sort.dir === "asc" ? <ChevronUpIcon /> : <ChevronDownIcon />)}
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3 font-medium">Waiter</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <ReceiptIcon width="14" height="14" className="text-indigo-600" />
                        Table {order.tableNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-600">{order.primaryWaiter?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Link to={`/orders/${order.id}`} className="text-indigo-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                      No orders match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>{total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
