/**
 * moduleIcons.tsx — SVG icon registry for navigation modules.
 *
 * Maps module IDs from auth/modules.ts to descriptive inline SVG icons.
 * Used by NavRail (primary nav) and Sidebar (secondary nav) components.
 */
import React from "react";

type IconProps = { className?: string };

const DashboardIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
  </svg>
);

const LiveMonitoringIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="10" cy="10" r="2" fill="currentColor" />
    <path d="M14.5 5.5a6.36 6.36 0 0 1 0 9" />
    <path d="M5.5 14.5a6.36 6.36 0 0 1 0-9" />
    <path d="M16.95 3.05a10 10 0 0 1 0 13.9" />
    <path d="M3.05 16.95a10 10 0 0 1 0-13.9" />
  </svg>
);

const TrackPlaybackIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 17l4-8 3 4 3-6 4 10" />
    <circle cx="3" cy="17" r="1.2" fill="currentColor" />
    <circle cx="17" cy="17" r="1.2" fill="currentColor" />
  </svg>
);

const ReportsIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <rect x="2" y="10" width="3" height="8" rx="0.5" />
    <rect x="7" y="6" width="3" height="12" rx="0.5" />
    <rect x="12" y="3" width="3" height="15" rx="0.5" />
    <rect x="17" y="8" width="1" height="0" rx="0" />
  </svg>
);

const GeofencesIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 2C6.7 2 4 4.7 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6z" />
    <circle cx="10" cy="8" r="2" fill="currentColor" />
  </svg>
);

const EventsIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 2a6 6 0 0 0-6 6c0 3 2 5.5 6 10 4-4.5 6-7 6-10a6 6 0 0 0-6-6z" fill="none" />
    <path d="M10 2v5l2 1-4 5v-4l-2-1 4-6z" fill="currentColor" stroke="none" />
  </svg>
);

const TokenIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="10" cy="10" r="7.5" />
    <circle cx="10" cy="10" r="5" strokeDasharray="3 2" />
    <text x="10" y="13" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">T</text>
  </svg>
);

const MarketplaceIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 7l2-4h12l2 4" />
    <rect x="2" y="7" width="16" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <path d="M4 9v8h12V9" />
    <rect x="7" y="12" width="6" height="5" rx="0.5" />
  </svg>
);

const UserMgmtIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <circle cx="7" cy="7" r="3" />
    <path d="M1 17c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
    <circle cx="14.5" cy="7.5" r="2.2" />
    <path d="M19 16.5c0-2.2-1.8-4-4.5-4-1 0-1.9.3-2.6.7" />
  </svg>
);

const AuditIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="2" width="14" height="16" rx="2" />
    <path d="M7 6h6M7 10h6M7 14h4" />
    <path d="M14 12l-2 2 1 1 3-3" strokeWidth="1.8" />
  </svg>
);

/** Map of module ID → icon component. Falls back to null for unknown modules. */
export const MODULE_ICONS: Record<string, React.FC<IconProps>> = {
  aegis:       DashboardIcon,
  "noc-bridge": LiveMonitoringIcon,
  gatehouse:   TrackPlaybackIcon,
  reports:     ReportsIcon,
  protocol:    GeofencesIcon,
  events:      EventsIcon,
  sim:         TokenIcon,
  veba:        MarketplaceIcon,
  rbac:        UserMgmtIcon,
  audit:       AuditIcon,
};

/** Get the icon component for a module, or undefined if none exists. */
export function getModuleIcon(moduleId: string): React.FC<IconProps> | undefined {
  return MODULE_ICONS[moduleId];
}
