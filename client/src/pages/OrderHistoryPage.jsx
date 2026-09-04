import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { LayersIcon, ReceiptIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkCard, DarkPanelCard, DarkEmptyState } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/DarkInput";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { TableSkeleton } from "../components/ui/Skeleton";

// Orders drop out of the "current status" working view (OrdersPage) the moment they're Served or
// Cancelled — those are both terminal states an order never leaves. This page is where they land
// automatically: no separate action moves an order here, it's just the same GET /api/orders
// endpoint filtered to a closed status instead of an open one.
const HISTORY_STATUSES = ["served", "cancelled"];
const PAGE_SIZE = 10;
const SORT_COLUMNS = [
  { field: "table", label: "Table" },
  { field: "placed", label: "Placed" },
];

export function OrderHistoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("served");
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
  params.set("status", statusFilter);
  if (waiterFilter) params.set("waiter", waiterFilter);
  if (dateFilter) params.set("date", dateFilter);
  params.set("sort", sort.field);
  params.set("dir", sort.dir);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", "history", debouncedSearch, statusFilter, waiterFilter, dateFilter, sort.field, sort.dir, page],
    queryFn: () => api.get(`/orders?${params.toString()}`),
  });

  const { data: waiterData } = useQuery({
    queryKey: ["users", "waiter"],
    queryFn: () => api.get("/users?role=waiter"),
  });

  function toggleSort(field) {
    setSort((prev) => (prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
    setPage(1);
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setPage(1);
  }

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <PageHeader
        icon={<LayersIcon width="22" height="22" className="text-indigo-400" />}
        title="Order history"
        subtitle="Closed orders only — an order moves here by itself the moment it's Served or Cancelled. Nothing here can be changed."
      />

      <DarkCard className="mt-5 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[10rem] flex-1">
          <Input
            label="Search"
            labelClassName="text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Table number…"
            className="pl-9"
          />
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center pt-5 text-slate-400">
            <SearchIcon width="14" height="14" />
          </span>
        </div>
        <Select
          label="Status"
          labelClassName="text-white"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="capitalize"
          containerClassName="w-40"
        >
          {HISTORY_STATUSES.map((status) => (
            <option key={status} value={status} className="capitalize">
              {status}
            </option>
          ))}
        </Select>
        <Select
          label="Waiter"
          labelClassName="text-white"
          value={waiterFilter}
          onChange={(e) => {
            setWaiterFilter(e.target.value);
            setPage(1);
          }}
          containerClassName="w-44"
        >
          <option value="">Any waiter</option>
          {waiterData?.users.map((waiter) => (
            <option key={waiter.id} value={waiter.id}>
              {waiter.name}
            </option>
          ))}
        </Select>
        <Input
          label="Date"
          labelClassName="text-white"
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          containerClassName="w-40"
        />
      </DarkCard>

      <ErrorMessage error={error} className="mt-6" />

      {isLoading && (
        <DarkPanelCard className="mt-4">
          <TableSkeleton cols={4} />
        </DarkPanelCard>
      )}

      {data && (
        <>
          <DarkPanelCard className="mt-4 animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    {SORT_COLUMNS.map((column) => (
                      <th key={column.field} className="px-5 py-3 font-medium">
                        <button
                          onClick={() => toggleSort(column.field)}
                          className="flex items-center gap-1 transition-colors hover:text-white"
                        >
                          {column.label}
                          {sort.field === column.field &&
                            (sort.dir === "asc" ? <ChevronUpIcon /> : <ChevronDownIcon />)}
                        </button>
                      </th>
                    ))}
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Waiter</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-white/5">
                      <td className="px-5 py-3 font-medium text-white">
                        <span className="inline-flex items-center gap-2">
                          <ReceiptIcon width="14" height="14" className="text-indigo-400" />
                          Table {order.tableNumber}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white">{new Date(order.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-white">{order.primaryWaiter?.name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Link to={`/orders/${order.id}`} className="text-indigo-400 transition-colors hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <DarkEmptyState title="Nothing here yet — closed orders will show up automatically." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DarkPanelCard>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white">
            <span>{total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondaryDark"
                size="md"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondaryDark"
                size="md"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
