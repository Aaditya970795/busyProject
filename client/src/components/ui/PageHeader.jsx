export function PageHeader({ title, subtitle, action, icon }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
