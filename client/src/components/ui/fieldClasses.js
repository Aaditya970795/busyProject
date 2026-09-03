// Shared control chrome for Input/Select/Textarea — one focus ring, one error state, everywhere.
// `tone` picks the whole color set at once (never mix-and-match via className, which risks
// class-order conflicts): "light" for the white cards/forms on Login/Landing, "dark" for every
// card on the app's dark pages (Dashboard, Menu, Tables, Orders, Alerts, Team) — see DarkInput.jsx.
const TONE_CLASSES = {
  light: {
    base: "text-slate-900 disabled:bg-slate-50 disabled:text-slate-500",
    normal: "border-slate-300 bg-white focus:border-indigo-500 focus:ring-indigo-500",
    error: "border-red-300 bg-white focus:border-red-500 focus:ring-red-500",
  },
  dark: {
    base: "bg-white/5 text-white placeholder:text-zinc-500 disabled:bg-white/[0.03] disabled:text-zinc-500",
    normal: "border-white/15 focus:border-indigo-400 focus:ring-indigo-400",
    error: "border-red-400/40 focus:border-red-400 focus:ring-red-400",
  },
};

export function controlClasses({ error, className = "", tone = "light" }) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.light;
  const base = `mt-1 w-full rounded-md border px-3 py-2 text-sm transition-colors duration-150 focus:outline-none focus:ring-1 disabled:cursor-not-allowed ${t.base}`;
  return `${base} ${error ? t.error : t.normal} ${className}`;
}

// Color defaults to text-slate-700 (correct on the white cards/forms almost every label sits
// on); pass `className` only for the rare label that sits directly on the dark app-shell
// background instead — it replaces the color rather than stacking with it.
export function labelClasses({ className = "" } = {}) {
  return `block text-sm font-medium ${className || "text-slate-700"}`;
}
export const errorTextClasses = "mt-1 text-xs text-red-600";
