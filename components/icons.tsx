type IconProps = { className?: string };

const base = "size-6 shrink-0";

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className ? `${base} ${className}` : base}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function ReceiveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </Svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20V8" />
      <path d="m7 13 5-5 5 5" />
      <path d="M5 4h14" />
    </Svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 14 4-4 3 2 5-6" />
    </Svg>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="9" cy="8" rx="5" ry="2.5" />
      <path d="M4 8v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V8" />
      <path d="M14 10.2c1.8.4 4 0 5.2-1" />
      <path d="M14 12v2.2c0 1.2 2 2.2 4.5 2.2 1.6 0 3-.4 3.8-1" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 19.5c1.4-3 3.6-4.5 7-4.5s5.6 1.5 7 4.5" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 0 1-13.7 5.6" />
      <path d="M4 12a8 8 0 0 1 13.7-5.6" />
      <path d="M20 5v5h-5" />
      <path d="M4 19v-5h5" />
    </Svg>
  );
}

export function CatalogIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" />
      <path d="M5 4v16" />
    </Svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </Svg>
  );
}

export function QrIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
    </Svg>
  );
}
