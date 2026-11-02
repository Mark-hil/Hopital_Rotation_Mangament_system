import React from "react";

export const NAV_ICONS = {
  dashboard: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  wards: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 3v15" />
      <path d="M9 10h.01M9 14h.01M17 10h.01M17 14h.01" />
    </svg>
  ),
  register: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  ),
  assign: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  ),
  members: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  incharges: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  rotations: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  analytics: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  ),
  memberDashboard: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  ),
  inCharge: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
};

export function getNavForRole(role) {
  if (role === "Member") {
    return [
      { id: "memberDashboard", label: "My Rotations", icon: NAV_ICONS.memberDashboard }
    ];
  }
  if (role === "In-charge") {
    return [
      { id: "inCharge", label: "My Ward", icon: NAV_ICONS.inCharge }
    ];
  }
  // Admin / Supervisor Default
  return [
    { id: "dashboard", label: "Dashboard", icon: NAV_ICONS.dashboard },
    { id: "wards", label: "Wards", icon: NAV_ICONS.wards },
    { id: "assign", label: "Assign wards", icon: NAV_ICONS.assign },
    { id: "members", label: "Members", icon: NAV_ICONS.members },
    { id: "incharges", label: "In-charges", icon: NAV_ICONS.incharges },
    { id: "rotations", label: "Rotations", icon: NAV_ICONS.rotations },
    { id: "analytics", label: "Analytics & Reports", icon: NAV_ICONS.analytics },
    { id: "register", label: "Register", icon: NAV_ICONS.register },
  ];
}
