import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../lib/format";
import { CANCELLABLE_STATUSES, OPEN_STATUSES } from "../lib/orderStatus";
import { ArrowLeftIcon, PlusIcon, TrashIcon, UserPlusIcon } from "../components/icons";
import { DarkCard, DarkPanelCard, DarkEmptyState } from "../components/ui/DarkCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Skeleton, TableSkeleton } from "../components/ui/Skeleton";

const NEXT_STATUS = {
  placed: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "served",
};
const NEXT_STATUS_LABEL = {
  accepted: "Mark accepted",
  preparing: "Start preparing",
  ready: "Mark ready",
  served: "Mark served",
};

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Turns one OrderEvent row into the plain-English sentence the timeline renders. Kept next to
// the page instead of shared with the server, same as the NEXT_STATUS map above — a UI-only
// concern, not a rule the server needs to agree on.
function describeEvent(event) {
  // A null actor means the system did this, not a person — currently only the auto-clear sweep
  // (lib/autoClearSweep.js on the server) cancelling an order nobody acted on in time.
  if (!event.actor) {
    if (event.eventType === "status_change" && event.newValue === "cancelled") {
      return `Automatically cancelled — ${event.note}`;
    }
    return "System event";
  }

  const actorName = event.actor.name;
  switch (event.eventType) {
    case "status_change":
      return `${actorName} changed status from ${capitalize(event.oldValue)} to ${capitalize(event.newValue)}`;
    case "line_added":
      return `${actorName} added ${event.newValue}`;
    case "line_voided":
      return `${actorName} voided '${event.newValue}' — reason: ${event.note}`;
    case "note":
      return `${actorName} left a note: "${event.note}"`;
    case "order_deleted":
      return `${actorName} deleted this order (was ${capitalize(event.oldValue)})`;
    default:
      return `${actorName} recorded an event`;
  }
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get(`/orders/${id}`),
  });

  const { data: menuData } = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => api.get("/menu-items"),
  });

  const { data: timelineData } = useQuery({
    queryKey: ["order", id, "timeline"],
    queryFn: () => api.get(`/orders/${id}/timeline`),
  });

  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [voidingLineId, setVoidingLineId] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [noteText, setNoteText] = useState("");

  const invalidateOrder = () => queryClient.invalidateQueries({ queryKey: ["order", id] });
  const invalidateTimeline = () => queryClient.invalidateQueries({ queryKey: ["order", id, "timeline"] });

  const order = data?.order;
  const canManageCollaborators = Boolean(
    user && order && (isManagerOrAbove(user.role) || user.id === order.primaryWaiterId)
  );

  const { data: waiterData } = useQuery({
    queryKey: ["users", "waiter"],
    queryFn: () => api.get("/users?role=waiter"),
    enabled: canManageCollaborators,
  });

  const eligibleCollaborators = (waiterData?.users ?? []).filter(
    (waiter) =>
      order && waiter.id !== order.primaryWaiterId && !order.collaborators.some((c) => c.waiterId === waiter.id)
  );
  // No blank "Select a waiter" option — the field defaults to the first eligible waiter instead,
  // so the dropdown's own list only ever shows real names, and "Add" is disabled only when there's
  // truly nobody left to add.
  const selectedCollaboratorId = collaboratorId || eligibleCollaborators[0]?.id || "";

  const addCollaboratorMutation = useMutation({
    mutationFn: (waiterId) => api.post(`/orders/${id}/collaborators`, { waiter_id: waiterId }),
    onSuccess: () => {
      invalidateOrder();
      setCollaboratorId("");
    },
  });

  function handleAddCollaborator(e) {
    e.preventDefault();
    if (!selectedCollaboratorId) return;
    addCollaboratorMutation.mutate(selectedCollaboratorId);
  }

  const addLineMutation = useMutation({
    mutationFn: (payload) => api.post(`/orders/${id}/lines`, payload),
    onSuccess: () => {
      invalidateOrder();
      invalidateTimeline();
      setQuantity("1");
      setInstructions("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      invalidateOrder();
      invalidateTimeline();
      // Reaching a terminal status (served/cancelled) frees up the table for new orders.
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setConfirmingCancel(false);
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ lineId, reason }) => api.post(`/orders/${id}/lines/${lineId}/void`, { reason }),
    onSuccess: () => {
      invalidateOrder();
      invalidateTimeline();
      setVoidingLineId(null);
      setVoidReason("");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note) => api.post(`/orders/${id}/notes`, { note }),
    onSuccess: () => {
      invalidateTimeline();
      setNoteText("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      navigate("/orders", { replace: true });
    },
  });

  function handleAddLine(e) {
    e.preventDefault();
    const parsedQuantity = parseInt(quantity, 10);
    if (!menuItemId || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) return;
    addLineMutation.mutate({
      menu_item_id: menuItemId,
      quantity: parsedQuantity,
      special_instructions: instructions.trim() || undefined,
    });
  }

  function handleVoidSubmit(e) {
    e.preventDefault();
    if (!voidReason.trim()) return;
    voidMutation.mutate({ lineId: voidingLineId, reason: voidReason.trim() });
  }

  function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNoteMutation.mutate(noteText.trim());
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-4 w-28 bg-white/10" />
        <Skeleton className="mt-3 h-8 w-48 bg-white/10" />
        <DarkPanelCard className="mt-5">
          <TableSkeleton cols={6} />
        </DarkPanelCard>
      </div>
    );
  }
  if (error) return <ErrorMessage error={error} />;

  const { total } = data;
  const nextStatus = NEXT_STATUS[order.status];
  const isOpen = OPEN_STATUSES.has(order.status);
  const isDeleted = Boolean(order.deletedAt);
  // Deletable only while nothing has actually started yet — mirrors CANCELLABLE_STATUSES since
  // the server enforces the exact same boundary (server/src/controllers/order.controller.js,
  // DELETABLE_STATUSES): once preparing has begun, the order can only be cancelled/archived, not
  // deleted.
  const canDelete = CANCELLABLE_STATUSES.has(order.status);

  return (
    <div className="animate-fade-in">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeftIcon />
        Back to orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Table {order.tableNumber}</h1>
          <StatusBadge status={order.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isDeleted && nextStatus && (
            <Button onClick={() => statusMutation.mutate(nextStatus)} loading={statusMutation.isPending}>
              {NEXT_STATUS_LABEL[nextStatus]}
            </Button>
          )}

          {!isDeleted &&
            CANCELLABLE_STATUSES.has(order.status) &&
            (confirmingCancel ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-sm animate-scale-in">
                <span className="text-amber-300">Cancel this order?</span>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => statusMutation.mutate("cancelled")}
                  loading={statusMutation.isPending}
                >
                  Yes, cancel
                </Button>
                <button
                  onClick={() => setConfirmingCancel(false)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10"
                >
                  Never mind
                </button>
              </div>
            ) : (
              <Button
                variant="secondaryDark"
                className="hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-300"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel order
              </Button>
            ))}

          {!isDeleted &&
            canDelete &&
            (confirmingDelete ? (
              <div className="flex items-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-sm animate-scale-in">
                <span className="text-red-300">Delete this order?</span>
                <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
                  Yes, delete
                </Button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <Button
                variant="secondaryDark"
                className="hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon />
                Delete order
              </Button>
            ))}
        </div>
      </div>
      {isDeleted && (
        <div className="mt-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          This order was deleted on {new Date(order.deletedAt).toLocaleString()}
          {order.deletedBy && ` by ${order.deletedBy.name}`} — kept here read-only, for its history.
        </div>
      )}
      {order.alertAcknowledgedAt && order.alertAcknowledgedBy && (
        <p className="mt-1 text-xs text-zinc-500">
          Slow-order alert last acknowledged by {order.alertAcknowledgedBy.name},{" "}
          {new Date(order.alertAcknowledgedAt).toLocaleString()}
          {OPEN_STATUSES.has(order.status) && order.status !== "ready" && " — still not Ready"}
        </p>
      )}
      <ErrorMessage error={statusMutation.error} className="mt-2 text-right" />
      <ErrorMessage error={deleteMutation.error} className="mt-2 text-right" />

      <DarkCard className="mt-5">
        <h2 className="text-sm font-medium text-zinc-100">Collaborators</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {order.collaborators.length === 0 && (
            <span className="text-sm text-zinc-500">No collaborators yet.</span>
          )}
          {order.collaborators.map((collaborator) => (
            <Badge key={collaborator.waiterId} tone="slate" className="normal-case">
              {collaborator.waiter.name}
            </Badge>
          ))}
        </div>

        {canManageCollaborators && !isDeleted && isOpen && eligibleCollaborators.length > 0 && (
          <form onSubmit={handleAddCollaborator} className="mt-3 flex flex-wrap items-end gap-2">
            <Select
              label="Select a waiter"
              labelClassName="text-zinc-300"
              value={selectedCollaboratorId}
              onChange={(e) => setCollaboratorId(e.target.value)}
              containerClassName="min-w-[10rem] flex-1"
            >
              {eligibleCollaborators.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={!selectedCollaboratorId} loading={addCollaboratorMutation.isPending}>
              <UserPlusIcon width="14" height="14" />
              Add
            </Button>
          </form>
        )}
        {canManageCollaborators && !isDeleted && isOpen && eligibleCollaborators.length === 0 && (
          <p className="mt-3 text-xs text-zinc-500">No other waiters available to add.</p>
        )}
        <ErrorMessage error={addCollaboratorMutation.error} className="mt-2" />
      </DarkCard>

      <DarkPanelCard className="mt-5">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Qty</th>
              <th className="px-5 py-3 font-medium">Unit price</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Notes</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {order.lines.map((line) => (
              <tr
                key={line.id}
                className={`transition-opacity duration-300 hover:bg-white/5 ${line.status === "void" ? "opacity-50" : ""}`}
              >
                <td className="px-5 py-3 font-medium text-white">{line.menuItem.name}</td>
                <td className="px-5 py-3 text-white">{line.quantity}</td>
                <td className="px-5 py-3 text-white">{formatCurrency(line.unitPrice)}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={line.status} />
                </td>
                <td className="px-5 py-3 text-white">
                  {line.status === "void" ? (
                    <span className="italic text-red-400">Voided: {line.voidReason}</span>
                  ) : (
                    line.specialInstructions || "—"
                  )}
                </td>
                <td className="px-5 py-3">
                  {line.status === "active" &&
                    isOpen &&
                    !isDeleted &&
                    (voidingLineId === line.id ? (
                      <form onSubmit={handleVoidSubmit} className="flex items-center gap-2 animate-scale-in">
                        <input
                          autoFocus
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          placeholder="Reason"
                          required
                          className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 transition-colors focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <Button type="submit" size="sm" variant="danger" disabled={!voidReason.trim()} loading={voidMutation.isPending}>
                          Void
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setVoidingLineId(null);
                            setVoidReason("");
                          }}
                          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <Button
                        variant="secondaryDark"
                        size="sm"
                        className="hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => {
                          setVoidingLineId(line.id);
                          setVoidReason("");
                        }}
                      >
                        Void
                      </Button>
                    ))}
                </td>
              </tr>
            ))}
            {order.lines.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <DarkEmptyState title="No items on this order yet — add one below." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-5 py-3">
          <span className="text-sm font-medium text-white">Total</span>
          <span className="text-lg font-semibold text-white">{formatCurrency(total)}</span>
        </div>
      </DarkPanelCard>
      <ErrorMessage error={voidMutation.error} className="mt-2" />

      {menuData && isOpen && !isDeleted && (
        <DarkCard as="form" onSubmit={handleAddLine} className="mt-6 flex flex-wrap items-end gap-3">
          <Select
            label="Menu item"
            labelClassName="text-zinc-300"
            value={menuItemId}
            onChange={(e) => setMenuItemId(e.target.value)}
            required
            containerClassName="min-w-[10rem] flex-1"
          >
            <option value="" disabled>
              Select an item
            </option>
            {menuData.menuItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {formatCurrency(item.price)}
              </option>
            ))}
          </Select>
          <Input
            label="Qty"
            labelClassName="text-zinc-300"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            containerClassName="w-24"
          />
          <Input
            label="Instructions"
            labelClassName="text-zinc-300"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="optional"
            containerClassName="min-w-[10rem] flex-1"
          />
          <Button type="submit" loading={addLineMutation.isPending}>
            <PlusIcon />
            Add to order
          </Button>
        </DarkCard>
      )}
      {!isOpen && (
        <p className="mt-6 text-sm text-zinc-500">
          This order is {order.status} — no further changes can be made to it.
        </p>
      )}
      <ErrorMessage error={addLineMutation.error} className="mt-2" />

      <DarkCard className="mt-6">
        <h2 className="text-sm font-medium text-zinc-100">Timeline</h2>
        <div className="mt-2 divide-y divide-white/5">
          {timelineData?.events.map((event) => (
            <div key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
              <p className="text-sm text-zinc-300">{describeEvent(event)}</p>
              <span className="text-xs text-zinc-500">{new Date(event.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {timelineData && timelineData.events.length === 0 && (
            <DarkEmptyState title="No activity recorded yet." className="py-4" />
          )}
        </div>

        {!isDeleted && isOpen && (
          <form onSubmit={handleAddNote} className="mt-3 flex flex-wrap items-end gap-2">
            <Input
              label="Add a note"
              labelClassName="text-zinc-300"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Guest asked for less spice"
              containerClassName="min-w-[12rem] flex-1"
            />
            <Button type="submit" disabled={!noteText.trim()} loading={addNoteMutation.isPending}>
              Add note
            </Button>
          </form>
        )}
        <ErrorMessage error={addNoteMutation.error} className="mt-2" />
      </DarkCard>
    </div>
  );
}
