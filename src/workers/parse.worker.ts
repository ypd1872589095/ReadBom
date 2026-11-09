import { parseWorkbook } from "../lib/parse";

interface ParseRequest {
  buffer: ArrayBuffer;
  fileName: string;
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { buffer, fileName } = event.data;
  try {
    const data = parseWorkbook(buffer, fileName);
    (self as unknown as Worker).postMessage({ ok: true, data });
  } catch (error) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "解析失败，请重试",
    });
  }
};

export {};
