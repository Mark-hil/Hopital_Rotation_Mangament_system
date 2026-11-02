import React from "react";

export const STATUS_CFG = {
  active:            { bg: "#ECFDF5", color: "#065F46", dot: "#22C55E", label: "Active" },
  ending_soon:       { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ending soon" },
  completing_today:  { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ends today" },
  completed:         { bg: "#FFF1F2", color: "#BE123C", dot: "#F43F5E", label: "Completed — Ready" },
  upcoming:          { bg: "#F8FAFC", color: "#475569", dot: "#94A3B8", label: "Upcoming" },
  unassigned:        { bg: "#F8FAFC", color: "#64748B", dot: "#CBD5E1", label: "Unassigned" },
};

export function GroupBadge({ group }) {
  return group === "nursing" ? (
    <span
      style={{
        background: "#EEF2FF",
        color: "#4338CA",
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 99,
        display: "inline-block",
      }}
    >
      Nursing
    </span>
  ) : (
    <span
      style={{
        background: "#F0FDF4",
        color: "#166534",
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 99,
        display: "inline-block",
      }}
    >
      Midwifery
    </span>
  );
}

export function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unassigned;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 99,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
        }}
      />
      {cfg.label}
    </span>
  );
}
