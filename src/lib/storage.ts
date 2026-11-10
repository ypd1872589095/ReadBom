import type { ComputedDefinition, SheetData, TreeConfig } from "../types";
import { MAX_DIMENSIONS } from "../constants";

const PREFIX = "readtree.config.v1.";
const COMPUTED_PREFIX = "readtree.computed.v1.";
const SUMMARY_PREFIX = "readtree.summary.v1.";

function hashHeaders(headers: string[]): string {
  const text = headers.join("\u001f");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function keyFor(sheet: SheetData): string {
  return PREFIX + hashHeaders(sheet.headers);
}

export function loadConfig(sheet: SheetData): TreeConfig | null {
  try {
    const raw = window.localStorage.getItem(keyFor(sheet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TreeConfig>;
    if (!parsed || !Array.isArray(parsed.dimensions)) return null;

    const fields = new Set(sheet.headers);
    const dimensions = parsed.dimensions
      .filter(
        (dimension) =>
          dimension &&
          typeof dimension.field === "string" &&
          fields.has(dimension.field)
      )
      .slice(0, MAX_DIMENSIONS)
      .map((dimension) => ({
        field: dimension.field,
        split: Boolean(dimension.split),
      }));

    return {
      dimensions,
      emptyLabel:
        typeof parsed.emptyLabel === "string" && parsed.emptyLabel
          ? parsed.emptyLabel
          : "(空)",
    };
  } catch {
    return null;
  }
}

export function saveConfig(sheet: SheetData, config: TreeConfig): void {
  try {
    window.localStorage.setItem(
      keyFor(sheet),
      JSON.stringify({
        dimensions: config.dimensions.slice(0, MAX_DIMENSIONS),
        emptyLabel: config.emptyLabel || "(空)",
      })
    );
  } catch {
    // Private mode or file:// restrictions: remembering config is optional.
  }
}

function computedKeyFor(sheet: SheetData): string {
  return COMPUTED_PREFIX + hashHeaders(sheet.headers);
}

function summaryKeyFor(sheet: SheetData): string {
  return SUMMARY_PREFIX + hashHeaders(sheet.headers);
}

export function loadComputedDefs(sheet: SheetData): ComputedDefinition[] {
  try {
    const raw = window.localStorage.getItem(computedKeyFor(sheet));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const names = new Set<string>();
    const result: ComputedDefinition[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Partial<ComputedDefinition>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const expression =
        typeof candidate.expression === "string" ? candidate.expression.trim() : "";
      if (!id || !name || !expression || names.has(name)) continue;
      names.add(name);
      result.push({ id, name, expression });
      if (result.length >= 30) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function saveComputedDefs(
  sheet: SheetData,
  definitions: ComputedDefinition[]
): void {
  try {
    window.localStorage.setItem(
      computedKeyFor(sheet),
      JSON.stringify(definitions.slice(0, 30))
    );
  } catch {
    // Persistence is optional in restricted browser contexts.
  }
}

export function loadSummaryColumns(sheet: SheetData): string[] {
  try {
    const raw = window.localStorage.getItem(summaryKeyFor(sheet));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const name = item.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push(name);
    }
    return result;
  } catch {
    return [];
  }
}

export function saveSummaryColumns(sheet: SheetData, names: string[]): void {
  try {
    window.localStorage.setItem(
      summaryKeyFor(sheet),
      JSON.stringify(names.slice(0, 12))
    );
  } catch {
    // Persistence is optional in restricted browser contexts.
  }
}
