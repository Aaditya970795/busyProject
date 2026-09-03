// Dark-surface counterparts to Card/PanelCard/EmptyState — for pages living on the app's dark
// body (Dashboard, Menu, Tables, Orders, Order Detail, Alerts, Team). The light Card/EmptyState
// stay as-is because Login/Landing still use them. Same visual language as Dashboard's cards:
// rounded-3xl, border-white/10, bg-zinc-900, brand-gradient icon chips.
const ACCENT_CHIP = "brand-gradient text-white shadow-lg shadow-indigo-900/40";

export function DarkCard({ as: Component = "div", className = "", children, ...props }) {
  return (
    <Component
      className={`rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-sm transition-colors duration-300 hover:border-white/20 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

// Same surface, no padding — for wrapping a table.
export function DarkPanelCard({ className = "", children, ...props }) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-sm transition-colors duration-300 hover:border-white/20 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function DarkCardHeader({ icon, title, subtitle, action, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${ACCENT_CHIP}`}>{icon}</span>}
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// icon + title header baked in, matching Dashboard's SectionCard exactly.
export function DarkSectionCard({ icon, title, subtitle, action, className = "", children }) {
  return (
    <DarkCard className={className}>
      <DarkCardHeader icon={icon} title={title} subtitle={subtitle} action={action} />
      <div className="mt-4">{children}</div>
    </DarkCard>
  );
}

export function DarkEmptyState({ title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 px-4 py-10 text-center ${className}`}>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="max-w-sm text-xs text-zinc-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
