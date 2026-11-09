export interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
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
