export function ErrorMessage({ error, className = "" }) {
  if (!error) return null;
  const message = typeof error === "string" ? error : error.message;
  return <p className={`text-sm text-red-600 ${className}`}>{message}</p>;
}
