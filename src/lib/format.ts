const numberFormat = new Intl.NumberFormat("zh-CN");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

const computedFormat = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 6,
  useGrouping: true,
});

const computedCsvFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
  useGrouping: false,
});

export function formatComputedValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return computedFormat.format(Object.is(value, -0) ? 0 : value);
}

export function formatComputedCsv(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return computedCsvFormat.format(Object.is(value, -0) ? 0 : value);
}
