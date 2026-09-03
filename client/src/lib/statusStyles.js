// Single source of truth for status color semantics — see the palette table in index.css.
// Anywhere a status/availability badge appears (order status, line status, menu availability,
// alert severity) pulls from here so the same word never gets two different colors.
export const STATUS_STYLES = {
  placed: { badge: "bg-sky-50 text-sky-700 ring-sky-600/20", chart: "#0284c7", solid: "bg-sky-600" },
  accepted: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", chart: "#d97706", solid: "bg-amber-600" },
  preparing: { badge: "bg-orange-50 text-orange-700 ring-orange-600/20", chart: "#ea580c", solid: "bg-orange-600" },
  ready: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20", chart: "#7c3aed", solid: "bg-violet-600" },
  served: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", chart: "#059669", solid: "bg-emerald-600" },
  cancelled: { badge: "bg-red-50 text-red-700 ring-red-600/20", chart: "#dc2626", solid: "bg-red-600" },
  active: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", chart: "#059669", solid: "bg-emerald-600" },
  void: { badge: "bg-slate-100 text-slate-500 ring-slate-400/20", chart: "#94a3b8", solid: "bg-slate-400" },
};

const FALLBACK = { badge: "bg-slate-100 text-slate-600 ring-slate-400/20", chart: "#64748b", solid: "bg-slate-500" };

export function statusStyle(status) {
  return STATUS_STYLES[status] ?? FALLBACK;
}
