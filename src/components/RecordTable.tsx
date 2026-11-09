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
  onOpenRow: (rowIndex: number) => void;
}

export function RecordTable({
  sheet,
  rowIndices,
  query,
  selectedRow,
  onOpenRow,
}: RecordTableProps) {
  const headers = sheet.headers;
  const columns = Math.max(headers.length, 1);
  const template =
    columns > 1
      ? "minmax(180px, 1.6fr) repeat(" +
        (columns - 1) +
        ", minmax(110px, 1fr))"
      : "minmax(180px, 1fr)";
  const minWidth = 180 + Math.max(0, columns - 1) * 110;
  const virtual = useVirtualRows(rowIndices.length, ROW_HEIGHT, HEADER_HEIGHT, 10);

  useEffect(() => {
    const element = virtual.ref.current;
    if (element) element.scrollTop = 0;
  }, [rowIndices, virtual.ref]);

  return (
    <div className="table-card">
      <div className="table-scroll" ref={virtual.ref} onScroll={virtual.onScroll}>
        <div className="table-inner" style={{ minWidth: minWidth }}>
          <div className="table-head" style={{ gridTemplateColumns: template }}>
            {headers.map((header, index) => (
              <div key={header + index} className="th" title={header}>
                {header}
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
                    {headers.map((header, columnIndex) => {
                      const value = row[columnIndex] || "";
                      return (
                        <div
                          key={header + columnIndex}
                          className={"cell" + (columnIndex === 0 ? " cell-primary" : "")}
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
        </div>
      </div>
    </div>
  );
}
