import type { RefObject } from "react";
import type { SheetData } from "../types";
import { formatNumber } from "../lib/format";
import {
  ChevronRightIcon,
  CloseIcon,
  FileSpreadsheetIcon,
  LogoIcon,
  SearchIcon,
  SlidersIcon,
  UploadIcon,
} from "./Icons";

interface TopBarProps {
  fileName: string;
  sheets: SheetData[];
  sheetIndex: number;
  dimensionCount: number;
  computedCount: number;
  autoRefresh: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSheetChange: (index: number) => void;
  onPickFile: () => void;
  onOpenConfig: () => void;
  onOpenComputed: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function TopBar({
  fileName,
  sheets,
  sheetIndex,
  dimensionCount,
  computedCount,
  autoRefresh,
  query,
  onQueryChange,
  onSheetChange,
  onPickFile,
  onOpenConfig,
  onOpenComputed,
  searchRef,
}: TopBarProps) {
  const sheet = sheets[sheetIndex];

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <LogoIcon size={18} />
        </span>
        <span className="brand-name">ReadTree</span>
      </div>

      <span className="topbar-divider" />

      <div className="file-cluster">
        <span className="file-icon">
          <FileSpreadsheetIcon size={17} />
        </span>
        <div className="file-meta">
          <div className="file-name-line">
            <div className="file-name" title={fileName}>
              {fileName}
            </div>
            {autoRefresh ? (
              <span className="live-badge" title="文件保存后会自动刷新">
                <span className="live-dot" />
                自动刷新
              </span>
            ) : null}
          </div>
          <div className="file-sub">
            {sheet.name} · {formatNumber(sheet.totalRows)} 行 · {sheet.headers.length} 列
          </div>
        </div>

        {sheets.length > 1 ? (
          <span className="select-wrap">
            <select
              className="sheet-select"
              value={sheetIndex}
              onChange={(event) => onSheetChange(Number(event.target.value))}
              aria-label="切换工作表"
              title="切换工作表"
            >
              {sheets.map((item, index) => (
                <option key={item.name + index} value={index}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="select-arrow">
              <ChevronRightIcon size={11} />
            </span>
          </span>
        ) : null}

        <button type="button" className="ghost-btn" onClick={onPickFile} title="更换文件">
          <UploadIcon size={13} />
          更换
        </button>
      </div>

      <div className="topbar-spacer" />

      <label className="search-box">
        <SearchIcon size={14} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索所有字段"
          aria-label="搜索所有字段"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => onQueryChange("")}
            aria-label="清除搜索"
            title="清除搜索"
          >
            <CloseIcon size={11} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </label>

      <button type="button" className="field-button" onClick={onOpenConfig} title="选择分类字段">
        <SlidersIcon size={14} />
        <span>分类字段</span>
        <span className="field-count">{dimensionCount}</span>
      </button>

      <button type="button" className="field-button" onClick={onOpenComputed} title="计算列">
        <span className="fx-mark">ƒx</span>
        <span>计算列</span>
        {computedCount > 0 ? <span className="field-count">{computedCount}</span> : null}
      </button>
    </header>
  );
}

