import type { SheetData, TreeConfig } from "../types";

const PREFIX = "readtree.config.v1.";

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
      .slice(0, 5)
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
        dimensions: config.dimensions.slice(0, 5),
        emptyLabel: config.emptyLabel || "(空)",
      })
    );
  } catch {
    // Private mode or file:// restrictions: remembering config is optional.
  }
}
