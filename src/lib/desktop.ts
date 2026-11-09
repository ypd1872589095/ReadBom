export interface DesktopFileMessage {
  type: "file";
  reason: "open" | "restore" | "change";
  name: string;
  url: string;
}

interface WebViewBridge {
  postMessage: (message: unknown) => void;
  addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
}

function getBridge(): WebViewBridge | null {
  const chrome = (window as unknown as { chrome?: { webview?: WebViewBridge } }).chrome;
  return chrome?.webview ?? null;
}

export const desktop = {
  get available(): boolean {
    return getBridge() !== null;
  },

  open(): void {
    getBridge()?.postMessage({ type: "open" });
  },

  ready(): void {
    getBridge()?.postMessage({ type: "ready" });
  },

  stopWatching(): void {
    getBridge()?.postMessage({ type: "stop" });
  },

  onFile(callback: (message: DesktopFileMessage) => void): () => void {
    const bridge = getBridge();
    if (!bridge) return () => {};

    const listener = (event: MessageEvent) => {
      const data = event.data as DesktopFileMessage | null;
      if (data && data.type === "file" && typeof data.url === "string") {
        callback(data);
      }
    };

    bridge.addEventListener("message", listener);
    return () => bridge.removeEventListener("message", listener);
  },
};
