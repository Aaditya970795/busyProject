export function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 px-4 py-10 text-center ${className}`}>
      {icon && <div className="mb-1 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
