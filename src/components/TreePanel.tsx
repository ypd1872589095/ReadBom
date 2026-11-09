import { useEffect, useMemo, type KeyboardEvent } from "react";
import type { TreeConfig, TreeNode } from "../types";
import { flattenVisible } from "../lib/tree";
import { formatNumber } from "../lib/format";
import { useVirtualRows } from "../lib/useVirtualRows";
import { ChevronRightIcon, SlidersIcon } from "./Icons";
import { Highlight } from "./Highlight";

const ROW_HEIGHT = 30;

interface TreePanelProps {
  root: TreeNode;
  totalRows: number;
  matched: number | null;
  config: TreeConfig;
  expanded: Set<string>;
  selectedId: string;
  query: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onOpenConfig: () => void;
}

export function TreePanel({
  root,
  totalRows,
  matched,
  config,
  expanded,
  selectedId,
  query,
  onSelect,
  onToggle,
  onOpenConfig,
}: TreePanelProps) {
  const visible = useMemo(() => flattenVisible(root, expanded), [root, expanded]);
  const virtual = useVirtualRows(visible.length, ROW_HEIGHT, 0, 10);
  const { ref } = virtual;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const index = visible.findIndex((node) => node.id === selectedId);
    if (index < 0) return;
    const top = index * ROW_HEIGHT;
    if (top < element.scrollTop) {
      element.scrollTop = top;
    } else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + ROW_HEIGHT - element.clientHeight;
    }
  }, [selectedId, visible, ref]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = visible.findIndex((node) => node.id === selectedId);
    if (index < 0) return;
    const current = visible[index];

    const selectAt = (nextIndex: number) => {
      const next = visible[nextIndex];
      if (next) onSelect(next.id);
    };

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        selectAt(Math.min(visible.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        selectAt(Math.max(0, index - 1));
        break;
      case "ArrowRight":
        event.preventDefault();
        if (current.children.length > 0) {
          if (!expanded.has(current.id)) onToggle(current.id);
          else onSelect(current.children[0].id);
        }
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (expanded.has(current.id) && current.children.length > 0) {
          onToggle(current.id);
        } else if (current.ancestors.length > 0) {
          onSelect(current.ancestors[current.ancestors.length - 1].id);
        }
        break;
      case "Home":
        event.preventDefault();
        selectAt(0);
        break;
      case "End":
        event.preventDefault();
        selectAt(visible.length - 1);
        break;
      case "Enter":
      case " ":
        if (current.children.length > 0) {
          event.preventDefault();
          onToggle(current.id);
        }
        break;
      default:
        break;
    }
  };

  const pathText =
    config.dimensions.length > 0
      ? config.dimensions.map((dimension) => dimension.field).join(" › ")
      : "未设置，点击选择";

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">分类</span>
        {matched !== null ? (
          <span className="match-pill">{formatNumber(matched)} 条匹配</span>
        ) : (
          <span className="sidebar-total">{formatNumber(totalRows)}</span>
        )}
        <button
          type="button"
          className="icon-btn sidebar-config"
          onClick={onOpenConfig}
          title="分类字段"
          aria-label="分类字段"
        >
          <SlidersIcon size={14} />
        </button>
      </div>

      <div
        className="tree-scroll"
        ref={ref}
        onScroll={virtual.onScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="tree"
        aria-label="分类树"
      >
        <div className="tree-inner" style={{ height: virtual.totalHeight }}>
          {visible.slice(virtual.start, virtual.end).map((node, offset) => {
            const isOpen = expanded.has(node.id);
            const selected = node.id === selectedId;
            const isRoot = node.level === 0;
            return (
              <div
                key={node.id}
                role="treeitem"
                aria-selected={selected}
                aria-expanded={node.children.length > 0 ? isOpen : undefined}
                className={
                  "tree-row" +
                  (selected ? " is-selected" : "") +
                  (isRoot ? " is-root" : "")
                }
                style={{
                  top: (virtual.start + offset) * ROW_HEIGHT,
                  paddingLeft: 8 + node.level * 12,
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  ref.current?.focus();
                }}
                onClick={() => onSelect(node.id)}
                onDoubleClick={() => {
                  if (node.children.length > 0) onToggle(node.id);
                }}
              >
                {node.children.length > 0 ? (
                  <button
                    type="button"
                    className={"tree-chevron" + (isOpen ? " is-open" : "")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(node.id);
                    }}
                    tabIndex={-1}
                    aria-label={isOpen ? "折叠" : "展开"}
                  >
                    <ChevronRightIcon size={12} />
                  </button>
                ) : (
                  <span className="tree-chevron" />
                )}
                <span className="tree-label" title={node.label}>
                  <Highlight text={node.label} query={query} />
                </span>
                <span className="tree-count">{formatNumber(node.count)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" className="sidebar-foot" onClick={onOpenConfig} title="修改分类字段">
        <span className="foot-label">分类依据</span>
        <span className="foot-path">{pathText}</span>
        <ChevronRightIcon size={11} />
      </button>
    </aside>
  );
}
