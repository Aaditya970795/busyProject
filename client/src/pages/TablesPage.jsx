import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { PlusIcon, ArchiveIcon, RestoreIcon, SearchIcon } from "../components/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { DarkCard, DarkEmptyState } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Skeleton } from "../components/ui/Skeleton";

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
      <PageHeader
        title="Tables"
        subtitle={isManager ? "Manage the dining room's table list." : "Which tables are free right now."}
        action={
          isManager && (
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-indigo-500 focus:ring-indigo-500"
              />
              Show removed
            </label>
          )
        }
      />

      <div className="relative mt-5 max-w-xs">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search table number…"
          className="pl-9"
        />
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <SearchIcon width="14" height="14" />
        </span>
      </div>

      <ErrorMessage error={error} className="mt-6" />

      {isLoading && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-3xl border border-white/10 bg-zinc-900 p-4 shadow-sm">
              <Skeleton className="h-5 w-16 bg-white/10" />
              <Skeleton className="h-4 w-14 bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 animate-fade-in">
          {tables.map((table) => (
            <DarkCard
              key={table.id}
              className={`flex flex-col items-center gap-2 transition-all duration-200 hover:-translate-y-0.5 ${
                table.isArchived ? "opacity-50" : ""
              }`}
            >
              <span className="text-lg font-semibold text-white">Table {table.number}</span>
              <Badge tone={table.isOccupied ? "amber" : "emerald"}>
                {table.isOccupied ? "Occupied" : "Available"}
              </Badge>
              {isManager &&
                (table.isArchived ? (
                  <Button variant="secondaryDark" size="sm" onClick={() => unarchiveMutation.mutate(table.id)}>
                    <RestoreIcon width="14" height="14" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="secondaryDark"
                    size="sm"
                    className="hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => archiveMutation.mutate(table.id)}
                  >
                    <ArchiveIcon width="14" height="14" />
                    Remove
                  </Button>
                ))}
            </DarkCard>
          ))}
          {tables.length === 0 && (
            <div className="col-span-full">
              <DarkEmptyState title={search ? "No tables match your search." : "No tables yet."} />
            </div>
          )}
        </div>
      )}

      {isManager && (
        <DarkCard as="form" onSubmit={handleCreate} className="mt-6 flex max-w-xs items-end gap-3">
          <Input
            label="Table number"
            labelClassName="text-zinc-300"
            type="number"
            min="1"
            step="1"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
            placeholder="e.g. 12"
            containerClassName="flex-1"
          />
          <Button type="submit" loading={createMutation.isPending}>
            <PlusIcon />
            Add table
          </Button>
        </DarkCard>
      )}
      <ErrorMessage error={createMutation.error} className="mt-2" />
    </div>
  );
}
