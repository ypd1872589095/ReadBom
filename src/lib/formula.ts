import type {
  ComputedDefinition,
  ComputedResult,
  SheetColumn,
  SheetData,
} from "../types";

type BinaryOp = "+" | "-" | "*" | "/";

export type FormulaNode =
  | { type: "number"; value: number }
  | { type: "field"; name: string }
  | { type: "unary"; op: "-"; operand: FormulaNode }
  | { type: "binary"; op: BinaryOp; left: FormulaNode; right: FormulaNode };

export interface CompiledFormula {
  ast: FormulaNode;
  fields: string[];
}

export type CompileFormulaResult =
  | { ok: true; compiled: CompiledFormula }
  | { ok: false; error: string };

type Token =
  | { type: "number"; value: number }
  | { type: "field"; name: string }
  | { type: "op"; op: BinaryOp }
  | { type: "paren"; value: "(" | ")" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === "[") {
      const end = input.indexOf("]", index + 1);
      if (end < 0) throw new Error("列引用缺少右括号 ]");
      const name = input.slice(index + 1, end).trim();
      if (!name) throw new Error("列引用不能为空");
      tokens.push({ type: "field", name });
      index = end + 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index++;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "op", op: char });
      index++;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input.slice(index));
      if (!match) throw new Error("第 " + (index + 1) + " 个字符附近数字格式不正确");
      const value = Number(match[0]);
      if (!Number.isFinite(value)) throw new Error("数字超出范围");
      tokens.push({ type: "number", value });
      index += match[0].length;
      continue;
    }

    throw new Error("第 " + (index + 1) + " 个字符无法识别");
  }

  return tokens;
}

class FormulaParser {
  private position = 0;

  constructor(private tokens: Token[]) {}

