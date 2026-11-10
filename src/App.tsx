import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type {
  ComputedDefinition,
  ComputedResult,
  SheetData,
  SummaryItem,
  TreeConfig,
  WorkbookData,
} from "./types";
import { buildTree } from "./lib/tree";
import { parseWorkbook } from "./lib/parse";
import ParseWorker from "./workers/parse.worker?worker&inline";
import { createDemoWorkbook, demoConfig } from "./lib/demo";
import { suggestDimensions } from "./lib/suggest";
import {
  loadComputedDefs,
  loadConfig,
  loadSummaryColumns,
  saveComputedDefs,
  saveConfig,
  saveSummaryColumns,
} from "./lib/storage";
import { exportSheetAsCsv } from "./lib/csv";
import { desktop, type DesktopFileMessage } from "./lib/desktop";
import { formatNumber } from "./lib/format";
import { TopBar } from "./components/TopBar";
import { TreePanel } from "./components/TreePanel";
import { RecordTable } from "./components/RecordTable";
import { DetailDrawer } from "./components/DetailDrawer";
import { FieldDialog } from "./components/FieldDialog";
import { ComputedDialog } from "./components/ComputedDialog";
import { computeComputedColumns } from "./lib/formula";
import { EmptyState } from "./components/EmptyState";
import { Toast } from "./components/Toast";
import { LoadingVeil } from "./components/LoadingVeil";
import { ChevronRightIcon, DownloadIcon, UploadIcon } from "./components/Icons";

type SummaryOption = {
  name: string;
  kind: "base" | "computed";
  unitLabel: string;
  percent: boolean;
};

class WorkerUnavailableError extends Error {
  constructor() {
    super("worker-unavailable");
    this.name = "WorkerUnavailableError";
  }
}

function parseInWorker(buffer: ArrayBuffer, fileName: string): Promise<WorkbookData> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new ParseWorker();
    } catch {
      reject(new WorkerUnavailableError());
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      callback();
    };

    worker.onmessage = (
      event: MessageEvent<{ ok: boolean; data?: WorkbookData; error?: string }>
    ) => {
      const payload = event.data;
      if (payload && payload.ok && payload.data) {
        finish(() => resolve(payload.data as WorkbookData));
      } else {
        finish(() => reject(new Error(payload?.error || "解析失败，请重试")));
      }
    };

    worker.onerror = () => finish(() => reject(new WorkerUnavailableError()));

    try {
      worker.postMessage({ buffer, fileName });
    } catch {
      finish(() => reject(new WorkerUnavailableError()));
    }
  });
}

function defaultConfig(sheet: SheetData): TreeConfig {
  return {
    dimensions: suggestDimensions(sheet),
    emptyLabel: "(空)",
  };
}

