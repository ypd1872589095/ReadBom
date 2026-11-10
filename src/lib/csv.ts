import type { ComputedResult, SheetData } from "../types";
import { formatComputedCsv } from "./format";

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
  name: string,
  computed: ComputedResult[] = []
): void {
  const validComputed = computed.filter((column) => !column.error);
  const headers = sheet.headers.concat(validComputed.map((column) => column.name));
  const lines = [headers.map(escapeCell).join(",")];
  for (const rowIndex of rowIndices) {
    const base = sheet.rows[rowIndex] || [];
    const calculated = validComputed.map((column) =>
      formatComputedCsv(column.values[rowIndex])
    );
    lines.push(base.concat(calculated).map(escapeCell).join(","));
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
