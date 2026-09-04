import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../lib/format";
import { PlusIcon, ReceiptIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkCard, DarkPanelCard, DarkEmptyState } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/DarkInput";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { TableSkeleton } from "../components/ui/Skeleton";

const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "served", "cancelled"];
const PAGE_SIZE = 10;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
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
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState({ field: "placed", dir: "desc" });
  const [page, setPage] = useState(1);

  const [exportDate, setExportDate] = useState(todayIsoDate());
  const [exportError, setExportError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

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

  const { data: menuData } = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => api.get("/menu-items"),
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
      setMenuItemId("");
      setQuantity("1");
      navigate(`/orders/${result.order.id}`);
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    const parsedQuantity = parseInt(quantity, 10);
    if (!selectedTable || !menuItemId || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) return;
    createMutation.mutate({ table_number: selectedTable, menu_item_id: menuItemId, quantity: parsedQuantity });
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

  async function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      const { blob, filename } = await api.downloadFile(`/orders/export?date=${exportDate}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Your current order status — every order still in play. Once an order is Served or Cancelled it moves to History automatically."
        action={
          <div className="flex items-end gap-2">
            <Input
              label="Export date"
              labelClassName="text-white"
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
            />
            <Button variant="secondaryDark" onClick={handleExport} loading={isExporting}>
              Export CSV
            </Button>
          </div>
        }
      />
      <ErrorMessage error={exportError} className="mt-2" />

      <DarkCard className="mt-5 max-w-lg">
        <label className="block text-sm font-medium text-zinc-300">Table</label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <SearchIcon width="14" height="14" />
          </span>
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search a free table…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-white transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-white/15 bg-white/5 text-zinc-200 hover:border-indigo-400/40 hover:bg-indigo-500/10"
              }`}
            >
              Table {table.number}
            </button>
          ))}
          {availableTables.length === 0 && (
            <p className="py-1 text-sm text-zinc-500">
              {tableSearch ? "No free tables match your search." : "No free tables right now."}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Select
            label="First item"
            labelClassName="text-white"
            className="text-sm text-black"
            value={menuItemId}
            onChange={(e) => setMenuItemId(e.target.value)}
            containerClassName="min-w-[10rem] flex-1"
          >
            <option value="">Select an item</option>
            {menuData?.menuItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {formatCurrency(item.price)}
              </option>
            ))}
          </Select>
          <Input
            label="Qty"
            labelClassName="text-white"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            containerClassName="w-24"
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">An order needs at least one item to be created.</p>

        <Button
          type="submit"
          onClick={handleCreate}
          disabled={!selectedTable || !menuItemId || createMutation.isPending}
          loading={createMutation.isPending}
          className="mt-4"
        >
          <PlusIcon />
          New order
        </Button>
      </DarkCard>
      <ErrorMessage error={createMutation.error} className="mt-2" />

      <div className="mt-8 flex flex-wrap items-end gap-3">
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
          <option value="">Any status</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status} className="capitalize">
              {status}
            </option>
          ))}
        </Select>
        <Select
          label="Waiter"
          labelClassName="text-white"
          value={waiterFilter}
          onChange={(e) => handleWaiterFilterChange(e.target.value)}
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
          onChange={(e) => handleDateFilterChange(e.target.value)}
          containerClassName="w-40"
        />
      </div>

      <ErrorMessage error={error} className="mt-6" />

      {isLoading && (
        <DarkPanelCard className="mt-4">
          <TableSkeleton cols={5} />
        </DarkPanelCard>
      )}

      {data && (
        <>
          <DarkPanelCard className="mt-4 animate-fade-in">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
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
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-white">{new Date(order.createdAt).toLocaleString()}</td>
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
                      <DarkEmptyState title="No orders match your filters." />
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
