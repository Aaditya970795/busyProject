const BASE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M19 12H5M5 12l6-6M5 12l6 6" />
    </svg>
  );
}

export function ArchiveIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M3 5h18M4 5v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5M9 11h6" />
    </svg>
  );
}

export function RestoreIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M3 12a9 9 0 1 0 2.64-6.36M3 5v5h5" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function ReceiptIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function UserPlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...BASE} {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
    </svg>
  );
}
