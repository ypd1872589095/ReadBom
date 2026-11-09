import * as XLSX from "xlsx";
import type { SheetData, WorkbookData } from "../types";

const MAX_ROWS = 200000;

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const date =
      value.getFullYear() + "-" + pad2(value.getMonth() + 1) + "-" + pad2(value.getDate());
    if (value.getHours() === 0 && value.getMinutes() === 0) return date;
    return date + " " + pad2(value.getHours()) + ":" + pad2(value.getMinutes());
  }
  return String(value).trim();
}

function fillMerges(
  ws: XLSX.WorkSheet,
  matrix: string[][],
  startRow: number,
  startCol: number
): void {
  const merges = ws["!merges"];
  if (!merges || merges.length === 0) return;

  for (const merge of merges) {
    const r0 = merge.s.r - startRow;
    const c0 = merge.s.c - startCol;
    if (r0 < 0 || c0 < 0) continue;
    const value = matrix[r0] ? matrix[r0][c0] : "";
    if (!value) continue;

    const lastRow = Math.min(merge.e.r - startRow, matrix.length - 1);
    const lastCol = merge.e.c - startCol;
    for (let r = r0; r <= lastRow; r++) {
      const row = matrix[r];
      if (!row) continue;
      for (let c = c0; c <= lastCol; c++) {
        if (c >= 0 && !row[c]) row[c] = value;
      }
    }
  }
}

function normalizeDateFormats(ws: XLSX.WorkSheet): void {
  for (const key of Object.keys(ws)) {
    if (key.charCodeAt(0) === 33) continue;
    const cell = ws[key] as XLSX.CellObject | undefined;
    if (!cell || cell.t !== "d" || !(cell.v instanceof Date)) continue;

    const format = typeof cell.z === "string" ? cell.z : "";
    const hasTime = /[hs]/i.test(format);
    const hasSeconds = /s/i.test(format);
    cell.z = hasTime
      ? hasSeconds
        ? "yyyy-mm-dd hh:mm:ss"
        : "yyyy-mm-dd hh:mm"
      : "yyyy-mm-dd";
    delete cell.w;
  }
}

function detectHeaderRow(matrix: string[][]): number {
  const scan = Math.min(matrix.length, 30);
  for (let i = 0; i < scan; i++) {
    const seen = new Set<string>();
    for (const value of matrix[i]) {
      if (value) seen.add(value);
      if (seen.size >= 2) return i;
    }
  }
  for (let i = 0; i < matrix.length; i++) {
    for (const value of matrix[i]) {
      if (value) return i;
    }
  }
  return 0;
}

function extractSheet(ws: XLSX.WorkSheet, name: string): SheetData | null {
  const ref = ws["!ref"];
  if (!ref) return null;

  const range = XLSX.utils.decode_range(ref);
  if (range.e.r - range.s.r + 1 > MAX_ROWS) {
    throw new Error("工作表超过 20 万行，浏览器无法流畅处理");
  }

  normalizeDateFormats(ws);

  const rawMatrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as unknown[][];

  const matrix = rawMatrix.map((row) =>
    Array.from(Array.isArray(row) ? row : [], (value) => toText(value))
  );
  fillMerges(ws, matrix, range.s.r, range.s.c);
  if (matrix.length === 0) return null;

  const headerIndex = detectHeaderRow(matrix);
  const header = matrix[headerIndex] || [];
  const dataRows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => value !== ""));
  if (dataRows.length === 0) return null;

  let width = 0;
  for (const row of matrix) {
    if (row.length > width) width = row.length;
  }
  if (width === 0) return null;

  const used = new Array<boolean>(width).fill(false);
  for (let c = 0; c < header.length; c++) {
    if (header[c]) used[c] = true;
  }
  for (const row of dataRows) {
    for (let c = 0; c < width; c++) {
      if (row[c]) used[c] = true;
    }
  }

  const headers: string[] = [];
  const columns: number[] = [];
  const seen = new Map<string, number>();
  for (let c = 0; c < width; c++) {
    if (!used[c]) continue;
    const base = header[c] ? header[c] : "列 " + (c + 1);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    headers.push(count === 1 ? base : base + " (" + count + ")");
    columns.push(c);
  }
  if (headers.length === 0) return null;

  const rows: string[][] = [];
  for (const row of dataRows) {
    const record = columns.map((c) => row[c] || "");
    if (record.some((value) => value !== "")) rows.push(record);
  }
  if (rows.length === 0) return null;

  return {
    name,
    headers,
    rows,
    headerRow: headerIndex + 1,
    totalRows: rows.length,
  };
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string): WorkbookData {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      cellNF: true,
      cellText: false,
    });
  } catch {
    throw new Error("无法解析该文件，请确认它是有效的 Excel 文件");
  }

  const sheets: SheetData[] = [];
  for (const name of book.SheetNames) {
    const ws = book.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const sheet = extractSheet(ws, name);
    if (sheet) sheets.push(sheet);
  }

  if (sheets.length === 0) {
    throw new Error("没有找到可读取的数据，请检查表格是否包含表头和数据行");
  }

  return { fileName, sheets };
}
