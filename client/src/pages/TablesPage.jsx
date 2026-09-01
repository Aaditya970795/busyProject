import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { PlusIcon, ArchiveIcon, RestoreIcon, SearchIcon } from "../components/icons";

export function TablesPage() {
  const { user } = useAuth();
  const isManager = isManagerOrAbove(user?.role);
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [number, setNumber] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["tables", showArchived],
    queryFn: () => api.get(`/tables${showArchived ? "?include_archived=true" : ""}`),
  });

  const invalidateTables = () => queryClient.invalidateQueries({ queryKey: ["tables"] });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/tables", payload),
    onSuccess: () => {
      invalidateTables();
      setNumber("");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => api.post(`/tables/${id}/archive`),
    onSuccess: invalidateTables,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id) => api.post(`/tables/${id}/unarchive`),
    onSuccess: invalidateTables,
  });

  function handleCreate(e) {
    e.preventDefault();
    const parsed = parseInt(number, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    createMutation.mutate({ number: parsed });
  }

  const tables = data?.tables.filter((table) => table.number.toString().includes(search.trim())) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tables</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isManager ? "Manage the dining room's table list." : "Which tables are free right now."}
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
            Show removed
          </label>
        )}
      </div>

      <div className="relative mt-5 max-w-xs">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <SearchIcon width="14" height="14" />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search table number…"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      {data && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
                table.isArchived ? "opacity-50" : ""
              }`}
            >
              <span className="text-lg font-semibold text-slate-900">Table {table.number}</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  table.isOccupied
                    ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                }`}
              >
                {table.isOccupied ? "Occupied" : "Available"}
              </span>
              {isManager &&
                (table.isArchived ? (
                  <button
                    onClick={() => unarchiveMutation.mutate(table.id)}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <RestoreIcon width="14" height="14" />
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => archiveMutation.mutate(table.id)}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    <ArchiveIcon width="14" height="14" />
                    Remove
                  </button>
                ))}
            </div>
          ))}
          {tables.length === 0 && (
            <p className="col-span-full py-10 text-center text-slate-400">
              {search ? "No tables match your search." : "No tables yet."}
            </p>
          )}
        </div>
      )}

      {isManager && (
        <form
          onSubmit={handleCreate}
          className="mt-6 flex max-w-xs items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">Table number</label>
            <input
              type="number"
              min="1"
              step="1"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
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
            Add table
          </button>
        </form>
      )}
      {createMutation.error && (
        <p className="mt-2 text-sm text-red-600">{createMutation.error.message}</p>
      )}
    </div>
  );
}
