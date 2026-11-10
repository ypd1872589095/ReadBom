export interface SheetColumn {
  name: string;
  index: number;
  numeric: boolean;
  percent: boolean;
  unitLabel: string;
  numericCount: number;
  textCount: number;
  dateCount: number;
  emptyCount: number;
}

export interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
  numbers: (number | null)[][];
  columns: SheetColumn[];
  headerRow: number;
  totalRows: number;
}

export interface WorkbookData {
  fileName: string;
  sheets: SheetData[];
}

export interface Dimension {
  field: string;
  split: boolean;
}

export interface TreeConfig {
  dimensions: Dimension[];
  emptyLabel: string;
}

export interface TreeAncestor {
  id: string;
  label: string;
}

export interface TreeNode {
  id: string;
  label: string;
  level: number;
  count: number;
  children: TreeNode[];
  rowIndices: number[];
  ancestors: TreeAncestor[];
}

export interface ComputedDefinition {
  id: string;
  name: string;
  expression: string;
}

export interface ComputedResult {
  id: string;
  name: string;
  values: (number | null)[];
  warnings: string[];
  error?: string;
}

export interface SummaryItem {
  key: string;
  label: string;
  value: number;
  valid: number;
  total: number;
}
