export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Same card surface but no padding — for wrapping a table where the table's own cells provide it.
export function PanelCard({ className = "", children, ...props }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div>
        <h2 className="text-sm font-medium text-slate-700">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
