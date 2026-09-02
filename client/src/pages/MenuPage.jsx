import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { formatCurrency } from "../lib/format";
import { PlusIcon, ArchiveIcon, RestoreIcon, CheckIcon, XIcon } from "../components/icons";

export function MenuPage() {
  const { user } = useAuth();
  const isManager = isManagerOrAbove(user?.role);
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["menuItems", showArchived],
    queryFn: () => api.get(`/menu-items${showArchived ? "?include_archived=true" : ""}`),
  });

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const invalidateMenu = () => queryClient.invalidateQueries({ queryKey: ["menuItems"] });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/menu-items", payload),
    onSuccess: () => {
      invalidateMenu();
      setName("");
      setPrice("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/menu-items/${id}`, payload),
    onSuccess: invalidateMenu,
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => api.post(`/menu-items/${id}/archive`),
    onSuccess: invalidateMenu,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id) => api.post(`/menu-items/${id}/unarchive`),
    onSuccess: invalidateMenu,
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkAvailability, setBulkAvailability] = useState("");
  const [bulkResults, setBulkResults] = useState(null);

  const bulkMutation = useMutation({
    mutationFn: (payload) => api.patch("/menu-items/bulk", payload),
    onSuccess: (result) => {
      invalidateMenu();
      setBulkResults(result.results);
      setSelectedIds(new Set());
      setBulkPrice("");
      setBulkAvailability("");
    },
  });

  function handleCreate(e) {
    e.preventDefault();
    const parsedPrice = parseFloat(price);
    if (!name.trim() || Number.isNaN(parsedPrice)) return;
    createMutation.mutate({ name: name.trim(), price: parsedPrice });
  }

  function toggleAvailable(item) {
    updateMutation.mutate({ id: item.id, is_available: !item.isAvailable });
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApplyBulk(e) {
    e.preventDefault();
    const changes = {};
    if (bulkPrice.trim() !== "") {
      const parsed = parseFloat(bulkPrice);
      if (Number.isNaN(parsed)) return;
      changes.price = parsed;
    }
    if (bulkAvailability !== "") {
      changes.is_available = bulkAvailability === "true";
    }
    if (Object.keys(changes).length === 0 || selectedIds.size === 0) return;
    bulkMutation.mutate({ ids: [...selectedIds], changes });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Menu</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isManager ? "Manage what's on offer today." : "What the kitchen is serving right now."}
          </p>
        </div>
        {isManager && (
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show archived
          </label>
        )}
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      {data && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {isManager && <th className="w-8 px-5 py-3"></th>}
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Availability</th>
                {isManager && <th className="px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.menuItems.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-slate-50 ${item.isArchived ? "opacity-50" : ""}`}
                >
                  {isManager && (
                    <td className="px-5 py-3">
                      {!item.isArchived && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-5 py-3 text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="px-5 py-3">
                    {isManager && !item.isArchived ? (
                      <button
                        onClick={() => toggleAvailable(item)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                          item.isAvailable
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 ring-slate-400/20 hover:bg-slate-200"
                        }`}
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          item.isAvailable
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                            : "bg-slate-100 text-slate-500 ring-slate-400/20"
                        }`}
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </span>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-5 py-3">
                      {item.isArchived ? (
                        <button
                          onClick={() => unarchiveMutation.mutate(item.id)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <RestoreIcon width="14" height="14" />
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => archiveMutation.mutate(item.id)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        >
                          <ArchiveIcon width="14" height="14" />
                          Archive
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {data.menuItems.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 5 : 3} className="px-5 py-10 text-center text-slate-400">
                    {showArchived ? "No archived items." : "No menu items yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {isManager && selectedIds.size > 0 && (
        <form
          onSubmit={handleApplyBulk}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4"
        >
          <span className="text-sm font-medium text-indigo-900">
            {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="w-full sm:w-32">
            <label className="block text-sm font-medium text-slate-700">New price (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              placeholder="unchanged"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-sm font-medium text-slate-700">Availability</label>
            <select
              value={bulkAvailability}
              onChange={(e) => setBulkAvailability(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Unchanged</option>
              <option value="true">Mark available</option>
              <option value="false">Mark unavailable</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={bulkMutation.isPending || (bulkPrice.trim() === "" && bulkAvailability === "")}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {bulkMutation.isPending ? "Applying…" : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-indigo-700 hover:underline"
          >
            Clear selection
          </button>
        </form>
      )}
      {bulkMutation.error && <p className="mt-2 text-sm text-red-600">{bulkMutation.error.message}</p>}

      {bulkResults && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-700">Bulk update results</h2>
            <button onClick={() => setBulkResults(null)} className="text-sm text-slate-400 hover:text-slate-600">
              Dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {bulkResults.map((result) => {
              const item = data?.menuItems.find((m) => m.id === result.id);
              return (
                <li key={result.id} className="flex items-center gap-2">
                  {result.status === "ok" ? (
                    <CheckIcon width="14" height="14" className="text-emerald-600" />
                  ) : (
                    <XIcon width="14" height="14" className="text-red-600" />
                  )}
                  <span className="font-medium text-slate-800">{item?.name ?? result.id}</span>
                  {result.status === "ok" ? (
                    <span className="text-emerald-700">updated</span>
                  ) : (
                    <span className="text-red-600">rejected — {result.reason}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isManager && (
        <form
          onSubmit={handleCreate}
          className="mt-6 flex max-w-lg flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-[10rem] flex-1">
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Paneer Tikka"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-sm font-medium text-slate-700">Price (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <PlusIcon />
            Add item
          </button>
        </form>
      )}
      {createMutation.error && (
        <p className="mt-2 text-sm text-red-600">{createMutation.error.message}</p>
      )}
    </div>
  );
}
