import type { SheetData, TreeConfig, TreeNode } from "../types";

const SEP = "\u001f";
const collator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });

export interface TreeResult {
  root: TreeNode;
  index: Map<string, TreeNode>;
}

interface ValuePart {
  key: string;
  label: string;
}

function splitValue(raw: string, split: boolean, emptyLabel: string): ValuePart[] {
  const value = raw.trim();
  if (!value) return [{ key: "\u0000", label: emptyLabel }];

  if (!split) {
    return [{ key: value.toLocaleLowerCase(), label: value }];
  }

  const parts = value
    .split(/[、,，;；|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [{ key: value.toLocaleLowerCase(), label: value }];
  }

  const seen = new Set<string>();
  const result: ValuePart[] = [];
  for (const part of parts) {
    const key = part.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ key, label: part });
    }
  }
  return result;
}

export function buildTree(
  sheet: SheetData,
  config: TreeConfig,
  subset?: number[]
): TreeResult {
  const root: TreeNode = {
    id: "root",
    label: "全部",
    level: 0,
    count: 0,
    children: [],
    rowIndices: [],
    ancestors: [],
  };

  const dims = config.dimensions
    .map((dimension) => ({
      split: dimension.split,
      field: dimension.field,
      column: sheet.headers.indexOf(dimension.field),
    }))
    .filter((dimension) => dimension.column >= 0);

  const rowIndices = subset ? subset.slice() : sheet.rows.map((_, index) => index);
  root.count = rowIndices.length;
  root.rowIndices = rowIndices.slice();

  const index = new Map<string, TreeNode>();
  index.set(root.id, root);
  if (dims.length === 0) return { root, index };

  for (const rowIndex of rowIndices) {
    const row = sheet.rows[rowIndex];
    if (!row) continue;

    let parents: TreeNode[] = [root];
    for (const dimension of dims) {
      const values = splitValue(
        row[dimension.column] || "",
        dimension.split,
        config.emptyLabel
      );
      const next: TreeNode[] = [];

      for (const parent of parents) {
        for (const value of values) {
          const id = parent.id + SEP + value.key;
          let child = index.get(id);
          if (!child) {
            child = {
              id,
              label: value.label,
              level: parent.level + 1,
              count: 0,
              children: [],
              rowIndices: [],
              ancestors:
                parent.id === "root"
                  ? [{ id: root.id, label: root.label }]
                  : parent.ancestors.concat([{ id: parent.id, label: parent.label }]),
            };
            parent.children.push(child);
            index.set(id, child);
          }
          child.count += 1;
          child.rowIndices.push(rowIndex);
          next.push(child);
        }
      }

      parents = next;
      if (parents.length === 0) break;
    }
  }

  sortTree(root);
  return { root, index };
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => collator.compare(a.label, b.label));
  for (const child of node.children) sortTree(child);
}

export function flattenVisible(root: TreeNode, expanded: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (node: TreeNode) => {
    result.push(node);
    if (expanded.has(node.id)) {
      for (const child of node.children) walk(child);
    }
  };
  walk(root);
  return result;
}
