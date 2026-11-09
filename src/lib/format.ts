const numberFormat = new Intl.NumberFormat("zh-CN");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
