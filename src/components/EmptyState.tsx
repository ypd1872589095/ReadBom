interface EmptyStateProps {
  dragOver: boolean;
  onPick: () => void;
}

export function EmptyState({ dragOver, onPick }: EmptyStateProps) {
  return (
    <main className="welcome">
      <div className={"welcome-panel" + (dragOver ? " is-over" : "")}>
        <div className="welcome-title">打开 Excel</div>
        <div className="welcome-hint">拖入文件，或从电脑选择</div>
        <button type="button" className="btn btn-primary welcome-pick" onClick={onPick}>
          选择文件
        </button>
        <div className="welcome-formats">.xlsx&nbsp;&nbsp;&nbsp;.xls&nbsp;&nbsp;&nbsp;.csv</div>
      </div>
    </main>
  );
}
