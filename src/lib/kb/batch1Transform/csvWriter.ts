function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function recordsToCsv(headers: readonly string[], rows: Array<Record<string, string>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}