  parse(): FormulaNode {
    if (this.tokens.length === 0) throw new Error("公式不能为空");
    const node = this.parseExpression(0);
    if (this.position < this.tokens.length) throw new Error("公式末尾有多余内容");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private parseExpression(minPrecedence: number): FormulaNode {
    let left = this.parseUnary();
    while (true) {
      const token = this.peek();
      if (!token || token.type !== "op") break;
      const precedence = token.op === "+" || token.op === "-" ? 1 : 2;
      if (precedence < minPrecedence) break;
      this.position++;
      const right = this.parseExpression(precedence + 1);
      left = { type: "binary", op: token.op, left, right };
    }
    return left;
  }

  private parseUnary(): FormulaNode {
    const token = this.peek();
    if (token && token.type === "op" && (token.op === "+" || token.op === "-")) {
      this.position++;
      const operand = this.parseUnary();
      return token.op === "-" ? { type: "unary", op: "-", operand } : operand;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaNode {
    const token = this.peek();
    if (!token) throw new Error("公式不完整");
    if (token.type === "number") {
      this.position++;
      return { type: "number", value: token.value };
    }
    if (token.type === "field") {
      this.position++;
      return { type: "field", name: token.name };
    }
    if (token.type === "paren" && token.value === "(") {
      this.position++;
      const node = this.parseExpression(0);
      const close = this.peek();
      if (!close || close.type !== "paren" || close.value !== ")") {
        throw new Error("括号不匹配");
      }
      this.position++;
      return node;
    }
    throw new Error("这里需要一个数字、列名或括号");
  }
}

function collectFields(node: FormulaNode, fields: Set<string>): void {
  if (node.type === "field") {
    fields.add(node.name);
  } else if (node.type === "unary") {
    collectFields(node.operand, fields);
  } else if (node.type === "binary") {
    collectFields(node.left, fields);
    collectFields(node.right, fields);
  }
}

export function compileFormula(expression: string): CompileFormulaResult {
  try {
    if (!expression.trim()) throw new Error("公式不能为空");
    const tokens = tokenize(expression);
    const ast = new FormulaParser(tokens).parse();
    const fields = new Set<string>();
    collectFields(ast, fields);
    return { ok: true, compiled: { ast, fields: Array.from(fields) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "公式格式不正确" };
  }
}

function evaluateNode(
  node: FormulaNode,
  resolve: (name: string) => number | null
): number | null {
  if (node.type === "number") {
    return Number.isFinite(node.value) ? node.value : null;
  }
  if (node.type === "field") {
    const value = resolve(node.name);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  if (node.type === "unary") {
    const value = evaluateNode(node.operand, resolve);
    return value === null ? null : -value;
  }

  const left = evaluateNode(node.left, resolve);
  if (left === null) return null;
  const right = evaluateNode(node.right, resolve);
  if (right === null) return null;

  let result: number;
  switch (node.op) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "*":
      result = left * right;
      break;
    default:
      if (right === 0) return null;
      result = left / right;
      break;
  }
  return Number.isFinite(result) ? result : null;
}

function unitOf(
  node: FormulaNode,
  units: Map<string, string>
): string {
  if (node.type === "number") return "";
  if (node.type === "field") return units.get(node.name) ?? "";
  if (node.type === "unary") return unitOf(node.operand, units);

  const left = unitOf(node.left, units);
  const right = unitOf(node.right, units);
  if (node.op === "+" || node.op === "-") {
    if (left && right && left !== right) return "";
    return left || right;
  }
  return "";
}

function collectUnitWarnings(
  node: FormulaNode,
  units: Map<string, string>,
  warnings: Set<string>
): void {
  if (node.type === "unary") {
    collectUnitWarnings(node.operand, units, warnings);
    return;
  }
  if (node.type === "binary") {
    collectUnitWarnings(node.left, units, warnings);
    collectUnitWarnings(node.right, units, warnings);
    if (node.op === "+" || node.op === "-") {
      const left = unitOf(node.left, units);
      const right = unitOf(node.right, units);
      if (left && right && left !== right) {
        warnings.add("单位不一致（" + left + " 和 " + right + "），按原始数值计算");
      }
    }
  }
}

class FormulaError extends Error {}

function errorResult(def: ComputedDefinition, message: string): ComputedResult {
  return {
    id: def.id,
    name: def.name,
    values: [],
    warnings: [],
    error: message,
  };
}

export function computeComputedColumns(
  sheet: SheetData,
  definitions: ComputedDefinition[]
): ComputedResult[] {
  if (definitions.length === 0) return [];

  const baseByName = new Map<string, SheetColumn>();
  for (const column of sheet.columns) baseByName.set(column.name, column);

  const nameCounts = new Map<string, number>();
  for (const def of definitions) {
    const name = def.name.trim();
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  const invalidNames = new Map<string, string>();
  for (const def of definitions) {
    const name = def.name.trim();
    if (!name) {
      invalidNames.set(name, "计算列名称不能为空");
    } else if (baseByName.has(name)) {
      invalidNames.set(name, "计算列名称与原始列重复");
    } else if ((nameCounts.get(name) || 0) > 1) {
      invalidNames.set(name, "计算列名称重复");
    }
  }

  const definitionByName = new Map<string, ComputedDefinition>();
  for (const def of definitions) {
    const name = def.name.trim();
    if (name && !invalidNames.has(name)) definitionByName.set(name, def);
  }

  const cache = new Map<string, ComputedResult>();
  const baseUnits = new Map<string, string>();
  for (const column of sheet.columns) baseUnits.set(column.name, column.unitLabel);

  function resolveDefinition(def: ComputedDefinition, stack: Set<string>): ComputedResult {
    const name = def.name.trim();
    const cached = cache.get(name || def.id);
    if (cached) return cached;

    if (!name) {
      const result = errorResult(def, "计算列名称不能为空");
      cache.set(def.id, result);
      return result;
    }

    const invalid = invalidNames.get(name);
    if (invalid) {
      const result = errorResult(def, invalid);
      cache.set(name, result);
      return result;
    }

    if (stack.has(name)) {
      const path = Array.from(stack).concat(name).join(" → ");
      throw new FormulaError("循环引用：" + path);
    }

    const compiled = compileFormula(def.expression);
    if (!compiled.ok) {
      const result = errorResult(def, compiled.error);
      cache.set(name, result);
      return result;
    }

    const dependencyValues = new Map<string, (number | null)[]>();
    const units = new Map<string, string>(baseUnits);

    try {
      for (const field of compiled.compiled.fields) {
        const base = baseByName.get(field);
        if (base) {
          if (!base.numeric) {
            const reason = base.textCount > 0
              ? "含文本单元格"
              : base.dateCount > 0
                ? "含日期单元格"
                : "没有可计算的数值";
            throw new FormulaError("列「" + field + "」不能参与计算：" + reason);
          }
          continue;
        }

        const dependency = definitionByName.get(field);
        if (!dependency) {
          const nameError = invalidNames.get(field);
          throw new FormulaError(
            nameError
              ? "列「" + field + "」无效：" + nameError
              : "找不到列「" + field + "」"
          );
        }

        if (field === name) {
          throw new FormulaError("循环引用：" + name + " → " + name);
        }

        const dependencyResult = resolveDefinition(
          dependency,
          new Set([...stack, name])
        );
        if (dependencyResult.error) {
          throw new FormulaError(
            "依赖列「" + field + "」无效：" + dependencyResult.error
          );
        }
        dependencyValues.set(field, dependencyResult.values);
        units.set(field, "");
      }

      for (const field of compiled.compiled.fields) {
        if (
          !baseByName.has(field) &&
          !definitionByName.has(field)
        ) {
          // Already handled above; kept for clarity.
          throw new FormulaError("找不到列「" + field + "」");
        }
      }

      const warnings = new Set<string>();
      collectUnitWarnings(compiled.compiled.ast, units, warnings);

      const values: (number | null)[] = new Array(sheet.rows.length).fill(null);
      for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
        const resolver = (field: string): number | null => {
          const base = baseByName.get(field);
          if (base) return sheet.numbers[rowIndex]?.[base.index] ?? null;
          const dependency = dependencyValues.get(field);
          if (dependency) return dependency[rowIndex] ?? null;
          return null;
        };
        values[rowIndex] = evaluateNode(compiled.compiled.ast, resolver);
      }

      const result: ComputedResult = {
        id: def.id,
        name,
        values,
        warnings: Array.from(warnings),
      };
      cache.set(name, result);
      return result;
    } catch (error) {
      const result = errorResult(
        def,
        error instanceof Error ? error.message : "计算列无法求值"
      );
      cache.set(name || def.id, result);
      return result;
    }
  }

  return definitions.map((def) => resolveDefinition(def, new Set()));
}
