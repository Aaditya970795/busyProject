import { statusStyle } from "../lib/statusStyles";

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset transition-colors duration-300 ${statusStyle(status).badge}`}
    >
      {status}
    </span>
  );
}
