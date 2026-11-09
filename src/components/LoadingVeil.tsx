interface LoadingVeilProps {
  fileName: string;
}

export function LoadingVeil({ fileName }: LoadingVeilProps) {
  return (
    <div className="loading-veil" role="status" aria-live="polite">
      <div className="loading-card">
        <span className="spinner" />
        <div className="loading-text">
          <div className="loading-title">正在解析</div>
          <div className="loading-file" title={fileName}>
            {fileName}
          </div>
        </div>
      </div>
    </div>
  );
}
