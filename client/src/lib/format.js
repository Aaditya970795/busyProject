const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value));
}

// Renders a minute count as whichever unit actually reads naturally — "42m", "3h 5m", "1d 4h" —
// instead of ever showing a raw count like "2814m" for something that's been open nearly two days.
export function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes}m`;

  const totalHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (totalHours < 24) {
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
