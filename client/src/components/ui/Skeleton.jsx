export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

// A handful of skeleton row shapes, sized to stand in for the real content while it loads —
// used instead of a bare "Loading…" string so the page doesn't jump when data lands.
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? "w-1/4" : "flex-1 max-w-[10rem]"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}
