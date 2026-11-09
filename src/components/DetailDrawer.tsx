import type { SheetData } from "../types";
import { ChevronRightIcon, CloseIcon } from "./Icons";
import { Highlight } from "./Highlight";

interface DetailDrawerProps {
  sheet: SheetData;
  rowIndex: number;
  position: number;
  total: number;
  query: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function DetailDrawer({
  sheet,
  rowIndex,
  position,
  total,
  query,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: DetailDrawerProps) {
  const row = sheet.rows[rowIndex] || [];

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="记录详情">
        <header className="drawer-head">
          <div>
            <div className="drawer-eyebrow">记录详情</div>
            <div className="drawer-title">
              第 {position} 条 <span>/ 共 {total} 条</span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon size={15} />
          </button>
        </header>

        <div className="drawer-body">
          {sheet.headers.map((header, index) => {
            const value = row[index] || "";
            return (
              <div className="field" key={header + index}>
                <div className="field-label">{header}</div>
                <div className={"field-value" + (value ? "" : " is-empty")}>
                  {value ? <Highlight text={value} query={query} /> : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="drawer-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onPrev}
            disabled={!hasPrev}
          >
            <ChevronRightIcon size={12} className="flip-horizontal" />
            上一条
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onNext}
            disabled={!hasNext}
          >
            下一条
            <ChevronRightIcon size={12} />
          </button>
        </footer>
      </aside>
    </div>
  );
}
