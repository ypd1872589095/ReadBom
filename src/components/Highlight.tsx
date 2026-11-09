import type { ReactNode } from "react";

interface HighlightProps {
  text: string;
  query: string;
}

export function Highlight({ text, query }: HighlightProps) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let index = lowerText.indexOf(lowerNeedle);
  let guard = 0;

  while (index !== -1 && guard < 40) {
    if (index > from) parts.push(text.slice(from, index));
    parts.push(<mark key={index}>{text.slice(index, index + needle.length)}</mark>);
    from = index + needle.length;
    index = lowerText.indexOf(lowerNeedle, from);
    guard += 1;
  }

  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}
