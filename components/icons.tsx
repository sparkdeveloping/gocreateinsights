import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function OverviewIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></IconBase>; }
export function MembershipIcon(props: IconProps) { return <IconBase {...props}><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/></IconBase>; }
export function EngagementIcon(props: IconProps) { return <IconBase {...props}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 7 6-4 6 6 5-4"/></IconBase>; }
export function ApplicationsIcon(props: IconProps) { return <IconBase {...props}><path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Z"/><path d="M9 3v4h6V3M8 11h8M8 15h5"/></IconBase>; }
export function PeopleIcon(props: IconProps) { return <IconBase {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></IconBase>; }
export function QualityIcon(props: IconProps) { return <IconBase {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></IconBase>; }
export function MembersIcon(props: IconProps) { return <IconBase {...props}><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 7h5M18.5 4.5v5"/></IconBase>; }
export function SearchIcon(props: IconProps) { return <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></IconBase>; }
export function FilterIcon(props: IconProps) { return <IconBase {...props}><path d="M4 5h16M7 12h10M10 19h4"/></IconBase>; }
export function ChevronRightIcon(props: IconProps) { return <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>; }
export function ChevronDownIcon(props: IconProps) { return <IconBase {...props}><path d="m6 9 6 6 6-6"/></IconBase>; }
export function CloseIcon(props: IconProps) { return <IconBase {...props}><path d="M18 6 6 18M6 6l12 12"/></IconBase>; }
export function ArrowUpRightIcon(props: IconProps) { return <IconBase {...props}><path d="M7 17 17 7M7 7h10v10"/></IconBase>; }
export function DownloadIcon(props: IconProps) { return <IconBase {...props}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></IconBase>; }
export function InfoIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></IconBase>; }
export function SparkIcon(props: IconProps) { return <IconBase {...props}><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/></IconBase>; }
export function EyeIcon(props: IconProps) { return <IconBase {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></IconBase>; }
export function LockIcon(props: IconProps) { return <IconBase {...props}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></IconBase>; }
export function CheckIcon(props: IconProps) { return <IconBase {...props}><path d="m5 12 4 4L19 6"/></IconBase>; }
export function AlertIcon(props: IconProps) { return <IconBase {...props}><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></IconBase>; }
export function RefreshIcon(props: IconProps) { return <IconBase {...props}><path d="M20 11a8 8 0 1 0-2.3 5.7L20 14"/><path d="M20 8v6h-6"/></IconBase>; }
export function ReportIcon(props: IconProps) { return <IconBase {...props}><path d="M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v4h4M8 12h2v5H8zM12 10h2v7h-2zM16 13h2v4h-2z"/></IconBase>; }
export function CalendarIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></IconBase>; }
export function PrinterIcon(props: IconProps) { return <IconBase {...props}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></IconBase>; }
export function BuildingIcon(props: IconProps) { return <IconBase {...props}><path d="M4 21V5l8-3v19M12 8h8v13M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2M2 21h20"/></IconBase>; }
export function HeartIcon(props: IconProps) { return <IconBase {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></IconBase>; }
export function TagIcon(props: IconProps) { return <IconBase {...props}><path d="M20 13 11 22l-9-9V4h9l9 9Z"/><circle cx="7.5" cy="9.5" r="1.5"/></IconBase>; }