export default function App() {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [config, setConfig] = useState<TreeConfig | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("root");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [computedOpen, setComputedOpen] = useState(false);
  const [computedDefs, setComputedDefs] = useState<ComputedDefinition[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryColumns, setSummaryColumns] = useState<string[]>([]);
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [hideDimensionColumns, setHideDimensionColumns] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem("readtree.hideDimensionColumns");
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });

  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const demoLoaded = useRef(false);
  const expandedFor = useRef("");

  const sheet = workbook?.sheets[sheetIndex] ?? null;
  const deferredQuery = useDeferredValue(query.trim());

  const searchIndex = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((row) => row.join("\u001f").toLocaleLowerCase());
  }, [sheet]);

  const matchedRows = useMemo<number[] | null>(() => {
    if (!deferredQuery) return null;
    const needle = deferredQuery.toLocaleLowerCase();
    const matches: number[] = [];
    for (let index = 0; index < searchIndex.length; index++) {
      if (searchIndex[index].includes(needle)) matches.push(index);
    }
    return matches;
  }, [deferredQuery, searchIndex]);

  const built = useMemo(() => {
    if (!sheet || !config) return null;
    return buildTree(sheet, config, matchedRows ?? undefined);
  }, [sheet, config, matchedRows]);

  const root = built?.root ?? null;
  const node = built && root ? built.index.get(selectedId) ?? root : null;
  const rowIndices = node ? node.rowIndices : [];
  const isSearching = deferredQuery.length > 0;
  const hiddenFields = useMemo(() => {
    if (!hideDimensionColumns || !config) return new Set<string>();
    return new Set(config.dimensions.map((dimension) => dimension.field));
  }, [hideDimensionColumns, config]);

  const computedResults = useMemo<ComputedResult[]>(() => {
    if (!sheet) return [];
    return computeComputedColumns(sheet, computedDefs);
  }, [sheet, computedDefs]);

  const validComputed = useMemo(
    () => computedResults.filter((column) => !column.error),
    [computedResults]
  );

  const summaryOptions = useMemo<SummaryOption[]>(() => {
    if (!sheet) return [];
    const base: SummaryOption[] = sheet.columns
      .filter((column) => column.numeric)
      .map((column) => ({
        name: column.name,
        kind: "base",
        unitLabel: column.unitLabel,
        percent: column.percent,
      }));
    const calculated: SummaryOption[] = validComputed.map((column) => ({
      name: column.name,
      kind: "computed",
      unitLabel: "",
      percent: false,
    }));
    return base.concat(calculated);
  }, [sheet, validComputed]);

  const summaryItems = useMemo<SummaryItem[]>(() => {
    if (!sheet) return [];
    const baseByName = new Map(sheet.columns.map((column) => [column.name, column]));
    const calculatedByName = new Map(
      validComputed.map((column) => [column.name, column])
    );
    const items: SummaryItem[] = [];
    for (const name of summaryColumns) {
      let values: (number | null)[] | null = null;
      const base = baseByName.get(name);
      if (base && base.numeric) {
        values = rowIndices.map(
          (rowIndex) => sheet.numbers[rowIndex]?.[base.index] ?? null
        );
      } else {
        const calculated = calculatedByName.get(name);
        if (calculated) {
          values = rowIndices.map((rowIndex) => calculated.values[rowIndex] ?? null);
        }
      }
      if (!values) continue;
      let sum = 0;
      let valid = 0;
      for (const value of values) {
        if (value !== null && Number.isFinite(value)) {
          sum += value;
          valid++;
        }
      }
      items.push({
        key: name,
        label: name,
        value: sum,
        valid,
        total: rowIndices.length,
      });
    }
    return items;
  }, [sheet, rowIndices, validComputed, summaryColumns]);

  const applyWorkbook = useCallback(
    (data: WorkbookData, preferred?: TreeConfig, mode: "new" | "refresh" = "new") => {
      if (data.sheets.length === 0) return;

      if (mode === "refresh") {
        const nextIndex = Math.min(sheetIndex, data.sheets.length - 1);
        const nextSheet = data.sheets[nextIndex];
        const fields = new Set(nextSheet.headers);
        const kept = config
          ? config.dimensions.filter((dimension) => fields.has(dimension.field))
          : [];
        const nextConfig: TreeConfig =
          config && kept.length > 0
            ? { dimensions: kept, emptyLabel: config.emptyLabel }
            : defaultConfig(nextSheet);

        setWorkbook(data);
        setSheetIndex(nextIndex);
        setConfig(nextConfig);
        setSelectedRow(null);
        setSummaryOpen(false);
        setNotice("文件已更新");
        return;
      }

      const target = data.sheets[0];
      const nextConfig = preferred ?? loadConfig(target) ?? defaultConfig(target);

      setWorkbook(data);
      setSheetIndex(0);
      setConfig(nextConfig);
      setComputedDefs(loadComputedDefs(target));
      setSummaryColumns(loadSummaryColumns(target));
      setQuery("");
      setSelectedId("root");
      setExpanded(new Set());
      expandedFor.current = "";
      setSelectedRow(null);
      setConfigOpen(false);
      setComputedOpen(false);
      setSummaryOpen(false);
      setNotice(null);
    },
    [sheetIndex, config]
  );

  const parseBuffer = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    try {
      return await parseInWorker(buffer, fileName);
    } catch (error) {
      if (error instanceof WorkerUnavailableError) {
        await new Promise((resolve) => window.setTimeout(resolve, 20));
        return parseWorkbook(buffer, fileName);
      }
      throw error;
    }
  }, []);

  const handleDesktopFile = useCallback(
    async (message: DesktopFileMessage) => {
      const isChange = message.reason === "change";
      if (!isChange) setLoadingName(message.name);

      try {
        let response = await fetch(message.url, { cache: "no-store" });
        if (!response.ok) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          response = await fetch(message.url, { cache: "no-store" });
        }
        if (!response.ok) throw new Error("无法读取更新后的文件");

        const buffer = await response.arrayBuffer();
        const data = await parseBuffer(buffer, message.name);
        applyWorkbook(data, undefined, isChange ? "refresh" : "new");
        setAutoRefresh(true);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "读取文件失败");
      } finally {
        if (!isChange) setLoadingName(null);
      }
    },
    [applyWorkbook, parseBuffer]
  );

  const desktopHandler = useRef<(message: DesktopFileMessage) => void>(() => {});
  desktopHandler.current = handleDesktopFile;
  const desktopReadySent = useRef(false);

  const loadDemo = useCallback(() => {
    setAutoRefresh(false);
    applyWorkbook(createDemoWorkbook(), demoConfig);
  }, [applyWorkbook]);

  const changeSheet = (index: number) => {
    if (!workbook) return;
    const target = workbook.sheets[index];
    if (!target) return;
    setSheetIndex(index);
    setConfig(loadConfig(target) ?? defaultConfig(target));
    setComputedDefs(loadComputedDefs(target));
    setSummaryColumns(loadSummaryColumns(target));
    setQuery("");
    setSelectedId("root");
    setExpanded(new Set());
    expandedFor.current = "";
    setSelectedRow(null);
    setComputedOpen(false);
    setSummaryOpen(false);
  };

  const loadFile = useCallback(
    async (file: File) => {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        setNotice("请选择 .xlsx、.xls 或 .csv 文件");
        return;
      }

      if (desktop.available) desktop.stopWatching();
      setAutoRefresh(false);
      setNotice(null);
      setLoadingName(file.name);

      try {
        const buffer = await file.arrayBuffer();
        const data = await parseBuffer(buffer, file.name);
        applyWorkbook(data);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "解析失败，请重试");
      } finally {
        setLoadingName(null);
      }
    },
    [applyWorkbook, parseBuffer]
  );

  const openFilePicker = useCallback(() => {
    if (desktop.available) {
      desktop.open();
      return;
    }
    fileInputRef.current?.click();
  }, []);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadFile(file);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const applyConfig = (next: TreeConfig) => {
    if (!sheet) return;
    setConfig(next);
    saveConfig(sheet, next);
    setSelectedId("root");
    setSelectedRow(null);
    setConfigOpen(false);
  };

  const applyComputed = (next: ComputedDefinition[]) => {
    if (!sheet) return;
    setComputedDefs(next);
    saveComputedDefs(sheet, next);
    setComputedOpen(false);
    const allowed = new Set<string>(sheet.headers);
    for (const definition of next) allowed.add(definition.name);
    setSummaryColumns((current) => current.filter((name) => allowed.has(name)));
    setNotice(next.length > 0 ? "计算列已更新" : "已清除计算列");
  };

  const toggleSummaryColumn = (name: string) => {
    setSummaryColumns((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      if (current.length >= 12) return current;
      return current.concat(name);
    });
  };

  const selectNode = (id: string) => {
    setSelectedId(id);
    setSelectedRow(null);
    const target = built?.index.get(id);
    if (target && target.ancestors.length > 0) {
      setExpanded((current) => {
        const next = new Set(current);
        for (const ancestor of target.ancestors) next.add(ancestor.id);
        return next;
      });
    }
  };

  const toggleNode = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCurrent = () => {
    if (!sheet || !node) return;
    const label = node.level === 0 ? "全部记录" : node.label;
    exportSheetAsCsv(sheet, node.rowIndices, sheet.name + "-" + label, validComputed);
  };

  useEffect(() => {
    if (!root || !sheet || !config) return;
    // Wait for a stale deferred query to clear before deciding what to expand.
    if (deferredQuery && !query.trim()) return;

    const key =
      sheet.name +
      "|" +
      config.dimensions
        .map((dimension) => dimension.field + (dimension.split ? "+" : ""))
        .join(",");
    if (expandedFor.current === key) return;
    expandedFor.current = key;

    const next = new Set<string>([root.id]);
    for (const child of root.children) next.add(child.id);
    setExpanded(next);
  }, [root, sheet, config, deferredQuery, query]);

  useEffect(() => {
    if (!built) return;
    if (!built.index.has(selectedId)) setSelectedId(built.root.id);
  }, [built, selectedId]);

  useEffect(() => {
    if (!deferredQuery || !root) return;
    setExpanded((current) => {
      const next = new Set(current);
      next.add(root.id);
      for (const child of root.children) {
        if (child.children.length > 0) next.add(child.id);
      }
      return next;
    });
  }, [deferredQuery, root]);

  useEffect(() => {
    setSelectedRow(null);
  }, [selectedId]);

  useEffect(() => {
    if (selectedRow === null) return;
    if (!node || !node.rowIndices.includes(selectedRow)) setSelectedRow(null);
  }, [node, selectedRow]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "readtree.hideDimensionColumns",
        hideDimensionColumns ? "1" : "0"
      );
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }, [hideDimensionColumns]);

  useEffect(() => {
    if (!sheet) return;
    saveSummaryColumns(sheet, summaryColumns);
  }, [sheet, summaryColumns]);

  useEffect(() => {
    const names = new Set(summaryOptions.map((option) => option.name));
    setSummaryColumns((current) => {
      const next = current.filter((name) => names.has(name));
      return next.length === current.length ? current : next;
    });
  }, [summaryOptions]);

  useEffect(() => {
    if (!summaryOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (
        summaryRef.current &&
        !summaryRef.current.contains(event.target as Node)
      ) {
        setSummaryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [summaryOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        if (computedOpen) {
          setComputedOpen(false);
          return;
        }
        if (configOpen) {
          setConfigOpen(false);
          return;
        }
        if (summaryOpen) {
          setSummaryOpen(false);
          return;
        }
        if (selectedRow !== null) {
          setSelectedRow(null);
          return;
        }
        if (query) setQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [computedOpen, configOpen, summaryOpen, selectedRow, query]);

  useEffect(() => {
    if (demoLoaded.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      demoLoaded.current = true;
      loadDemo();
    }
  }, [loadDemo]);

  useEffect(() => {
    if (!desktop.available) return;
    const unsubscribe = desktop.onFile((message) => {
      desktopHandler.current(message);
    });
    if (!desktopReadySent.current) {
      desktopReadySent.current = true;
      desktop.ready();
    }
    return unsubscribe;
  }, []);

  const selectedPosition =
    selectedRow !== null && node ? node.rowIndices.indexOf(selectedRow) : -1;
  const hasPrev = selectedPosition > 0;
  const hasNext =
    selectedPosition >= 0 && selectedPosition < rowIndices.length - 1;

  const goPrev = () => {
    if (hasPrev) setSelectedRow(rowIndices[selectedPosition - 1]);
  };

  const goNext = () => {
    if (hasNext) setSelectedRow(rowIndices[selectedPosition + 1]);
  };

  const path = node
    ? node.ancestors.concat([{ id: node.id, label: node.label }])
    : [];

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        onChange={handleInput}
        tabIndex={-1}
      />

      {workbook && sheet && config && root ? (
        <>
          <TopBar
            fileName={workbook.fileName}
            sheets={workbook.sheets}
            sheetIndex={sheetIndex}
            dimensionCount={config.dimensions.length}
            computedCount={computedDefs.length}
            autoRefresh={autoRefresh}
            query={query}
            onQueryChange={setQuery}
            onSheetChange={changeSheet}
            onPickFile={openFilePicker}
            onOpenConfig={() => setConfigOpen(true)}
            onOpenComputed={() => setComputedOpen(true)}
            searchRef={searchRef}
          />

          <div className="main">
            <TreePanel
              root={root}
              totalRows={sheet.totalRows}
              matched={isSearching ? matchedRows?.length ?? 0 : null}
              config={config}
              expanded={expanded}
              selectedId={selectedId}
              query={deferredQuery}
              onSelect={selectNode}
              onToggle={toggleNode}
              onOpenConfig={() => setConfigOpen(true)}
            />

            <section className="content">
              <div className="content-toolbar">
                <nav className="breadcrumb" aria-label="位置">
                  {path.map((crumb, index) => {
                    const current = index === path.length - 1;
                    return (
                      <span className="crumb-wrap" key={crumb.id}>
                        {index > 0 ? (
                          <span className="crumb-sep">
                            <ChevronRightIcon size={10} />
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={"crumb" + (current ? " is-current" : "")}
                          onClick={() => selectNode(crumb.id)}
                          title={crumb.label}
                        >
                          {crumb.label}
                        </button>
                      </span>
                    );
                  })}
                </nav>

                <div className="toolbar-meta">
                  {isSearching ? (
                    <span className="search-count">
                      匹配 <strong>{formatNumber(matchedRows?.length ?? 0)}</strong> 条
                    </span>
                  ) : null}
                  <span className="record-count">
                    <strong>{formatNumber(rowIndices.length)}</strong> 条记录
                  </span>
                  <label className="column-toggle" title="隐藏已用于树形分类的列（仅表格）">
                    <input
                      type="checkbox"
                      checked={hideDimensionColumns}
                      onChange={(event) => setHideDimensionColumns(event.target.checked)}
                    />
                    <span className="column-track" />
                    <span>隐藏分类列</span>
                  </label>
                  <div className="summary-wrap" ref={summaryRef}>
                    <button
                      type="button"
                      className={
                        "btn btn-outline summary-button" +
                        (summaryColumns.length > 0 ? " is-active" : "")
                      }
                      onClick={() => setSummaryOpen((current) => !current)}
                      title="选择要合计的数值列"
                    >
                      <span className="sigma">Σ</span>
                      合计
                      {summaryItems.length > 0 ? (
                        <span className="summary-count">{summaryItems.length}</span>
                      ) : null}
                    </button>
                    {summaryOpen ? (
                      <div className="summary-popover">
                        <div className="summary-popover-head">
                          <span>合计列</span>
                          {summaryColumns.length > 0 ? (
                            <button
                              type="button"
                              className="link-btn small"
                              onClick={() => setSummaryColumns([])}
                            >
                              清除
                            </button>
                          ) : null}
                        </div>
                        {summaryOptions.length === 0 ? (
                          <div className="summary-empty">
                            没有可合计的纯数值列
                          </div>
                        ) : (
                          <div className="summary-options">
                            {summaryOptions.map((option) => (
                              <label
                                className="summary-option"
                                key={option.kind + ":" + option.name}
                                title={
                                  option.unitLabel
                                    ? option.name + "（" + option.unitLabel + "）"
                                    : option.name
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={summaryColumns.includes(option.name)}
                                  onChange={() => toggleSummaryColumn(option.name)}
                                />
                                <span className="summary-option-name">
                                  {option.name}
                                </span>
                                {option.unitLabel ? (
                                  <span className="summary-unit">
                                    {option.unitLabel}
                                  </span>
                                ) : null}
                                {option.kind === "computed" ? (
                                  <span className="summary-kind">ƒx</span>
                                ) : null}
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="summary-popover-foot">
                          只合计当前筛选结果
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={exportCurrent}
                    disabled={rowIndices.length === 0}
                    title="导出当前列表为 CSV"
                  >
                    <DownloadIcon size={13} />
                    导出
                  </button>
                </div>
              </div>

              <RecordTable
                sheet={sheet}
                rowIndices={rowIndices}
                query={deferredQuery}
                selectedRow={selectedRow}
                hiddenFields={hiddenFields}
                computed={validComputed}
                summary={summaryItems}
                onOpenRow={setSelectedRow}
              />
            </section>
          </div>
        </>
      ) : (
        <EmptyState dragOver={dragOver} onPick={openFilePicker} />
      )}

      {configOpen && sheet && config ? (
        <FieldDialog
          sheet={sheet}
          initial={config}
          onApply={applyConfig}
          onClose={() => setConfigOpen(false)}
        />
      ) : null}

      {computedOpen && sheet ? (
        <ComputedDialog
          sheet={sheet}
          initial={computedDefs}
          onApply={applyComputed}
          onClose={() => setComputedOpen(false)}
        />
      ) : null}

      {selectedRow !== null && sheet ? (
        <DetailDrawer
          sheet={sheet}
          computed={validComputed}
          rowIndex={selectedRow}
          position={selectedPosition + 1}
          total={rowIndices.length}
          query={deferredQuery}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={goPrev}
          onNext={goNext}
          onClose={() => setSelectedRow(null)}
        />
      ) : null}

      {loadingName ? <LoadingVeil fileName={loadingName} /> : null}
      {notice ? <Toast message={notice} /> : null}

      {dragOver ? (
        <div className="drag-overlay">
          <div className="drag-card">
            <span className="drag-icon">
              <UploadIcon size={24} />
            </span>
            <div className="drag-title">松开以导入 Excel</div>
            <div className="drag-sub">支持 .xlsx / .xls / .csv</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
