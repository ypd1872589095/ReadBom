import type { SheetData } from "../types";

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "readtree";
}

export function exportSheetAsCsv(
  sheet: SheetData,
  rowIndices: number[],
  name: string
): void {
  const lines = [sheet.headers.map(escapeCell).join(",")];
  for (const rowIndex of rowIndices) {
    lines.push((sheet.rows[rowIndex] || []).map(escapeCell).join(","));
  }

  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName(name) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
