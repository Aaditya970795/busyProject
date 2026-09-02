import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isManagerOrAbove } from "../lib/roles";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../lib/format";
import { ArrowLeftIcon, PlusIcon, TrashIcon, UserPlusIcon } from "../components/icons";

// Mirrors the server's transition table (server/src/controllers/order.controller.js) just
// closely enough to decide which controls to show. This is a UI convenience only — the
// server re-validates every transition itself and is the real source of truth.
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
const CANCELLABLE_STATUSES = new Set(["placed", "accepted"]);
const OPEN_STATUSES = new Set(["placed", "accepted", "preparing", "ready"]);

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

  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [voidingLineId, setVoidingLineId] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [collaboratorId, setCollaboratorId] = useState("");

  const invalidateOrder = () => queryClient.invalidateQueries({ queryKey: ["order", id] });

  const order = data?.order;
  const canManageCollaborators = Boolean(
    user && order && (isManagerOrAbove(user.role) || user.id === order.primaryWaiterId)
  );

  const { data: waiterData } = useQuery({
    queryKey: ["users", "waiter"],
    queryFn: () => api.get("/users?role=waiter"),
    enabled: canManageCollaborators,
  });

  const addCollaboratorMutation = useMutation({
    mutationFn: (waiterId) => api.post(`/orders/${id}/collaborators`, { waiter_id: waiterId }),
    onSuccess: () => {
      invalidateOrder();
      setCollaboratorId("");
    },
  });

  function handleAddCollaborator(e) {
    e.preventDefault();
    if (!collaboratorId) return;
    addCollaboratorMutation.mutate(collaboratorId);
  }

  const addLineMutation = useMutation({
    mutationFn: (payload) => api.post(`/orders/${id}/lines`, payload),
    onSuccess: () => {
      invalidateOrder();
      setQuantity("1");
      setInstructions("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      invalidateOrder();
      // Reaching a terminal status (served/cancelled) frees up the table for new orders.
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setConfirmingCancel(false);
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ lineId, reason }) => api.post(`/orders/${id}/lines/${lineId}/void`, { reason }),
    onSuccess: () => {
      invalidateOrder();
      setVoidingLineId(null);
      setVoidReason("");
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

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const { total } = data;
  const nextStatus = NEXT_STATUS[order.status];
  const isOpen = OPEN_STATUSES.has(order.status);

  return (
    <div>
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeftIcon />
        Back to orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Table {order.tableNumber}</h1>
          <StatusBadge status={order.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {nextStatus && (
            <button
              onClick={() => statusMutation.mutate(nextStatus)}
              disabled={statusMutation.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {NEXT_STATUS_LABEL[nextStatus]}
            </button>
          )}

          {CANCELLABLE_STATUSES.has(order.status) &&
            (confirmingCancel ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
                <span className="text-amber-700">Cancel this order?</span>
                <button
                  onClick={() => statusMutation.mutate("cancelled")}
                  disabled={statusMutation.isPending}
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {statusMutation.isPending ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button
                  onClick={() => setConfirmingCancel(false)}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Never mind
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingCancel(true)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                Cancel order
              </button>
            ))}

          {confirmingDelete ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm">
              <span className="text-red-700">Delete this order?</span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <TrashIcon />
              Delete order
            </button>
          )}
        </div>
      </div>
      {statusMutation.error && (
        <p className="mt-2 text-right text-sm text-red-600">{statusMutation.error.message}</p>
      )}
      {deleteMutation.error && (
        <p className="mt-2 text-right text-sm text-red-600">{deleteMutation.error.message}</p>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Collaborators</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {order.collaborators.length === 0 && (
            <span className="text-sm text-slate-400">No collaborators yet.</span>
          )}
          {order.collaborators.map((collaborator) => (
            <span
              key={collaborator.waiterId}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {collaborator.waiter.name}
            </span>
          ))}
        </div>

        {canManageCollaborators && (
          <form onSubmit={handleAddCollaborator} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <label className="block text-sm font-medium text-slate-700">Add collaborator</label>
              <select
                value={collaboratorId}
                onChange={(e) => setCollaboratorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select a waiter</option>
                {waiterData?.users
                  .filter(
                    (waiter) =>
                      waiter.id !== order.primaryWaiterId &&
                      !order.collaborators.some((c) => c.waiterId === waiter.id)
                  )
                  .map((waiter) => (
                    <option key={waiter.id} value={waiter.id}>
                      {waiter.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!collaboratorId || addCollaboratorMutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              <UserPlusIcon width="14" height="14" />
              Add
            </button>
          </form>
        )}
        {addCollaboratorMutation.error && (
          <p className="mt-2 text-sm text-red-600">{addCollaboratorMutation.error.message}</p>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Qty</th>
              <th className="px-5 py-3 font-medium">Unit price</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Notes</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.lines.map((line) => (
              <tr
                key={line.id}
                className={`transition-colors hover:bg-slate-50 ${line.status === "void" ? "opacity-50" : ""}`}
              >
                <td className="px-5 py-3 font-medium text-slate-900">{line.menuItem.name}</td>
                <td className="px-5 py-3 text-slate-600">{line.quantity}</td>
                <td className="px-5 py-3 text-slate-600">{formatCurrency(line.unitPrice)}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={line.status} />
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {line.status === "void" ? (
                    <span className="italic text-red-600">Voided: {line.voidReason}</span>
                  ) : (
                    line.specialInstructions || "—"
                  )}
                </td>
                <td className="px-5 py-3">
                  {line.status === "active" &&
                    isOpen &&
                    (voidingLineId === line.id ? (
                      <form onSubmit={handleVoidSubmit} className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          placeholder="Reason"
                          required
                          className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <button
                          type="submit"
                          disabled={voidMutation.isPending || !voidReason.trim()}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          Void
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVoidingLineId(null);
                            setVoidReason("");
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setVoidingLineId(line.id);
                          setVoidReason("");
                        }}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      >
                        Void
                      </button>
                    ))}
                </td>
              </tr>
            ))}
            {order.lines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  No items on this order yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <span className="text-lg font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      </div>
      {voidMutation.error && <p className="mt-2 text-sm text-red-600">{voidMutation.error.message}</p>}

      {menuData && isOpen && (
        <form
          onSubmit={handleAddLine}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-[10rem] flex-1">
            <label className="block text-sm font-medium text-slate-700">Menu item</label>
            <select
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="" disabled>
                Select an item
              </option>
              {menuData.menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatCurrency(item.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-slate-700">Qty</label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="block text-sm font-medium text-slate-700">Instructions</label>
            <input
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="optional"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={addLineMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <PlusIcon />
            Add to order
          </button>
        </form>
      )}
      {!isOpen && (
        <p className="mt-6 text-sm text-slate-400">
          This order is {order.status} — no further changes can be made to it.
        </p>
      )}
      {addLineMutation.error && (
        <p className="mt-2 text-sm text-red-600">{addLineMutation.error.message}</p>
      )}
    </div>
  );
}
