import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComputedDefinition,
  ComputedResult,
  SheetData,
} from "../types";
import { computeComputedColumns } from "../lib/formula";
import { CheckIcon, CloseIcon, PlusIcon } from "./Icons";

interface ComputedDialogProps {
  sheet: SheetData;
  initial: ComputedDefinition[];
  onApply: (definitions: ComputedDefinition[]) => void;
  onClose: () => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "calc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function ComputedDialog({
  sheet,
  initial,
  onApply,
  onClose,
}: ComputedDialogProps) {
  const [definitions, setDefinitions] = useState<ComputedDefinition[]>(() =>
    initial.map((item) => ({ ...item }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const expressionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const baseFields = useMemo(
    () => sheet.columns.filter((column) => column.numeric),
    [sheet]
  );
  const disabledFields = useMemo(
    () => sheet.columns.filter((column) => !column.numeric),
    [sheet]
  );

  const evaluated = useMemo(
    () => computeComputedColumns(sheet, definitions),
    [sheet, definitions]
  );
  const statusById = useMemo(() => {
    const map = new Map<string, ComputedResult>();
    for (const result of evaluated) map.set(result.id, result);
    return map;
  }, [evaluated]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setExpression("");
    setFormError(null);
  };

  const startEdit = (definition: ComputedDefinition) => {
    setEditingId(definition.id);
    setName(definition.name);
    setExpression(definition.expression);
    setFormError(null);
    window.requestAnimationFrame(() => nameRef.current?.focus());
  };

  const insertField = (field: string) => {
    const token = "[" + field + "]";
    const textarea = expressionRef.current;
    const start = textarea ? textarea.selectionStart : expression.length;
    const end = textarea ? textarea.selectionEnd : start;
    const next = expression.slice(0, start) + token + expression.slice(end);
    setExpression(next);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const removeDefinition = (id: string) => {
    setDefinitions((current) => current.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  };

  const moveDefinition = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setDefinitions((current) => {
      const from = current.findIndex((item) => item.id === fromId);
      const to = current.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const next = current.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const saveDraft = () => {
    const nextName = name.trim();
    const nextExpression = expression.trim();
    if (!nextName) {
      setFormError("请填写计算列名称");
      return;
    }
    if (/[\[\]]/.test(nextName)) {
      setFormError("列名不能包含 [ 或 ]");
      return;
    }
    if (!nextExpression) {
      setFormError("请填写公式");
      return;
    }

    const otherNames = new Set(sheet.headers);
    for (const item of definitions) {
      if (item.id !== editingId) otherNames.add(item.name);
    }
    if (otherNames.has(nextName)) {
      setFormError("列名已存在，请换一个");
      return;
    }

    const nextId = editingId ?? makeId();
    const draft: ComputedDefinition = {
      id: nextId,
      name: nextName,
      expression: nextExpression,
    };
    const nextDefinitions = editingId
      ? definitions.map((item) => (item.id === editingId ? draft : item))
      : definitions.concat(draft);

    const preview = computeComputedColumns(sheet, nextDefinitions);
    const draftResult = preview.find((item) => item.id === nextId);
    if (draftResult?.error) {
      setFormError(draftResult.error);
      return;
    }

    setDefinitions(nextDefinitions);
    setEditingId(null);
    setName("");
    setExpression("");
    setFormError(null);
  };

  const apply = () => {
    onApply(definitions);
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog computed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="计算列"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="dialog-head">
          <div>
            <div className="dialog-title">计算列</div>
            <div className="dialog-sub">
              支持多列、括号和 + - * /；计算列可以引用计算列，不写回原文件。
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon size={15} />
          </button>
        </header>

        <div className="dialog-body computed-body">
          <section className="computed-section">
            <div className="section-title">
              <span>计算列 {definitions.length}</span>
              <span className="section-note">拖动左侧手柄调整显示顺序</span>
            </div>

            {definitions.length === 0 ? (
              <div className="empty-hint">还没有计算列，在下方新建一条。</div>
            ) : (
              <div className="computed-list">
                {definitions.map((definition) => {
                  const status = statusById.get(definition.id);
                  return (
                    <div
                      className={
                        "computed-item" +
                        (editingId === definition.id ? " is-editing" : "") +
                        (dragId === definition.id ? " is-dragging" : "")
                      }
                      key={definition.id}
                      onDragOver={(event) => {
                        if (dragId) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragId) moveDefinition(dragId, definition.id);
                        setDragId(null);
                      }}
                    >
                      <span
                        className="computed-drag"
                        draggable
                        title="拖动排序"
                        onDragStart={(event) => {
                          setDragId(definition.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", definition.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                      >
                        ⋮⋮
                      </span>
                      <div className="computed-item-main">
                        <div className="computed-item-name">
                          <span className="fx-mark">ƒx</span>
                          {definition.name}
                        </div>
                        <div className="computed-item-expr" title={definition.expression}>
                          {definition.expression}
                        </div>
                        {status?.error ? (
                          <div className="computed-item-error">{status.error}</div>
                        ) : status?.warnings.length ? (
                          <div className="computed-item-warning">
                            {status.warnings.join("；")}
                          </div>
                        ) : null}
                      </div>
                      <span className="computed-item-actions">
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => startEdit(definition)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="mini-btn danger"
                          onClick={() => removeDefinition(definition.id)}
                          aria-label="删除"
                        >
                          删除
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="computed-section computed-form">
            <div className="section-title">
              <span>{editingId ? "编辑计算列" : "新建计算列"}</span>
              {editingId ? (
                <button type="button" className="link-btn small" onClick={resetForm}>
                  取消编辑
                </button>
              ) : null}
            </div>

            <label className="computed-field">
              <span>列名</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：毛利"
                maxLength={40}
                spellCheck={false}
              />
            </label>

            <label className="computed-field">
              <span>公式</span>
              <textarea
                ref={expressionRef}
                value={expression}
                onChange={(event) => setExpression(event.target.value)}
                placeholder="例如：[合同金额] - [成本]"
                rows={2}
                spellCheck={false}
              />
            </label>

            <div className="computed-fields">
              <span className="computed-fields-label">数值列</span>
              {baseFields.length === 0 ? (
                <span className="computed-fields-empty">没有可计算的纯数值列</span>
              ) : (
                baseFields.map((column) => (
                  <button
                    type="button"
                    className="computed-field-chip"
                    key={column.name}
                    onClick={() => insertField(column.name)}
                    title={
                      column.unitLabel
                        ? column.name + "（" + column.unitLabel + "）"
                        : column.name
                    }
                  >
                    {column.name}
                    {column.unitLabel ? (
                      <em>{column.unitLabel}</em>
                    ) : null}
                  </button>
                ))
              )}
              {definitions
                .filter((definition) => definition.id !== editingId)
                .map((definition) => (
                  <button
                    type="button"
                    className="computed-field-chip is-computed"
                    key={definition.id}
                    onClick={() => insertField(definition.name)}
                    title={"引用计算列：" + definition.name}
                  >
                    ƒx {definition.name}
                  </button>
                ))}
            </div>

            {disabledFields.length > 0 ? (
              <div className="computed-disabled">
                不可计算：{disabledFields.map((column) => column.name).join("、")}
                （含文本、日期或空白）
              </div>
            ) : null}

            {formError ? <div className="computed-error">{formError}</div> : null}

            <div className="computed-form-actions">
              <button type="button" className="btn btn-outline" onClick={saveDraft}>
                <PlusIcon size={12} />
                {editingId ? "保存修改" : "添加到列表"}
              </button>
              <span className="computed-form-hint">
                单位不一致只会警告，不会阻止计算。
              </span>
            </div>
          </section>
        </div>

        <footer className="dialog-foot">
          <span className="computed-foot-hint">
            计算列只用于当前显示和导出，不修改源文件。
          </span>
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
