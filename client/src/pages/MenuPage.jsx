import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { formatCurrency } from "../lib/format";
import { PlusIcon, ArchiveIcon, RestoreIcon, CheckIcon, XIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkCard, DarkPanelCard, DarkEmptyState } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { TableSkeleton } from "../components/ui/Skeleton";

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
      <PageHeader
        title="Menu"
        subtitle={isManager ? "Manage what's on offer today." : "What the kitchen is serving right now."}
        action={
          isManager && (
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-indigo-500"
              />
              Show archived
            </label>
          )
        }
      />

      {error && <ErrorMessage error={error} className="mt-6" />}

      {isLoading && (
        <DarkPanelCard className="mt-5">
          <TableSkeleton cols={isManager ? 4 : 2} />
        </DarkPanelCard>
      )}

      {data && (
        <DarkPanelCard className="mt-5 animate-fade-in">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                {isManager && <th className="w-8 px-5 py-3"></th>}
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Availability</th>
                {isManager && <th className="px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.menuItems.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-white/5 ${item.isArchived ? "opacity-50" : ""}`}
                >
                  {isManager && (
                    <td className="px-5 py-3">
                      {!item.isArchived && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          className="h-4 w-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-indigo-500"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-5 py-3 text-zinc-400">{formatCurrency(item.price)}</td>
                  <td className="px-5 py-3">
                    {isManager && !item.isArchived ? (
                      <Badge
                        as="button"
                        onClick={() => toggleAvailable(item)}
                        tone={item.isAvailable ? "emerald" : "slate"}
                        className="cursor-pointer hover:brightness-95"
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </Badge>
                    ) : (
                      <Badge tone={item.isAvailable ? "emerald" : "slate"}>
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </Badge>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-5 py-3">
                      {item.isArchived ? (
                        <Button variant="secondaryDark" size="sm" onClick={() => unarchiveMutation.mutate(item.id)}>
                          <RestoreIcon width="14" height="14" />
                          Restore
                        </Button>
                      ) : (
                        <Button
                          variant="secondaryDark"
                          size="sm"
                          className="hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => archiveMutation.mutate(item.id)}
                        >
                          <ArchiveIcon width="14" height="14" />
                          Archive
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {data.menuItems.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 5 : 3}>
                    <DarkEmptyState title={showArchived ? "No archived items." : "No menu items yet."} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </DarkPanelCard>
      )}

      {isManager && selectedIds.size > 0 && (
        <form
          onSubmit={handleApplyBulk}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-3xl border border-indigo-400/20 bg-indigo-500/10 p-4 animate-fade-in-fast"
        >
          <span className="text-sm font-medium text-indigo-200">
            {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <Input
            label="New price (₹)"
            labelClassName="text-zinc-300"
            type="number"
            step="0.01"
            min="0"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="unchanged"
            containerClassName="w-full sm:w-32"
          />
          <Select
            label="Availability"
            labelClassName="text-zinc-300"
            value={bulkAvailability}
            onChange={(e) => setBulkAvailability(e.target.value)}
            containerClassName="w-full sm:w-40"
          >
            <option value="">Unchanged</option>
            <option value="true">Mark available</option>
            <option value="false">Mark unavailable</option>
          </Select>
          <Button
            type="submit"
            loading={bulkMutation.isPending}
            disabled={bulkPrice.trim() === "" && bulkAvailability === ""}
          >
            Apply
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-indigo-300 transition-colors hover:underline"
          >
            Clear selection
          </button>
        </form>
      )}
      <ErrorMessage error={bulkMutation.error} className="mt-2" />

      {bulkResults && (
        <DarkCard className="mt-4 animate-fade-in-fast">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-100">Bulk update results</h2>
            <button onClick={() => setBulkResults(null)} className="text-sm text-zinc-500 transition-colors hover:text-zinc-300">
              Dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {bulkResults.map((result) => {
              const item = data?.menuItems.find((m) => m.id === result.id);
              return (
                <li key={result.id} className="flex items-center gap-2">
                  {result.status === "ok" ? (
                    <CheckIcon width="14" height="14" className="text-emerald-400" />
                  ) : (
                    <XIcon width="14" height="14" className="text-red-400" />
                  )}
                  <span className="font-medium text-zinc-100">{item?.name ?? result.id}</span>
                  {result.status === "ok" ? (
                    <span className="text-emerald-400">updated</span>
                  ) : (
                    <span className="text-red-400">rejected — {result.reason}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </DarkCard>
      )}

      {isManager && (
        <DarkCard as="form" onSubmit={handleCreate} className="mt-6 flex max-w-lg flex-wrap items-end gap-3">
          <Input
            label="Name"
            labelClassName="text-zinc-300"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Paneer Tikka"
            containerClassName="min-w-[10rem] flex-1"
          />
          <Input
            label="Price (₹)"
            labelClassName="text-zinc-300"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            containerClassName="w-full sm:w-32"
          />
          <Button type="submit" loading={createMutation.isPending}>
            <PlusIcon />
            Add item
          </Button>
        </DarkCard>
      )}
      <ErrorMessage error={createMutation.error} className="mt-2" />
    </div>
  );
}
