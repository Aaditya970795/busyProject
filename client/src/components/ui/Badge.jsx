// Generic colored pill for non-order-status badges (roles, table occupancy, menu availability).
// Order/line status badges go through StatusBadge + lib/statusStyles instead, so the two never
// pick different colors for the same semantic (e.g. "available"/"active" both land on emerald).
const TONE_CLASSES = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

export function Badge({ tone = "slate", as: Component = "span", className = "", children, ...props }) {
  return (
    <Component
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset transition-colors duration-150 ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
