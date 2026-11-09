interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function LogoIcon({ size = 18, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 6.4V11" />
      <path d="M6 11h12" />
      <path d="M6 11v6" />
      <path d="M18 11v6" />
      <circle cx="12" cy="4.4" r="2.1" />
      <circle cx="6" cy="19.2" r="2.1" />
      <circle cx="18" cy="19.2" r="2.1" />
    </svg>
  );
}

export function FileSpreadsheetIcon({ size = 17, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M6.5 2.5h7l4 4v15h-11z" />
      <path d="M13.5 2.5v4h4" />
      <rect x="8.5" y="11" width="7" height="6.5" rx="1" />
      <path d="M8.5 14.25h7M12 11v6.5" />
    </svg>
  );
}

export function SearchIcon({ size = 15, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function SlidersIcon({ size = 15, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M4 7h9M17 7h3M4 12h4M12 12h8M4 17h7M15 17h5" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="13" cy="17" r="2" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 13, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function DownloadIcon({ size = 15, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function UploadIcon({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function PlusIcon({ size = 13, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 12, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 12, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </svg>
  );
}

export function ShieldIcon({ size = 12, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function AlertIcon({ size = 14, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}

export function TableIcon({ size = 22, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </svg>
  );
}

export function CheckIcon({ size = 14, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base} strokeWidth={strokeWidth}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
