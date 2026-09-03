const VARIANT_CLASSES = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-indigo-600",
  secondary:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-400",
  // Same role as "secondary" but for the dark-themed pages (Dashboard, Menu, Tables, Orders,
  // Alerts, Team) — a light card floating on a dark surface reads as "light mode leaking in".
  secondaryDark:
    "border border-white/15 bg-white/5 text-zinc-200 shadow-sm hover:border-white/25 hover:bg-white/10 focus-visible:outline-white/40",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-slate-400",
  ghostDark: "text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-white/40",
};

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

function Spinner({ className = "" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" width="14" height="14" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Shared everywhere a clickable action appears — buttons, and (via buttonClasses) the odd Link
// styled as a button — so hover/focus/disabled states never drift page to page.
export function buttonClasses({ variant = "primary", size = "md", className = "" } = {}) {
  return `inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
