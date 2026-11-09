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
import type { SheetData, TreeConfig, WorkbookData } from "./types";
import { buildTree } from "./lib/tree";
import { parseWorkbook } from "./lib/parse";
import ParseWorker from "./workers/parse.worker?worker&inline";
import { createDemoWorkbook, demoConfig } from "./lib/demo";
import { suggestDimensions } from "./lib/suggest";
import { loadConfig, saveConfig } from "./lib/storage";
import { exportSheetAsCsv } from "./lib/csv";
import { desktop, type DesktopFileMessage } from "./lib/desktop";
import { formatNumber } from "./lib/format";
import { TopBar } from "./components/TopBar";
import { TreePanel } from "./components/TreePanel";
import { RecordTable } from "./components/RecordTable";
import { DetailDrawer } from "./components/DetailDrawer";
import { FieldDialog } from "./components/FieldDialog";
import { EmptyState } from "./components/EmptyState";
import { Toast } from "./components/Toast";
import { LoadingVeil } from "./components/LoadingVeil";
import { ChevronRightIcon, DownloadIcon, UploadIcon } from "./components/Icons";

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
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
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
        setNotice("文件已更新");
        return;
      }

      const target = data.sheets[0];
      const nextConfig = preferred ?? loadConfig(target) ?? defaultConfig(target);

      setWorkbook(data);
      setSheetIndex(0);
      setConfig(nextConfig);
      setQuery("");
      setSelectedId("root");
      setExpanded(new Set());
      expandedFor.current = "";
      setSelectedRow(null);
      setConfigOpen(false);
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
    setQuery("");
    setSelectedId("root");
    setExpanded(new Set());
    expandedFor.current = "";
    setSelectedRow(null);
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
    exportSheetAsCsv(sheet, node.rowIndices, sheet.name + "-" + label);
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
        if (configOpen) {
          setConfigOpen(false);
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
  }, [configOpen, selectedRow, query]);

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
            autoRefresh={autoRefresh}
            query={query}
            onQueryChange={setQuery}
            onSheetChange={changeSheet}
            onPickFile={openFilePicker}
            onOpenConfig={() => setConfigOpen(true)}
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

      {selectedRow !== null && sheet ? (
        <DetailDrawer
          sheet={sheet}
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
