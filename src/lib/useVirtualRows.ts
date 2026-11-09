import { useEffect, useRef, useState, type UIEvent } from "react";

export function useVirtualRows(
  count: number,
  rowHeight: number,
  offset = 0,
  overscan = 8
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setViewport(element.clientHeight);
      setScrollTop(element.scrollTop);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const start = Math.max(
    0,
    Math.floor(Math.max(0, scrollTop - offset) / rowHeight) - overscan
  );
  const end = Math.min(
    count,
    Math.ceil(Math.max(0, scrollTop + viewport - offset) / rowHeight) + overscan
  );

  return {
    ref,
    start,
    end,
    totalHeight: count * rowHeight,
    onScroll: (event: UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    },
  };
}
