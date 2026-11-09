import { useEffect } from "react";
import type { SheetData } from "../types";
import { useVirtualRows } from "../lib/useVirtualRows";
import { Highlight } from "./Highlight";
import { SearchIcon, TableIcon } from "./Icons";

const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 36;

interface RecordTableProps {
  sheet: SheetData;
  rowIndices: number[];
  query: string;
  selectedRow: number | null;
  hiddenFields: Set<string>;
  onOpenRow: (rowIndex: number) => void;
}

export function RecordTable({
  sheet,
  rowIndices,
  query,
  selectedRow,
  hiddenFields,
  onOpenRow,
}: RecordTableProps) {
  const visibleColumns = sheet.headers
    .map((header, index) => ({ header, index }))
    .filter((column) => !hiddenFields.has(column.header));
  const columnCount = Math.max(visibleColumns.length, 1);
  const template =
    columnCount > 1
      ? "minmax(180px, 1.6fr) repeat(" +
        (columnCount - 1) +
        ", minmax(110px, 1fr))"
      : "minmax(180px, 1fr)";
  const minWidth = 180 + Math.max(0, columnCount - 1) * 110;
  const virtual = useVirtualRows(rowIndices.length, ROW_HEIGHT, HEADER_HEIGHT, 10);
  const allHidden = visibleColumns.length === 0;

  useEffect(() => {
    const element = virtual.ref.current;
    if (element) element.scrollTop = 0;
  }, [rowIndices, visibleColumns.length, virtual.ref]);

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
                    key={column.header + column.index}
                    className="th"
                    title={column.header}
                  >
                    {column.header}
                  </div>
                ))}
              </div>

              {rowIndices.length > 0 ? (
                <div className="table-body" style={{ height: virtual.totalHeight }}>
                  {rowIndices.slice(virtual.start, virtual.end).map((rowIndex, offset) => {
                    const row = sheet.rows[rowIndex] || [];
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
                          const value = row[column.index] || "";
                          return (
                            <div
                              key={column.header + column.index}
                              className={
                                "cell" + (visibleIndex === 0 ? " cell-primary" : "")
                              }
                              title={value}
                            >
                              {value ? (
                                <Highlight text={value} query={query} />
                              ) : (
                                <span className="cell-empty">—</span>
                              )}
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
    </div>
  );
}
