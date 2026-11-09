import { useEffect, useMemo, useRef, useState } from "react";
import type { SheetData, TreeConfig } from "../types";
import { MAX_DIMENSIONS } from "../constants";
import { suggestDimensions } from "../lib/suggest";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
} from "./Icons";

interface FieldDialogProps {
  sheet: SheetData;
  initial: TreeConfig;
  onApply: (config: TreeConfig) => void;
  onClose: () => void;
}

export function FieldDialog({ sheet, initial, onApply, onClose }: FieldDialogProps) {
  const [draft, setDraft] = useState<TreeConfig>(() => ({
    dimensions: initial.dimensions.map((dimension) => ({ ...dimension })),
    emptyLabel: initial.emptyLabel,
  }));
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const samples = useMemo(
    () =>
      sheet.headers.map((_, column) => {
        const limit = Math.min(sheet.rows.length, 80);
        for (let row = 0; row < limit; row++) {
          const value = sheet.rows[row][column];
          if (value) return value;
        }
        return "";
      }),
    [sheet]
  );

  const sampleFor = (field: string) => {
    const index = sheet.headers.indexOf(field);
    return index >= 0 ? samples[index] : "";
  };

  const available = sheet.headers.filter(
    (field) => !draft.dimensions.some((dimension) => dimension.field === field)
  );

  const addField = (field: string) => {
    if (draft.dimensions.length >= MAX_DIMENSIONS) return;
    if (draft.dimensions.some((dimension) => dimension.field === field)) return;
    setDraft((current) => ({
      ...current,
      dimensions: current.dimensions.concat([{ field, split: false }]),
    }));
  };

  const removeField = (field: string) => {
    setDraft((current) => ({
      ...current,
      dimensions: current.dimensions.filter((dimension) => dimension.field !== field),
    }));
  };

  const moveField = (index: number, delta: number) => {
    setDraft((current) => {
      const next = current.dimensions.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const item = next[index];
      next[index] = next[target];
      next[target] = item;
      return { ...current, dimensions: next };
    });
  };

  const toggleSplit = (field: string) => {
    setDraft((current) => ({
      ...current,
      dimensions: current.dimensions.map((dimension) =>
        dimension.field === field
          ? { ...dimension, split: !dimension.split }
          : dimension
      ),
    }));
  };

  const resetSuggested = () => {
    setDraft((current) => ({
      ...current,
      dimensions: suggestDimensions(sheet, 3),
    }));
  };

  const apply = () => {
    onApply({
      dimensions: draft.dimensions.slice(0, MAX_DIMENSIONS),
      emptyLabel: draft.emptyLabel.trim() || "(空)",
    });
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="分类字段"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="dialog-head">
          <div>
            <div className="dialog-title">分类字段</div>
            <div className="dialog-sub">
              选择作为层级的列，顺序就是树的层级顺序，最多 {MAX_DIMENSIONS} 层。
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon size={15} />
          </button>
        </header>

        <div className="dialog-body">
          <div className="section-title">
            <span>层级字段 {draft.dimensions.length} / {MAX_DIMENSIONS}</span>
            <button type="button" className="link-btn small" onClick={resetSuggested}>
              推荐字段
            </button>
          </div>

          {draft.dimensions.length === 0 ? (
            <div className="empty-hint">
              还没有选择字段。不选也可以，所有记录会平铺展示。
            </div>
          ) : (
            <div className="dimension-list">
              {draft.dimensions.map((dimension, index) => (
                <div className="dimension-row" key={dimension.field}>
                  <span className="dimension-order">{index + 1}</span>
                  <span className="dimension-name" title={dimension.field}>
                    {dimension.field}
                  </span>
                  <span className="dimension-sample" title={sampleFor(dimension.field)}>
                    {sampleFor(dimension.field)}
                  </span>
                  <label className="switch" title="将“华东、华南”这样的内容拆成两个分支">
                    <input
                      type="checkbox"
                      checked={dimension.split}
                      onChange={() => toggleSplit(dimension.field)}
                    />
                    <span className="switch-track" />
                    <span className="switch-text">拆分</span>
                  </label>
                  <span className="dimension-actions">
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                      aria-label="上移"
                      title="上移"
                    >
                      <ArrowUpIcon size={11} />
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => moveField(index, 1)}
                      disabled={index === draft.dimensions.length - 1}
                      aria-label="下移"
                      title="下移"
                    >
                      <ArrowDownIcon size={11} />
                    </button>
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => removeField(dimension.field)}
                      aria-label="移除"
                      title="移除"
                    >
                      <CloseIcon size={11} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="section-title available-title">
            <span>可选字段 {available.length}</span>
            <span className="section-note">点击加入层级</span>
          </div>

          {available.length === 0 ? (
            <div className="empty-hint">所有字段都已加入层级。</div>
          ) : (
            <div className="field-grid">
              {available.map((field) => (
                <button
                  type="button"
                  className="field-option"
                  key={field}
                  onClick={() => addField(field)}
                  disabled={draft.dimensions.length >= MAX_DIMENSIONS}
                  title={sampleFor(field)}
                >
                  <span className="plus">
                    <PlusIcon size={11} />
                  </span>
                  <span className="field-option-name">{field}</span>
                  <span className="field-option-sample">{sampleFor(field)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="dialog-foot">
          <label className="empty-label">
            空值显示为
            <input
              value={draft.emptyLabel}
              onChange={(event) =>
                setDraft((current) => ({ ...current, emptyLabel: event.target.value }))
              }
              maxLength={12}
              aria-label="空值显示文字"
            />
          </label>
          <span className="dialog-foot-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            <CheckIcon size={13} />
            应用
          </button>
        </footer>
      </div>
    </div>
  );
}
