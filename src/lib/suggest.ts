import type { Dimension, SheetData } from "../types";

export function suggestDimensions(sheet: SheetData, limit = 2): Dimension[] {
  const sampleSize = Math.min(sheet.rows.length, 400);
  if (sampleSize === 0) return [];

  const candidates: Array<{ field: string; index: number; unique: number }> = [];
  const maxUnique = Math.max(5, Math.min(30, Math.floor(sampleSize * 0.4)));

  for (let c = 0; c < sheet.headers.length; c++) {
    const values = new Set<string>();
    for (let r = 0; r < sampleSize; r++) {
      const value = sheet.rows[r][c];
      if (value) values.add(value.toLocaleLowerCase());
    }
    if (values.size >= 2 && values.size <= maxUnique && values.size < sampleSize) {
      candidates.push({ field: sheet.headers[c], index: c, unique: values.size });
    }
  }

  if (candidates.length === 0) return [];

  // Keep the first useful column as the primary grouping, then prefer the
  // columns with the fewest distinct values for the deeper levels.
  const primary = candidates.reduce((best, item) =>
    item.index < best.index ? item : best
  );
  const rest = candidates
    .filter((item) => item !== primary)
    .sort((a, b) => a.unique - b.unique || a.index - b.index);

  return [primary, ...rest]
    .slice(0, limit)
    .map((candidate) => ({ field: candidate.field, split: false }));
}
