import { useEffect, type ReactNode } from "react";
import type {
  ComputedResult,
  SheetData,
  SummaryItem,
} from "../types";
import { formatComputedValue } from "../lib/format";
import { useVirtualRows } from "../lib/useVirtualRows";
import { Highlight } from "./Highlight";
import { SearchIcon, TableIcon } from "./Icons";

const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 36;

type TableColumn =
  | { key: string; label: string; kind: "base"; index: number }
  | {
      key: string;
      label: string;
      kind: "computed";
      result: ComputedResult;
    };

interface RecordTableProps {
  sheet: SheetData;
  rowIndices: number[];
  query: string;
  selectedRow: number | null;
  hiddenFields: Set<string>;
  computed: ComputedResult[];
  summary: SummaryItem[];
  onOpenRow: (rowIndex: number) => void;
}

export function RecordTable({
  sheet,
  rowIndices,
  query,
  selectedRow,
  hiddenFields,
  computed,
  summary,
  onOpenRow,
}: RecordTableProps) {
  const baseColumns: TableColumn[] = sheet.headers
    .map((header, index) => ({
      key: "base:" + header + ":" + index,
      label: header,
      kind: "base" as const,
      index,
    }))
    .filter((column) => !hiddenFields.has(column.label));

  const computedColumns: TableColumn[] = computed
    .filter((column) => !column.error)
    .map((column) => ({
      key: "computed:" + column.id,
      label: column.name,
      kind: "computed" as const,
      result: column,
    }));

  const visibleColumns = baseColumns.concat(computedColumns);
  const columnCount = Math.max(visibleColumns.length, 1);
  const template =
    columnCount > 1
      ? "minmax(180px, 1.6fr) repeat(" +
        (columnCount - 1) +
        ", minmax(108px, 1fr))"
      : "minmax(180px, 1fr)";
  const minWidth = 180 + Math.max(0, columnCount - 1) * 108;
  const virtual = useVirtualRows(rowIndices.length, ROW_HEIGHT, HEADER_HEIGHT, 10);
  const allHidden = visibleColumns.length === 0;

  useEffect(() => {
    const element = virtual.ref.current;
    if (element) element.scrollTop = 0;
  }, [rowIndices, visibleColumns.length, virtual.ref]);

  const renderCell = (column: TableColumn, rowIndex: number): ReactNode => {
    if (column.kind === "base") {
      const value = sheet.rows[rowIndex]?.[column.index] || "";
      return value ? (
        <Highlight text={value} query={query} />
      ) : (
        <span className="cell-empty">—</span>
      );
    }
    const value = formatComputedValue(column.result.values[rowIndex]);
    return value === "—" ? <span className="cell-empty">—</span> : value;
  };

  return (
    <div className="table-card">
      <div className="table-scroll" ref={virtual.ref} onScroll={virtual.onScroll}>
        <div className="table-inner" style={{ minWidth: minWidth }}>
          {allHidden ? (
            <div className="table-empty">
              <span className="table-empty-icon">
                <TableIcon size={22} />
              </span>
              <div className="table-empty-title">分类字段已全部隐藏</div>
              <div className="table-empty-sub">
                关闭工具栏的“隐藏分类列”即可显示全部字段
              </div>
            </div>
          ) : (
            <>
              <div className="table-head" style={{ gridTemplateColumns: template }}>
                {visibleColumns.map((column) => (
                  <div
                    key={column.key}
                    className={
                      "th" + (column.kind === "computed" ? " th-computed" : "")
                    }
                    title={
                      column.kind === "computed" && column.result.warnings.length
                        ? column.result.warnings.join("；")
                        : column.label
                    }
                  >
                    {column.kind === "computed" ? (
                      <>
                        <span className="fx-mark">ƒx</span>
                        {column.label}
                        {column.result.warnings.length > 0 ? (
                          <span className="computed-warning-dot" title={column.result.warnings.join("；")}>
                            !
                          </span>
                        ) : null}
                      </>
                    ) : (
                      column.label
                    )}
                  </div>
                ))}
              </div>

              {rowIndices.length > 0 ? (
                <div className="table-body" style={{ height: virtual.totalHeight }}>
                  {rowIndices.slice(virtual.start, virtual.end).map((rowIndex, offset) => {
                    const selected = selectedRow === rowIndex;
                    return (
                      <div
                        key={rowIndex}
                        className={"table-row" + (selected ? " is-selected" : "")}
                        style={{
                          top: (virtual.start + offset) * ROW_HEIGHT,
                          gridTemplateColumns: template,
                        }}
                        onClick={() => onOpenRow(rowIndex)}
                      >
                        {visibleColumns.map((column, visibleIndex) => {
                          const title =
                            column.kind === "base"
                              ? sheet.rows[rowIndex]?.[column.index] || ""
                              : formatComputedValue(column.result.values[rowIndex]);
                          return (
                            <div
                              key={column.key}
                              className={
                                "cell" +
                                (visibleIndex === 0 ? " cell-primary" : "") +
                                (column.kind === "computed" ? " cell-computed" : "")
                              }
                              title={title}
                            >
                              {renderCell(column, rowIndex)}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-empty">
                  <span className="table-empty-icon">
                    {query ? <SearchIcon size={20} /> : <TableIcon size={22} />}
                  </span>
                  <div className="table-empty-title">
                    {query ? "没有匹配的记录" : "这个分类下还没有记录"}
                  </div>
                  <div className="table-empty-sub">
                    {query ? "换一个关键词试试，或清除搜索" : "换一个分类看看"}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {summary.length > 0 ? (
        <div className="table-summary">
          {summary.map((item) => (
            <span className="summary-item" key={item.key}>
              <span className="summary-label">{item.label}</span>
              <strong className="summary-value">{formatComputedValue(item.value)}</strong>
              <span className="summary-valid">
                {item.valid}/{item.total} 行
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
