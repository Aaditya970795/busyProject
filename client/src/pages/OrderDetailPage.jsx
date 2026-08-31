import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../lib/format";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "../components/icons";

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const addLineMutation = useMutation({
    mutationFn: (payload) => api.post(`/orders/${id}/lines`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      setQuantity("1");
      setInstructions("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
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

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const { order, total } = data;

  return (
    <div>
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeftIcon />
        Back to orders
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Table {order.tableNumber}</h1>
          <StatusBadge status={order.status} />
        </div>

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
      {deleteMutation.error && (
        <p className="mt-2 text-right text-sm text-red-600">{deleteMutation.error.message}</p>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Qty</th>
              <th className="px-5 py-3 font-medium">Unit price</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.lines.map((line) => (
              <tr key={line.id} className="transition-colors hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{line.menuItem.name}</td>
                <td className="px-5 py-3 text-slate-600">{line.quantity}</td>
                <td className="px-5 py-3 text-slate-600">{formatCurrency(line.unitPrice)}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={line.status} />
                </td>
                <td className="px-5 py-3 text-slate-500">{line.specialInstructions || "—"}</td>
              </tr>
            ))}
            {order.lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  No items on this order yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <span className="text-lg font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      </div>

      {menuData && (
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
      {addLineMutation.error && (
        <p className="mt-2 text-sm text-red-600">{addLineMutation.error.message}</p>
      )}
    </div>
  );
}
