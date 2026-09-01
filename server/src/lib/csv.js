// A field needs quoting if it contains the delimiter, a quote, or a line break — anything else
// is safe to write as-is. Quotes inside a quoted field are escaped by doubling them, per RFC 4180.
//
// A value starting with =, +, -, @, or a tab/CR gets a leading apostrophe first — Excel/Sheets
// otherwise treat it as a formula to evaluate rather than text, which turns any user-supplied
// field that ends up in a CSV (a waiter's display name, a void reason, ...) into a formula-
// injection vector against whoever opens the export. The apostrophe forces it to display as
// literal text instead.
function escapeField(value) {
  let str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Hand-rolled instead of a library — this data is already flat rows of plain
// strings/numbers/dates, nothing nested or streamed, so a two-line escape-and-join covers it.
export function toCsv(columns, rows) {
  const lines = [columns.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeField).join(","));
  }
  return lines.join("\r\n");
}
