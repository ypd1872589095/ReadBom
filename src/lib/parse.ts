import * as XLSX from "xlsx";
import type { SheetColumn, SheetData, WorkbookData } from "../types";

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

function headerUnit(header: string): string {
  if (/万元|（万）|\(万\)/.test(header)) return "万元";
  if (/%|％/.test(header)) return "%";
  if (/元/.test(header)) return "元";
  return "";
}

function formatUnit(format: string): string {
  if (!format) return "";
  if (format.includes("%")) return "%";
  if (/万/.test(format)) return "万元";
  if (/元|¥|￥/.test(format)) return "元";
  return "";
}

function extractSheet(ws: XLSX.WorkSheet, name: string): SheetData | null {
  const ref = ws["!ref"];
  if (!ref) return null;

  const range = XLSX.utils.decode_range(ref);
  if (range.e.r - range.s.r + 1 > MAX_ROWS) {
    throw new Error("工作表超过 20 万行，浏览器无法流畅处理");
  }

  normalizeDateFormats(ws);

  const displayMatrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as unknown[][];
  const rawMatrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  }) as unknown[][];

  const matrix = displayMatrix.map((row) =>
    Array.from(Array.isArray(row) ? row : [], (value) => toText(value))
  );
  fillMerges(ws, matrix, range.s.r, range.s.c);
  if (matrix.length === 0) return null;

  const headerIndex = detectHeaderRow(matrix);
  const header = matrix[headerIndex] || [];
  const dataRowIndices: number[] = [];
  for (let r = headerIndex + 1; r < matrix.length; r++) {
    if (matrix[r] && matrix[r].some((value) => value !== "")) dataRowIndices.push(r);
  }
  if (dataRowIndices.length === 0) return null;

  let width = 0;
  for (const row of matrix) {
    if (row.length > width) width = row.length;
  }
  if (width === 0) return null;

  const used = new Array<boolean>(width).fill(false);
  for (let c = 0; c < header.length; c++) {
    if (header[c]) used[c] = true;
  }
  for (const r of dataRowIndices) {
    const row = matrix[r];
    for (let c = 0; c < width; c++) {
      if (row[c]) used[c] = true;
    }
  }

  const headers: string[] = [];
  const sourceColumns: number[] = [];
  const seen = new Map<string, number>();
  for (let c = 0; c < width; c++) {
    if (!used[c]) continue;
    const base = header[c] ? header[c] : "列 " + (c + 1);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    headers.push(count === 1 ? base : base + " (" + count + ")");
    sourceColumns.push(c);
  }
  if (headers.length === 0) return null;

  const rows: string[][] = dataRowIndices.map((r) =>
    sourceColumns.map((c) => (matrix[r] && matrix[r][c]) || "")
  );
  if (rows.length === 0) return null;

  const columns: SheetColumn[] = [];
  const columnValues: (number | null)[][] = [];

  for (let index = 0; index < sourceColumns.length; index++) {
    const sourceCol = sourceColumns[index];
    const name = headers[index];
    const values: (number | null)[] = [];
    let numericCount = 0;
    let textCount = 0;
    let dateCount = 0;
    let emptyCount = 0;

    for (const r of dataRowIndices) {
      const raw = rawMatrix[r] ? rawMatrix[r][sourceCol] : null;
      const display = (matrix[r] && matrix[r][sourceCol]) || "";
      if (typeof raw === "number" && Number.isFinite(raw)) {
        values.push(raw);
        numericCount++;
      } else if (raw instanceof Date) {
        values.push(null);
        dateCount++;
      } else if (!display && (raw === null || raw === undefined || raw === "")) {
        values.push(null);
        emptyCount++;
      } else {
        values.push(null);
        textCount++;
      }
    }

    let detectedUnit = "";
    let percentHits = 0;
    let sampled = 0;
    for (const r of dataRowIndices) {
      if (sampled >= 80) break;
      const cell = ws[
        XLSX.utils.encode_cell({
          r: range.s.r + r,
          c: range.s.c + sourceCol,
        })
      ] as XLSX.CellObject | undefined;
      if (!cell) continue;
      sampled++;
      const format = typeof cell.z === "string" ? cell.z : "";
      if (format.includes("%")) percentHits++;
      if (!detectedUnit) detectedUnit = formatUnit(format);
    }

    const fromHeader = headerUnit(name);
    const percent =
      fromHeader === "%" || percentHits > 0 || (sampled > 0 && detectedUnit === "%");
    const unitLabel = percent ? "%" : fromHeader || detectedUnit;
    const numeric = numericCount > 0 && textCount === 0 && dateCount === 0;

    columns.push({
      name,
      index,
      numeric,
      percent,
      unitLabel,
      numericCount,
      textCount,
      dateCount,
      emptyCount,
    });
    columnValues.push(values);
  }

  const numbers: (number | null)[][] = dataRowIndices.map((_, rowPosition) =>
    columnValues.map((values) => values[rowPosition] ?? null)
  );

  return {
    name,
    headers,
    rows,
    numbers,
    columns,
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
