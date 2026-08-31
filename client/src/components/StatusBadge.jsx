const STATUS_STYLES = {
  placed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  accepted: "bg-amber-50 text-amber-700 ring-amber-600/20",
  preparing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  ready: "bg-violet-50 text-violet-700 ring-violet-600/20",
  served: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-red-50 text-red-700 ring-red-600/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  void: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

export function StatusBadge({ status }) {
  const classes = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-400/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${classes}`}
    >
      {status}
    </span>
  );
}
