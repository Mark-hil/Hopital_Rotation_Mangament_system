import { useState, useMemo, useEffect } from "react";
import { supabase } from "./lib/supabase";

// ─── Ward Data ────────────────────────────────────────────────────────────────
// Ward names are shared across groups; weeks differ per group.

const WARD_GROUPS = [
  {
    group: "Medical", color: "#EFF6FF", accent: "#3B82F6", textColor: "#1E40AF",
    wards: [
      { name: "Emergency",       nursing: 3, midwifery: 2 },
      { name: "Males' Ward",     nursing: 3, midwifery: 2 },
      { name: "Females' Ward",   nursing: 3, midwifery: 2 },
      { name: "Paediatric Ward", nursing: 3, midwifery: 2 },
      { name: "OPD",             nursing: 0, midwifery: 2 },
    ],
  },
  {
    group: "Surgical", color: "#F0FDF4", accent: "#22C55E", textColor: "#15803D",
    wards: [
      { name: "Surgical Ward",  nursing: 4, midwifery: 2 },
      { name: "Theatre",        nursing: 4, midwifery: 2 },
      { name: "Recovery Ward",  nursing: 4, midwifery: 2 },
    ],
  },
  {
    group: "Special Clinics", color: "#FFF7ED", accent: "#F97316", textColor: "#C2410C",
    wards: [
      { name: "Eye Clinic",                    nursing: 1, midwifery: 1 },
      { name: "ENT",                           nursing: 2, midwifery: 1 },
      { name: "Dental",                        nursing: 2, midwifery: 1 },
      { name: "Dialysis",                      nursing: 1, midwifery: 1 },
      { name: "Sickle Cell / HPT / DM Clinic", nursing: 1, midwifery: 0 },
      { name: "Isolation",                     nursing: 2, midwifery: 0 },
    ],
  },
  {
    group: "Obstetrics", color: "#FDF4FF", accent: "#A855F7", textColor: "#7E22CE",
    wards: [
      { name: "ANC/PNC Clinic", nursing: 2,  midwifery: 6  },
      { name: "ANC/PNC Ward",   nursing: 2,  midwifery: 4  },
      { name: "Labour Ward",    nursing: 3,  midwifery: 12 },
      { name: "NCU",            nursing: 3,  midwifery: 4  },
    ],
  },
  {
    group: "Public Health", color: "#ECFDF5", accent: "#10B981", textColor: "#065F46",
    wards: [
      { name: "Nutrition",                    nursing: 1, midwifery: 0 },
      { name: "RCH",                          nursing: 2, midwifery: 4 },
      { name: "HIV / ART Clinic",             nursing: 1, midwifery: 0 },
      { name: "HIV / ART",                    nursing: 0, midwifery: 2 },
      { name: "Nutrition & Health Promotion", nursing: 0, midwifery: 2 },
    ],
  },
  {
    group: "Psychiatry", color: "#FFF1F2", accent: "#F43F5E", textColor: "#BE123C",
    wards: [{ name: "Psychiatry", nursing: 8, midwifery: 4 }],
  },
];

const WARD_LOOKUP = {};
const ALL_WARD_NAMES = [];

// Department colour themes. Known departments keep their original palette;
// new departments created by admins get a stable colour from EXTRA_THEMES.
const DEPT_THEMES = Object.fromEntries(WARD_GROUPS.map(g => [g.group, { color: g.color, accent: g.accent, textColor: g.textColor }]));
const EXTRA_THEMES = [
  { color: "#F0F9FF", accent: "#0EA5E9", textColor: "#0369A1" },
  { color: "#FEFCE8", accent: "#EAB308", textColor: "#A16207" },
  { color: "#F5F3FF", accent: "#8B5CF6", textColor: "#6D28D9" },
  { color: "#FDF2F8", accent: "#EC4899", textColor: "#BE185D" },
  { color: "#F0FDFA", accent: "#14B8A6", textColor: "#0F766E" },
  { color: "#FEF2F2", accent: "#EF4444", textColor: "#B91C1C" },
];
function themeForDept(dept) {
  if (DEPT_THEMES[dept]) return DEPT_THEMES[dept];
  let h = 0;
  for (const ch of dept || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_THEMES[h % EXTRA_THEMES.length];
}

// Default rows (used when the `wards` table hasn't been created yet).
const DEFAULT_WARD_ROWS = WARD_GROUPS.flatMap((g, gi) => g.wards.map((w, wi) => ({
  id: null, name: w.name, department: g.group, nursing_weeks: w.nursing, midwifery_weeks: w.midwifery,
  capacity: null, sort_order: (gi * 10 + wi) * 10,
})));

function rebuildWardIndex() {
  Object.keys(WARD_LOOKUP).forEach(k => delete WARD_LOOKUP[k]);
  WARD_GROUPS.forEach((g) =>
    g.wards.forEach((w) => {
      WARD_LOOKUP[w.name] = { ...w, color: g.color, accent: g.accent, textColor: g.textColor, group: g.group };
    })
  );
  ALL_WARD_NAMES.splice(0, ALL_WARD_NAMES.length, ...WARD_GROUPS.flatMap(g => g.wards.map(w => w.name)));
}
rebuildWardIndex();

// Replace the in-memory ward list with rows from the `wards` table.
// Mutates WARD_GROUPS / WARD_LOOKUP / ALL_WARD_NAMES in place so every
// existing component keeps working without prop drilling.
function applyWardRows(rows) {
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
  const groups = [];
  const byDept = {};
  sorted.forEach(r => {
    if (!byDept[r.department]) {
      byDept[r.department] = { group: r.department, ...themeForDept(r.department), wards: [] };
      groups.push(byDept[r.department]);
    }
    byDept[r.department].wards.push({ id: r.id, name: r.name, nursing: r.nursing_weeks ?? 0, midwifery: r.midwifery_weeks ?? 0, capacity: r.capacity ?? null });
  });
  WARD_GROUPS.splice(0, WARD_GROUPS.length, ...groups);
  rebuildWardIndex();
}

// Status of a single assignment, relative to today.
function assignmentStatus(a) {
  const dl = daysLeft(a.endDate);
  const ds = Math.ceil((new Date(a.startDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (ds > 0) return "upcoming";
  if (dl < 0) return "completed";
  if (dl === 0) return "completing_today";
  if (dl <= 7) return "ending_soon";
  return "active";
}
const ACTIVE_STATUSES = ["active", "ending_soon", "completing_today"];

function weeksFor(group, wardName) { return WARD_LOOKUP[wardName]?.[group] ?? 0; }
function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}
function fmtDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name) { return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
function daysLeft(endDate) { return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)); }

const TOTAL_WEEKS = { nursing: 52, midwifery: 52 };

// Returns latest assignment for a member + computed status
function getLatestPlacement(memberId, assignments) {
  const ma = assignments
    .filter((a) => a.memberId === memberId)
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  if (!ma.length) return null;
  const latest = ma[0];
  const dl = daysLeft(latest.endDate);
  const now = new Date();
  const ds = Math.ceil((new Date(latest.startDate) - now) / (1000 * 60 * 60 * 24));
  let status;
  if (ds > 0) status = "upcoming";
  else if (dl < 0) status = "completed";
  else if (dl === 0) status = "completing_today";
  else if (dl <= 7) status = "ending_soon";
  else status = "active";
  return { ...latest, daysLeft: dl, status };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INP = {
  width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #E2E8F0",
  borderRadius: 8, background: "#F8FAFC", color: "#0F172A", boxSizing: "border-box", fontFamily: "inherit",
};
const LS = { display: "block", fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 6, letterSpacing: "0.05em" };
const CS = { background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: 14 };

// ─── Shared Components ────────────────────────────────────────────────────────

function Avatar({ name, group, size = 36 }) {
  const cfg = { nursing: { bg: "#EEF2FF", c: "#4338CA" }, midwifery: { bg: "#F0FDF4", c: "#166534" } };
  const { bg, c } = cfg[group] || cfg.nursing;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function GroupBadge({ group }) {
  return group === "nursing"
    ? <span style={{ background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>Nursing</span>
    : <span style={{ background: "#F0FDF4", color: "#166534", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>Midwifery</span>;
}

function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <div onClick={onChange} style={{ width: 18, height: 18, borderRadius: 5, border: checked || indeterminate ? "2px solid #6366F1" : "2px solid #CBD5E1", background: checked ? "#6366F1" : indeterminate ? "#6366F1" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all .12s" }}>
      {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {indeterminate && !checked && <div style={{ width: 8, height: 2, background: "#fff", borderRadius: 1 }} />}
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1E293B", color: "#fff", padding: "12px 24px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span style={{ color: "#4ADE80" }}>✓</span>{msg}
    </div>
  );
}

function FilterPills({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(({ val, label, count }) => (
        <button key={val} onClick={() => onChange(val)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 700, borderRadius: 99, cursor: "pointer", border: "1.5px solid", borderColor: value === val ? "#6366F1" : "#E2E8F0", background: value === val ? "#EEF2FF" : "#fff", color: value === val ? "#4338CA" : "#64748B", display: "flex", alignItems: "center", gap: 5 }}>
          {label}
          {count != null && <span style={{ background: value === val ? "#6366F1" : "#E2E8F0", color: value === val ? "#fff" : "#64748B", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:            { bg: "#ECFDF5", color: "#065F46", dot: "#22C55E", label: "Active" },
  ending_soon:       { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ending soon" },
  completing_today:  { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ends today" },
  completed:         { bg: "#FFF1F2", color: "#BE123C", dot: "#F43F5E", label: "Completed — Ready" },
  upcoming:          { bg: "#F8FAFC", color: "#475569", dot: "#94A3B8", label: "Upcoming" },
  unassigned:        { bg: "#F8FAFC", color: "#64748B", dot: "#CBD5E1", label: "Unassigned" },
};

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unassigned;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {cfg.label}
    </span>
  );
}

// ─── Reusable Pagination Component ──────────────────────────────────────────

function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange, itemsPerPageOptions = [5, 10, 20], itemLabel = "entries" }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  useEffect(() => {
    if (totalPages >= 1 && currentPage > totalPages) {
      onPageChange(totalPages);
    }
  }, [currentPage, totalPages, onPageChange]);

  if (totalItems <= itemsPerPageOptions[0] && totalItems <= itemsPerPage && totalPages <= 1) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderRadius: "0 0 16px 16px" }}>
        <span style={{ fontSize: 13, color: "#64748B" }}>
          Showing all <span style={{ fontWeight: 700, color: "#0F172A" }}>{totalItems}</span> {totalItems === 1 ? itemLabel.replace(/s$/, '') : itemLabel}
        </span>
      </div>
    );
  }

  function getPageNumbers() {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "14px 20px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderRadius: "0 0 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#64748B" }}>
          Showing <span style={{ fontWeight: 700, color: "#0F172A" }}>{startItem}</span>–<span style={{ fontWeight: 700, color: "#0F172A" }}>{endItem}</span> of <span style={{ fontWeight: 700, color: "#0F172A" }}>{totalItems}</span> {totalItems === 1 ? itemLabel.replace(/s$/, '') : itemLabel}
        </span>
        {onItemsPerPageChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{ padding: "4px 8px", fontSize: 12, fontWeight: 600, color: "#334155", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6, cursor: "pointer", outline: "none" }}
            >
              {itemsPerPageOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 7,
            border: "1px solid #E2E8F0",
            background: currentPage === 1 ? "transparent" : "#fff",
            color: currentPage === 1 ? "#CBD5E1" : "#334155",
            fontSize: 12,
            fontWeight: 600,
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            transition: "all 0.15s"
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          Prev
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: "#94A3B8", fontSize: 13 }}>…</span>;
          }
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                minWidth: 28,
                height: 28,
                padding: "0 6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 7,
                border: isActive ? "none" : "1px solid #E2E8F0",
                background: isActive ? "linear-gradient(135deg, #6366F1, #8B5CF6)" : "#fff",
                color: isActive ? "#fff" : "#334155",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                boxShadow: isActive ? "0 2px 6px rgba(99,102,241,0.3)" : "none",
                transition: "all 0.15s"
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 7,
            border: "1px solid #E2E8F0",
            background: currentPage === totalPages ? "transparent" : "#fff",
            color: currentPage === totalPages ? "#CBD5E1" : "#334155",
            fontSize: 12,
            fontWeight: 600,
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            transition: "all 0.15s"
          }}
        >
          Next
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Visual Charts & Analytics Components ─────────────────────────────────────

function WardCapacityBarChart({ wards, wardStats, onSelectWard }) {
  const [sortMode, setSortMode] = useState("occupied"); // "occupied", "pct", "name"

  const sortedWards = useMemo(() => {
    return [...wards].sort((a, b) => {
      const sta = wardStats[a.name] || { current: 0 };
      const stb = wardStats[b.name] || { current: 0 };
      if (sortMode === "occupied") return stb.current - sta.current;
      if (sortMode === "pct") {
        const pcta = a.capacity ? (sta.current / a.capacity) : 0;
        const pctb = b.capacity ? (stb.current / b.capacity) : 0;
        return pctb - pcta;
      }
      return a.name.localeCompare(b.name);
    });
  }, [wards, wardStats, sortMode]);

  const maxVal = useMemo(() => {
    return Math.max(
      8,
      ...wards.map(w => {
        const st = wardStats[w.name] || { current: 0 };
        return Math.max(w.capacity || 0, st.current || 0);
      })
    );
  }, [wards, wardStats]);

  return (
    <div className="chart-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
            Ward Bed Capacity vs. Active Trainees
          </h4>
          <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
            Live trainee load compared with hospital bed limits
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>SORT:</span>
          {[
            { id: "occupied", label: "Placed" },
            { id: "pct", label: "% Full" },
            { id: "name", label: "Name" }
          ].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSortMode(s.id)}
              style={{
                padding: "3px 9px",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                border: "1px solid",
                borderColor: sortMode === s.id ? "#6366F1" : "#E2E8F0",
                background: sortMode === s.id ? "#EEF2FF" : "#fff",
                color: sortMode === s.id ? "#4338CA" : "#64748B",
                cursor: "pointer"
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
        {sortedWards.map(w => {
          const st = wardStats[w.name] || { current: 0, nursing: 0, midwifery: 0 };
          const theme = themeForDept(w.department);
          const cap = w.capacity;
          const current = st.current;
          const over = cap && current > cap;
          const pct = cap ? Math.round((current / cap) * 100) : null;
          const barWidth = Math.min(100, (current / maxVal) * 100);
          const capMarker = cap ? Math.min(100, (cap / maxVal) * 100) : null;

          return (
            <div
              key={w.id || w.name}
              className="chart-bar-row"
              onClick={() => onSelectWard && onSelectWard(w)}
              style={{ cursor: onSelectWard ? "pointer" : "default" }}
            >
              <div style={{ width: 145, flexShrink: 0, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 10, color: theme.textColor, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent }} />
                  <span>{w.department}</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div style={{ flex: 1, position: "relative", height: 18, background: "#F1F5F9", borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center" }}>
                {/* Active Placed Fill */}
                <div
                  style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    background: over
                      ? "linear-gradient(90deg, #F43F5E, #E11D48)"
                      : pct >= 80
                        ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
                        : current > 0
                          ? "linear-gradient(90deg, #34D399, #10B981)"
                          : "transparent",
                    borderRadius: 6,
                    transition: "width 0.4s ease"
                  }}
                />

                {/* Capacity Target Line */}
                {capMarker !== null && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${capMarker}%`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: "#0F172A",
                      opacity: 0.45,
                      zIndex: 2
                    }}
                    title={`Capacity limit: ${cap}`}
                  />
                )}
              </div>

              {/* Metrics Right */}
              <div style={{ width: 95, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 700 }}>
                <span style={{ color: over ? "#BE123C" : pct >= 80 ? "#B45309" : current > 0 ? "#047857" : "#94A3B8" }}>
                  {current} <span style={{ fontWeight: 500, color: "#94A3B8" }}>/ {cap || "—"}</span>
                </span>
                {pct !== null && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: over ? "#E11D48" : "#64748B" }}>
                    ({pct}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9", paddingTop: 12, marginTop: 14, fontSize: 11, color: "#64748B", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#10B981" }} /> Healthy (&lt;80%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#F59E0B" }} /> Near Cap (&ge;80%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#E11D48" }} /> Over Cap
          </span>
        </div>
        <span style={{ fontStyle: "italic", fontSize: 10.5 }}>Dashed line = bed capacity</span>
      </div>
    </div>
  );
}

function DepartmentDistributionDonut({ departments, wards, wardStats }) {
  const [hoveredDept, setHoveredDept] = useState(null);

  const deptData = useMemo(() => {
    let totalPlacements = 0;
    const items = departments.map(d => {
      const dWards = wards.filter(w => w.department === d);
      const count = dWards.reduce((sum, w) => sum + (wardStats[w.name]?.current || 0), 0);
      totalPlacements += count;
      const theme = themeForDept(d);
      return { dept: d, count, wardsCount: dWards.length, theme };
    });

    const withPct = items.map(item => ({
      ...item,
      pct: totalPlacements > 0 ? (item.count / totalPlacements) : 0,
      pctInt: totalPlacements > 0 ? Math.round((item.count / totalPlacements) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    return { total: totalPlacements, items: withPct };
  }, [departments, wards, wardStats]);

  // SVG Donut calculations
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const segments = deptData.items.map(item => {
    const strokeDasharray = `${item.pct * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += item.pct * circumference;
    return { ...item, strokeDasharray, strokeDashoffset };
  });

  const activeItem = hoveredDept ? deptData.items.find(i => i.dept === hoveredDept) : null;

  return (
    <div className="chart-card">
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
          Departmental Trainee Distribution
        </h4>
        <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
          Allocation share of active rotations across hospital departments
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: 16, flex: 1 }}>
        {/* SVG Donut */}
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {deptData.total > 0 && segments.map(seg => (
              <circle
                key={seg.dept}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.theme.accent}
                strokeWidth={hoveredDept === seg.dept ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: "all 0.25s ease",
                  cursor: "pointer",
                  opacity: hoveredDept && hoveredDept !== seg.dept ? 0.45 : 1
                }}
                onMouseEnter={() => setHoveredDept(seg.dept)}
                onMouseLeave={() => setHoveredDept(null)}
              />
            ))}
          </svg>

          {/* Center text */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
              {activeItem ? activeItem.count : deptData.total}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: activeItem ? activeItem.theme.textColor : "#64748B", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", maxWidth: 100 }}>
              {activeItem ? activeItem.dept : "Total Placed"}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160, flex: 1 }}>
          {deptData.items.map(item => {
            const isHovered = hoveredDept === item.dept;
            return (
              <div
                key={item.dept}
                onMouseEnter={() => setHoveredDept(item.dept)}
                onMouseLeave={() => setHoveredDept(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  borderRadius: 8,
                  background: isHovered ? item.theme.color : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.theme.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.dept}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{item.count}</span>
                  <span style={{ fontSize: 11, color: "#64748B", minWidth: 30, textAlign: "right" }}>{item.pctInt}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CohortCompletionTierChart({ members, assignments }) {
  const tiers = useMemo(() => {
    let completed = 0; // 100%
    let advanced = 0;  // 75-99%
    let midway = 0;    // 25-74%
    let early = 0;     // <25%
    let totalPct = 0;

    members.forEach(m => {
      const wards = assignments.filter(a => a.memberId === m.id);
      const done = wards.reduce((s, a) => s + a.weeks, 0);
      const total = TOTAL_WEEKS[m.group] || 52;
      const pct = Math.round((done / total) * 100);
      totalPct += pct;

      if (pct >= 100) completed++;
      else if (pct >= 75) advanced++;
      else if (pct >= 25) midway++;
      else early++;
    });

    const totalCount = members.length || 1;
    const avg = members.length ? Math.round(totalPct / members.length) : 0;

    return {
      avg,
      list: [
        { label: "Completed (100%)", count: completed, color: "#10B981", bg: "#ECFDF5", icon: "🏆" },
        { label: "Advanced (75%–99%)", count: advanced, color: "#6366F1", bg: "#EEF2FF", icon: "🚀" },
        { label: "Mid-way (25%–74%)", count: midway, color: "#F59E0B", bg: "#FFFBEB", icon: "📈" },
        { label: "Early Stage (<25%)", count: early, color: "#94A3B8", bg: "#F8FAFC", icon: "🌱" },
      ].map(t => ({
        ...t,
        pct: Math.round((t.count / totalCount) * 100)
      }))
    };
  }, [members, assignments]);

  return (
    <div className="chart-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
            Cohort Curriculum Progression Funnel
          </h4>
          <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
            Trainee distribution across 52-week clinical competency stages
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#4338CA", lineHeight: 1 }}>{tiers.avg}%</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginTop: 2 }}>Avg Progress</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {tiers.list.map(t => (
          <div key={t.label} style={{ background: t.bg, border: `1px solid ${t.color}33`, borderRadius: 12, padding: "11px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.count} trainees</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>({t.pct}%)</span>
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${t.pct}%`, background: t.color, borderRadius: 99, transition: "width .4s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DisciplineComparisonWidget({ members, assignments }) {
  const stats = useMemo(() => {
    const calc = (grp) => {
      const list = members.filter(m => m.group === grp);
      const active = list.filter(m => {
        const p = getLatestPlacement(m.id, assignments);
        return p?.status === "active";
      }).length;
      const unassigned = list.filter(m => !getLatestPlacement(m.id, assignments)).length;
      let totalDone = 0;
      list.forEach(m => {
        const wards = assignments.filter(a => a.memberId === m.id);
        totalDone += wards.reduce((s, a) => s + a.weeks, 0);
      });
      const avgWeeks = list.length ? Math.round(totalDone / list.length) : 0;
      return { total: list.length, active, unassigned, avgWeeks };
    };
    return {
      nursing: calc("nursing"),
      midwifery: calc("midwifery"),
    };
  }, [members, assignments]);

  return (
    <div className="chart-card">
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
          Discipline Breakdown & Benchmarks
        </h4>
        <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
          Comparative rotation status between Nursing and Midwifery cohorts
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
        <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 14, padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#3730A3" }}>Nursing</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4338CA", background: "#fff", padding: "2px 8px", borderRadius: 99 }}>
              {stats.nursing.total} Members
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Active in Wards:</span>
              <span style={{ fontWeight: 700, color: "#059669" }}>{stats.nursing.active}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Unassigned:</span>
              <span style={{ fontWeight: 700, color: "#D97706" }}>{stats.nursing.unassigned}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Avg Weeks Done:</span>
              <span style={{ fontWeight: 700, color: "#3730A3" }}>{stats.nursing.avgWeeks} / 52w</span>
            </div>
          </div>
        </div>

        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>Midwifery</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#15803D", background: "#fff", padding: "2px 8px", borderRadius: 99 }}>
              {stats.midwifery.total} Members
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Active in Wards:</span>
              <span style={{ fontWeight: 700, color: "#059669" }}>{stats.midwifery.active}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Unassigned:</span>
              <span style={{ fontWeight: 700, color: "#D97706" }}>{stats.midwifery.unassigned}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Avg Weeks Done:</span>
              <span style={{ fontWeight: 700, color: "#166534" }}>{stats.midwifery.avgWeeks} / 52w</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsReportTab({ members, assignments, wardRows, onNavigateTab }) {
  const [filterGroup, setFilterGroup] = useState("all");
  const wards = useMemo(() => wardRows || DEFAULT_WARD_ROWS, [wardRows]);
  const departments = useMemo(() => [...new Set(wards.map(w => w.department))], [wards]);

  // Supervisors sync
  const [incharges, setIncharges] = useState([]);
  useEffect(() => {
    supabase.from("incharges").select("id, name, email, phone, wards").then(({ data }) => {
      if (data) setIncharges(data);
    });
    const ch = supabase.channel("analytics_incharges_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, () => {
        supabase.from("incharges").select("id, name, email, phone, wards").then(({ data }) => {
          if (data) setIncharges(data);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const supervisorsFor = (name) => incharges.filter(i => (i.wards || []).includes(name));

  const filteredMembers = useMemo(() => {
    if (filterGroup === "all") return members;
    return members.filter(m => m.group === filterGroup);
  }, [members, filterGroup]);

  const filteredAssignments = useMemo(() => {
    if (filterGroup === "all") return assignments;
    const memberIds = new Set(filteredMembers.map(m => m.id));
    return assignments.filter(a => memberIds.has(a.memberId));
  }, [assignments, filteredMembers, filterGroup]);

  const wardStats = useMemo(() => {
    const s = {};
    wards.forEach(w => {
      s[w.name] = { current: 0, upcoming: 0, completed: 0, nursing: 0, midwifery: 0 };
    });
    filteredAssignments.forEach(a => {
      const st = s[a.ward];
      if (!st) return;
      const status = assignmentStatus(a);
      if (ACTIVE_STATUSES.includes(status)) {
        st.current++;
        if (a.group === "midwifery") st.midwifery++; else st.nursing++;
      } else if (status === "upcoming") {
        st.upcoming++;
      } else {
        st.completed++;
      }
    });
    return s;
  }, [wards, filteredAssignments]);

  const totalPlaced = Object.values(wardStats).reduce((sum, v) => sum + v.current, 0);
  const totalCapacity = wards.filter(w => w.capacity).reduce((sum, w) => sum + w.capacity, 0);
  const monitoredPlaced = wards.filter(w => w.capacity).reduce((sum, w) => sum + (wardStats[w.name]?.current || 0), 0);
  const occupancyPct = totalCapacity > 0 ? Math.round((monitoredPlaced / totalCapacity) * 100) : 0;
  const supervisedCount = wards.filter(w => supervisorsFor(w.name).length > 0).length;
  const supervisedPct = wards.length > 0 ? Math.round((supervisedCount / wards.length) * 100) : 0;

  let totalPctSum = 0;
  let totalWeeksDelivered = 0;
  filteredMembers.forEach(m => {
    const mAssignments = filteredAssignments.filter(a => a.memberId === m.id);
    const done = mAssignments.reduce((s, a) => s + a.weeks, 0);
    totalWeeksDelivered += done;
    const total = TOTAL_WEEKS[m.group] || 52;
    totalPctSum += Math.min(100, Math.round((done / total) * 100));
  });
  const avgCohortProgress = filteredMembers.length ? Math.round(totalPctSum / filteredMembers.length) : 0;

  return (
    <div>
      {/* Header & Print Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A", margin: 0 }}>Clinical Analytics & Reports</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 9px", borderRadius: 99 }}>
              📊 Executive Visualizations
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 5, maxWidth: 650 }}>
            Visual hospital rotation metrics, ward occupancy benchmarks, and clinical competency progression reports.
          </p>
        </div>

        <div className="print-hide" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <FilterPills
            value={filterGroup}
            onChange={setFilterGroup}
            options={[
              { val: "all", label: "All Disciplines", count: members.length },
              { val: "nursing", label: "Nursing", count: members.filter(m => m.group === "nursing").length },
              { val: "midwifery", label: "Midwifery", count: members.filter(m => m.group === "midwifery").length },
            ]}
          />
          <button
            type="button"
            onClick={() => window.print()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 15px", background: "#0F172A", color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(15,23,42,0.2)" }}
          >
            <span>🖨️</span>
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#6366F1" }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Hospital Occupancy</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#3730A3", lineHeight: 1 }}>{occupancyPct}%</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", marginTop: 8 }}>
            {monitoredPlaced} / {totalCapacity || "—"} monitored bed capacity
          </div>
        </div>

        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#10B981" }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Active Trainee Load</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#065F46", lineHeight: 1 }}>{totalPlaced}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#059669", marginTop: 8 }}>
            Across {wards.filter(w => (wardStats[w.name]?.current || 0) > 0).length} active hospital wards
          </div>
        </div>

        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#F59E0B" }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Avg Cohort Progress</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#92400E", lineHeight: 1 }}>{avgCohortProgress}%</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#B45309", marginTop: 8 }}>
            {totalWeeksDelivered} cumulative training weeks logged
          </div>
        </div>

        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#0EA5E9" }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Clinical Oversight</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#0369A1", lineHeight: 1 }}>{supervisedPct}%</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0284C7", marginTop: 8 }}>
            {supervisedCount} of {wards.length} wards assigned supervisors
          </div>
        </div>
      </div>

      {/* Visual Chart Grid */}
      <div className="analytics-grid">
        <WardCapacityBarChart wards={wards} wardStats={wardStats} onSelectWard={() => onNavigateTab && onNavigateTab("wards")} />
        <DepartmentDistributionDonut departments={departments} wards={wards} wardStats={wardStats} />
      </div>

      <div className="analytics-grid">
        <CohortCompletionTierChart members={filteredMembers} assignments={filteredAssignments} />
        <DisciplineComparisonWidget members={members} assignments={assignments} />
      </div>

      {/* Executive Ward Allocation Summary Table */}
      <div style={{ marginTop: 12, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Hospital Ward Allocation & Status Matrix</h4>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Official clinical review of ward placements, supervisor coverage, and capacity status.</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", background: "#F1F5F9", padding: "4px 10px", borderRadius: 99 }}>
            {wards.length} Monitored Units
          </span>
        </div>

        <table className="responsive-table">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
              {["Ward", "Department", "Supervisors", "Placed / Cap", "Occupancy %", "Discipline Split", "Status"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wards.map((w, i) => {
              const st = wardStats[w.name] || { current: 0, nursing: 0, midwifery: 0 };
              const theme = themeForDept(w.department);
              const sups = supervisorsFor(w.name);
              const cap = w.capacity;
              const over = cap && st.current > cap;
              const pct = cap ? Math.round((st.current / cap) * 100) : null;
              return (
                <tr key={w.id || w.name} className="hover-row" style={{ background: i % 2 ? "#FAFAFC" : "#fff", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0F172A", fontSize: 13 }}>{w.name}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: theme.textColor, background: theme.color, border: `1px solid ${theme.accent}33`, padding: "2px 8px", borderRadius: 99 }}>
                      {w.department}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 12 }}>
                    {sups.length > 0 ? (
                      <span style={{ fontWeight: 600, color: "#334155" }}>{sups.map(s => s.name).join(", ")}</span>
                    ) : (
                      <span style={{ color: "#B45309", fontStyle: "italic", fontSize: 11 }}>Unsupervised</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: over ? "#BE123C" : pct >= 80 ? "#B45309" : "#1E293B" }}>
                    {st.current} / {cap || "—"}
                  </td>
                  <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                    {cap ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
                        <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: over ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: over ? "#E11D48" : "#475569" }}>{pct}%</span>
                      </div>
                    ) : <span style={{ color: "#94A3B8", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: "#64748B" }}>
                    {st.nursing} Nurs · {st.midwifery} Midw
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    {over ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9F1239", background: "#FFE4E6", border: "1px solid #FECDD3", padding: "2px 7px", borderRadius: 99 }}>Over Cap</span>
                    ) : pct !== null && pct >= 80 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "2px 7px", borderRadius: 99 }}>Near Cap</span>
                    ) : st.current > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 7px", borderRadius: 99 }}>Active</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B", background: "#F1F5F9", padding: "2px 7px", borderRadius: 99 }}>Empty</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardTab({ members, assignments, wardRows, onNavigateTab, onGoAssign }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Wards state & search/filter
  const wards = useMemo(() => wardRows || DEFAULT_WARD_ROWS, [wardRows]);
  const [wardSearch, setWardSearch] = useState("");
  const [wardDept, setWardDept] = useState("all");
  const [wardOcc, setWardOcc] = useState("all");
  const [showAllWards, setShowAllWards] = useState(false);
  const [wardViewMode, setWardViewMode] = useState("cards"); // "cards", "chart", "donut"
  const [dashMode, setDashMode] = useState("operations"); // "operations", "analytics"
  const [showCohortCharts, setShowCohortCharts] = useState(true);

  // In-charges sync for supervisor lookup
  const [incharges, setIncharges] = useState([]);
  useEffect(() => {
    supabase.from("incharges").select("id, name, email, phone, wards").then(({ data }) => {
      if (data) setIncharges(data);
    });
    const ch = supabase.channel("dashboard_incharges_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, () => {
        supabase.from("incharges").select("id, name, email, phone, wards").then(({ data }) => {
          if (data) setIncharges(data);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const supervisorsFor = (name) => incharges.filter(i => (i.wards || []).includes(name));

  // Compute ward stats: current placements, upcoming, discipline counts
  const wardStats = useMemo(() => {
    const s = {};
    wards.forEach(w => {
      s[w.name] = { current: 0, upcoming: 0, completed: 0, nursing: 0, midwifery: 0 };
    });
    assignments.forEach(a => {
      const st = s[a.ward];
      if (!st) return;
      const status = assignmentStatus(a);
      if (ACTIVE_STATUSES.includes(status)) {
        st.current++;
        if (a.group === "midwifery") st.midwifery++; else st.nursing++;
      } else if (status === "upcoming") {
        st.upcoming++;
      } else {
        st.completed++;
      }
    });
    return s;
  }, [wards, assignments]);

  // High-level ward metrics
  const wardMetrics = useMemo(() => {
    let totalCap = 0;
    let monitoredPlaced = 0;
    let overCount = 0;
    let nearCount = 0;
    let occupiedCount = 0;
    let emptyCount = 0;

    wards.forEach(w => {
      const st = wardStats[w.name] || { current: 0 };
      if (st.current > 0) occupiedCount++;
      else emptyCount++;

      if (w.capacity) {
        totalCap += w.capacity;
        monitoredPlaced += st.current;
        if (st.current > w.capacity) {
          overCount++;
        } else if (st.current / w.capacity >= 0.8 && st.current > 0) {
          nearCount++;
        }
      }
    });

    const occPct = totalCap > 0 ? Math.round((monitoredPlaced / totalCap) * 100) : 0;
    return {
      totalWards: wards.length,
      occupiedWards: occupiedCount,
      emptyWards: emptyCount,
      overCapacityWards: overCount,
      nearCapacityWards: nearCount,
      totalCapacity: totalCap,
      monitoredPlaced,
      overallOccupancyPct: occPct,
    };
  }, [wards, wardStats]);

  const departments = useMemo(() => [...new Set(wards.map(w => w.department))], [wards]);

  const filteredWards = useMemo(() => {
    return wards.filter(w => {
      const st = wardStats[w.name] || { current: 0 };
      const sm = !wardSearch.trim() || w.name.toLowerCase().includes(wardSearch.toLowerCase()) || w.department.toLowerCase().includes(wardSearch.toLowerCase());
      const dm = wardDept === "all" || w.department === wardDept;
      const isOver = w.capacity && st.current > w.capacity;
      const isNear = w.capacity && !isOver && (st.current / w.capacity >= 0.8) && st.current > 0;
      let om = true;
      if (wardOcc === "occupied") om = st.current > 0;
      else if (wardOcc === "empty") om = st.current === 0;
      else if (wardOcc === "near_over") om = isOver || isNear;
      return sm && dm && om;
    });
  }, [wards, wardStats, wardSearch, wardDept, wardOcc]);

  const displayedWards = useMemo(() => {
    if (showAllWards || wardSearch.trim() || wardDept !== "all" || wardOcc !== "all") {
      return filteredWards;
    }
    return filteredWards.slice(0, 8);
  }, [filteredWards, showAllWards, wardSearch, wardDept, wardOcc]);

  // Member placements
  const enriched = useMemo(() => members.map((m) => {
    const placement = getLatestPlacement(m.id, assignments);
    return { ...m, placement };
  }), [members, assignments]);

  const counts = {
    all: enriched.length,
    unassigned: enriched.filter((m) => !m.placement).length,
    active: enriched.filter((m) => m.placement?.status === "active").length,
    ending_soon: enriched.filter((m) => ["ending_soon", "completing_today"].includes(m.placement?.status)).length,
    completed: enriched.filter((m) => m.placement?.status === "completed").length,
  };
  const completedIds = enriched.filter((m) => m.placement?.status === "completed").map((m) => m.id);

  const nursingActive = enriched.filter(m => m.group === "nursing" && m.placement?.status === "active").length;
  const midwiferyActive = enriched.filter(m => m.group === "midwifery" && m.placement?.status === "active").length;

  const filtered = enriched.filter((m) => {
    const sm = m.name.toLowerCase().includes(search.toLowerCase()) || m.school.toLowerCase().includes(search.toLowerCase());
    if (!sm) return false;
    if (filter === "all") return true;
    if (filter === "unassigned") return !m.placement;
    if (filter === "active") return m.placement?.status === "active";
    if (filter === "ending_soon") return ["ending_soon", "completing_today"].includes(m.placement?.status);
    if (filter === "completed") return m.placement?.status === "completed";
    return true;
  });

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  return (
    <div>
      {/* Header & Quick Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A", margin: 0 }}>Clinical Rotation Dashboard</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#166534", background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "2px 9px", borderRadius: 99 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
              Live Hospital View
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 5, maxWidth: 640 }}>
            Live command center for hospital ward occupancy, departmental trainee capacity, and individual rotation timelines.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", padding: 3, background: "#F1F5F9", borderRadius: 10, border: "1px solid #E2E8F0" }}>
            <button
              type="button"
              onClick={() => setDashMode("operations")}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: dashMode === "operations" ? "#fff" : "transparent",
                color: dashMode === "operations" ? "#1E293B" : "#64748B",
                boxShadow: dashMode === "operations" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              🏥 Live Operations
            </button>
            <button
              type="button"
              onClick={() => setDashMode("analytics")}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: dashMode === "analytics" ? "#fff" : "transparent",
                color: dashMode === "analytics" ? "#4338CA" : "#64748B",
                boxShadow: dashMode === "analytics" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📊 Visual Analytics & Reports
            </button>
          </div>

          {onNavigateTab && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onNavigateTab("wards")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#1E293B", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}
              >
                <span>🏥</span>
                <span>Wards Directory</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab("assign")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#6366F1", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}
              >
                <span>+</span>
                <span>Assign Rotations</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {dashMode === "analytics" ? (
        <div style={{ marginTop: 8 }}>
          <AnalyticsReportTab
            members={members}
            assignments={assignments}
            wardRows={wardRows}
            onNavigateTab={onNavigateTab}
          />
        </div>
      ) : (
        <>
      {/* Metric cards */}
      <div className="dashboard-grid">
        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#10B981" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Rotations</div>
            <div style={{ fontSize: 20 }}>🏥</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#065F46", lineHeight: 1 }}>{counts.active}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#059669", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{nursingActive} Nursing · {midwiferyActive} Midwifery</span>
          </div>
        </div>

        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#6366F1" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ward Utilization</div>
            <div style={{ fontSize: 20 }}>🛏️</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#3730A3", lineHeight: 1 }}>
            {wardMetrics.occupiedWards} <span style={{ fontSize: 18, fontWeight: 600, color: "#94A3B8" }}>/ {wardMetrics.totalWards}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", marginTop: 8 }}>
            {wardMetrics.totalCapacity ? `${wardMetrics.overallOccupancyPct}% capacity (${wardMetrics.monitoredPlaced}/${wardMetrics.totalCapacity} spots)` : `${wardMetrics.occupiedWards} occupied · ${wardMetrics.emptyWards} empty`}
          </div>
        </div>

        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#F59E0B" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Unassigned Trainees</div>
            <div style={{ fontSize: 20 }}>👥</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#92400E", lineHeight: 1 }}>{counts.unassigned}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#B45309", marginTop: 8 }}>
            {counts.ending_soon > 0 ? `${counts.ending_soon} placement${counts.ending_soon === 1 ? "" : "s"} ending within 7d` : `${counts.all} total registered members`}
          </div>
        </div>

        <div className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#F43F5E" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Completed — Ready</div>
            <div style={{ fontSize: 20 }}>✅</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#BE123C", lineHeight: 1 }}>{counts.completed}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: counts.completed > 0 ? "#E11D48" : "#94A3B8", marginTop: 8 }}>
            {counts.completed > 0 ? "Awaiting next ward assignment" : "All members assigned"}
          </div>
        </div>
      </div>

      {/* Alert banner */}
      {counts.completed > 0 && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 16, padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 12px rgba(244,63,94,0.05)" }}>
          <div style={{ width: 44, height: 44, background: "#FFE4E6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#BE123C" }}>{counts.completed} member{counts.completed > 1 ? "s" : ""} have completed their placement and need reassignment</div>
            <div style={{ fontSize: 13, color: "#9F1239", marginTop: 2 }}>Click the button to immediately select all completed members and assign their next ward.</div>
          </div>
          <button onClick={() => onGoAssign(completedIds)} style={{ padding: "10px 18px", background: "#BE123C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s", boxShadow: "0 4px 12px rgba(190,18,60,0.3)" }} onMouseEnter={e => e.currentTarget.style.background = "#9F1239"} onMouseLeave={e => e.currentTarget.style.background = "#BE123C"}>
            Reassign all {counts.completed} →
          </button>
        </div>
      )}

      {/* Hospital Rotation Analytics & Visualizations Panel */}
      <div style={{ marginBottom: 36, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: "22px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                Hospital Clinical Graphics & Analytics
              </h3>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 8px", borderRadius: 99 }}>
                Interactive Visuals
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
              Live bed capacity comparisons, departmental trainee distribution, and 52-week clinical progression funnels.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowCohortCharts(!showCohortCharts)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: showCohortCharts ? "#C7D2FE" : "#E2E8F0",
                background: showCohortCharts ? "#EEF2FF" : "#fff",
                color: showCohortCharts ? "#4338CA" : "#64748B",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <span>{showCohortCharts ? "Hide Funnel & Disciplines ↑" : "Show Funnel & Disciplines (52w) ↓"}</span>
            </button>
            <button
              type="button"
              onClick={() => setDashMode("analytics")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "#0F172A",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(15,23,42,0.15)"
              }}
            >
              <span>Full Executive Report</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Primary 2-column Visual Chart Grid */}
        <div className="analytics-grid" style={{ marginBottom: showCohortCharts ? 16 : 0 }}>
          <WardCapacityBarChart wards={wards} wardStats={wardStats} onSelectWard={() => onNavigateTab && onNavigateTab("wards")} />
          <DepartmentDistributionDonut departments={departments} wards={wards} wardStats={wardStats} />
        </div>

        {/* Expandable Cohort & Discipline Charts */}
        {showCohortCharts && (
          <div className="analytics-grid" style={{ marginTop: 16 }}>
            <CohortCompletionTierChart members={members} assignments={assignments} />
            <DisciplineComparisonWidget members={members} assignments={assignments} />
          </div>
        )}
      </div>

      {/* Ward Clinical Occupancy & Capacity */}
      <div style={{ marginBottom: 36, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: "22px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18 }}>🏥</span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                Ward Clinical Occupancy & Capacity
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 8px", borderRadius: 99 }}>
                {wards.length} Wards
              </span>
              {wardMetrics.overCapacityWards > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9F1239", background: "#FFE4E6", border: "1px solid #FECDD3", padding: "2px 8px", borderRadius: 99 }}>
                  ⚠️ {wardMetrics.overCapacityWards} Over Capacity
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
              Live bed capacity tracking, trainee distribution by discipline, and clinical supervision across all hospital units.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", padding: 3, background: "#F1F5F9", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <button
                type="button"
                onClick={() => setWardViewMode("cards")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: wardViewMode === "cards" ? "#fff" : "transparent",
                  color: wardViewMode === "cards" ? "#1E293B" : "#64748B",
                  boxShadow: wardViewMode === "cards" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                Cards Grid
              </button>
              <button
                type="button"
                onClick={() => setWardViewMode("chart")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: wardViewMode === "chart" ? "#fff" : "transparent",
                  color: wardViewMode === "chart" ? "#4338CA" : "#64748B",
                  boxShadow: wardViewMode === "chart" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                📊 Capacity Chart
              </button>
              <button
                type="button"
                onClick={() => setWardViewMode("donut")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: wardViewMode === "donut" ? "#fff" : "transparent",
                  color: wardViewMode === "donut" ? "#4338CA" : "#64748B",
                  boxShadow: wardViewMode === "donut" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                🍩 Department Share
              </button>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("wards")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#4338CA", cursor: "pointer", transition: "all 0.15s ease" }}
              >
                <span>Wards Table</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>

        {wardViewMode === "chart" ? (
          <WardCapacityBarChart wards={wards} wardStats={wardStats} onSelectWard={() => onNavigateTab && onNavigateTab("wards")} />
        ) : wardViewMode === "donut" ? (
          <DepartmentDistributionDonut departments={departments} wards={wards} wardStats={wardStats} />
        ) : (
          <>
            {/* Department Quick Filter Strip */}
            {departments.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setWardDept("all")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 99,
                border: `1.5px solid ${wardDept === "all" ? "#6366F1" : "#E2E8F0"}`,
                background: wardDept === "all" ? "#EEF2FF" : "#fff",
                color: wardDept === "all" ? "#4338CA" : "#64748B",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              All Departments ({wards.length})
            </button>
            {departments.map(d => {
              const theme = themeForDept(d);
              const dWards = wards.filter(w => w.department === d);
              const dCurrent = dWards.reduce((sum, w) => sum + (wardStats[w.name]?.current || 0), 0);
              const isSelected = wardDept === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWardDept(isSelected ? "all" : d)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 99,
                    border: `1.5px solid ${isSelected ? theme.accent : "#E2E8F0"}`,
                    background: isSelected ? theme.color : "#fff",
                    color: isSelected ? theme.textColor : "#475569",
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: theme.accent }} />
                  <span>{d}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: isSelected ? "#fff" : "#F1F5F9", color: isSelected ? theme.textColor : "#64748B" }}>
                    {dCurrent} placed · {dWards.length}w
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Wards Search & Filter Toolbar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
            <div style={{ position: "relative", minWidth: 200, maxWidth: 260 }}>
              <svg width="14" height="14" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                style={{ ...INP, paddingLeft: 32, padding: "8px 12px 8px 32px", fontSize: 12.5, background: "#fff", borderRadius: 10 }}
                placeholder="Filter wards…"
                value={wardSearch}
                onChange={e => setWardSearch(e.target.value)}
              />
              {wardSearch && (
                <button
                  type="button"
                  onClick={() => setWardSearch("")}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94A3B8", fontSize: 15, cursor: "pointer" }}
                >
                  ×
                </button>
              )}
            </div>
            <FilterPills
              value={wardOcc}
              onChange={setWardOcc}
              options={[
                { val: "all", label: "All Statuses", count: wards.length },
                { val: "occupied", label: "Occupied", count: wardMetrics.occupiedWards },
                { val: "near_over", label: "Near / Over Cap", count: wardMetrics.nearCapacityWards + wardMetrics.overCapacityWards },
                { val: "empty", label: "Empty", count: wardMetrics.emptyWards },
              ]}
            />
          </div>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
            Showing {displayedWards.length} of {filteredWards.length} wards
          </div>
        </div>

        {/* Ward Cards Grid */}
        {filteredWards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 20px", color: "#94A3B8" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏥</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>No wards match your filters</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing your search or occupancy filter.</div>
          </div>
        ) : (
          <div className="dashboard-ward-grid">
            {displayedWards.map(w => {
              const st = wardStats[w.name] || { current: 0, upcoming: 0, nursing: 0, midwifery: 0 };
              const theme = themeForDept(w.department);
              const sup = supervisorsFor(w.name);
              const cap = w.capacity;
              const over = cap && st.current > cap;
              const pct = cap ? Math.round((st.current / cap) * 100) : null;
              return (
                <div
                  key={w.id || w.name}
                  className="dashboard-ward-card"
                  onClick={() => onNavigateTab && onNavigateTab("wards")}
                  style={{
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: 14,
                    padding: "16px 16px 14px",
                    position: "relative",
                    overflow: "hidden",
                    cursor: onNavigateTab ? "pointer" : "default"
                  }}
                >
                  {/* Top color bar */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3.5, background: theme.accent }} />

                  {/* Header: Department + Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: theme.textColor, background: theme.color, border: `1px solid ${theme.accent}33`, padding: "2px 8px", borderRadius: 99 }}>
                      {w.department}
                    </span>
                    {over ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9F1239", background: "#FFE4E6", border: "1px solid #FECDD3", padding: "2px 7px", borderRadius: 99 }}>
                        Over Cap
                      </span>
                    ) : pct !== null && pct >= 80 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "2px 7px", borderRadius: 99 }}>
                        Near Cap
                      </span>
                    ) : st.current > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 7px", borderRadius: 99 }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B", background: "#F1F5F9", padding: "2px 7px", borderRadius: 99 }}>
                        Empty
                      </span>
                    )}
                  </div>

                  {/* Ward Title & Weeks */}
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: "10px 0 2px", letterSpacing: "-0.01em" }}>
                    {w.name}
                  </h4>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    Nursing {w.nursing_weeks ? `${w.nursing_weeks}w` : "—"} · Midwifery {w.midwifery_weeks ? `${w.midwifery_weeks}w` : "—"}
                  </div>

                  {/* Occupancy & Progress Meter */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                        {st.current} <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{st.current === 1 ? "placed" : "placed"}</span>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: over ? "#E11D48" : pct >= 80 ? "#D97706" : "#64748B" }}>
                        {cap ? `${pct}% of ${cap}` : "No limit"}
                      </span>
                    </div>
                    {cap ? (
                      <div style={{ height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            height: "100%",
                            background: over ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981",
                            transition: "width .3s ease"
                          }}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Breakdown pill */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "#64748B", background: "#F8FAFC", borderRadius: 8, padding: "5px 8px" }}>
                    <span>{st.nursing} Nurs · {st.midwifery} Midw</span>
                    {st.upcoming > 0 ? (
                      <span style={{ color: "#4338CA", fontWeight: 700 }}>+{st.upcoming} upcoming</span>
                    ) : (
                      <span style={{ color: "#94A3B8" }}>0 upcoming</span>
                    )}
                  </div>

                  {/* Supervision Footer */}
                  <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#475569" }}>
                    <span style={{ fontSize: 12 }}>🩺</span>
                    {sup.length > 0 ? (
                      <span style={{ fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sup.map(s => s.name).join(", ")}
                      </span>
                    ) : (
                      <span style={{ color: "#B45309", fontStyle: "italic", fontSize: 10.5 }}>Unassigned supervisor</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show all wards toggle */}
        {filteredWards.length > 8 && !wardSearch.trim() && wardDept === "all" && wardOcc === "all" && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowAllWards(!showAllWards)}
              style={{
                padding: "8px 18px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
                color: "#4338CA",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {showAllWards ? "Show less ↑" : `Show all ${filteredWards.length} wards (${filteredWards.length - 8} more) ↓`}
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {/* Member Placements Roster Section Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
              Live Member Placements Roster
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
              Detailed trainee rotation status, placement durations, and upcoming reassignment workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          <div style={{ position: "relative", minWidth: 220, maxWidth: 280 }}>
            <svg width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={{ ...INP, paddingLeft: 36, paddingRight: search ? 30 : 12, padding: "9px 12px 9px 36px", background: "#fff", borderRadius: 10 }}
              placeholder="Search member or school…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setPage(1); }}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94A3B8", fontSize: 16, cursor: "pointer", padding: 2, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            )}
          </div>
          <FilterPills
            value={filter}
            onChange={(val) => { setFilter(val); setPage(1); }}
            options={[
              { val: "all", label: "All", count: counts.all },
              { val: "unassigned", label: "Unassigned", count: counts.unassigned },
              { val: "active", label: "Active", count: counts.active },
              { val: "ending_soon", label: "Ending soon", count: counts.ending_soon },
              { val: "completed", label: "Completed", count: counts.completed },
            ]}
          />
        </div>
        <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", background: "#fff" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members found</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
          </div>
        ) : (
          <>
            <table className="responsive-table">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  {["Member", "Group", "Current ward", "Started", "Ends", "Days left", "Status", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((m, i) => {
                  const p = m.placement;
                  const wd = p ? WARD_LOOKUP[p.ward] : null;
                  const isCompleted = p?.status === "completed";
                  const isEndingSoon = ["ending_soon", "completing_today"].includes(p?.status);
                  return (
                    <tr key={m.id} style={{ background: isCompleted ? "#FFF1F2" : isEndingSoon ? "#FFFBEB" : i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} className="hover-row">
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar name={m.name} group={m.group} size={36} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.school}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><GroupBadge group={m.group} /></td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {p ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: wd?.accent || "#CBD5E1", flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: wd?.textColor || "#334155", fontSize: 13 }}>{p.ward}</span>
                            <span style={{ fontSize: 11, color: "#94A3B8" }}>({p.weeks}w)</span>
                          </div>
                        ) : <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle", color: "#64748B", fontSize: 13 }}>{p ? fmtDate(p.startDate) : "—"}</td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle", color: "#64748B", fontSize: 13 }}>{p ? fmtDate(p.endDate) : "—"}</td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {p ? (
                          p.daysLeft < 0
                            ? <span style={{ fontWeight: 700, color: "#BE123C", fontSize: 13 }}>{Math.abs(p.daysLeft)}d ago</span>
                            : p.daysLeft === 0
                              ? <span style={{ fontWeight: 700, color: "#EA580C", fontSize: 13 }}>Today</span>
                              : <span style={{ fontWeight: 700, color: p.daysLeft <= 7 ? "#EA580C" : "#334155", fontSize: 13 }}>{p.daysLeft}d</span>
                        ) : <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <StatusChip status={p?.status || "unassigned"} />
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {(isCompleted || !p) && (
                          <button onClick={() => onGoAssign(m.id)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1.5px solid", borderColor: isCompleted ? "#FECDD3" : "#E2E8F0", background: isCompleted ? "#FFF1F2" : "#F8FAFC", color: isCompleted ? "#BE123C" : "#64748B", whiteSpace: "nowrap" }}>
                            {isCompleted ? "Reassign →" : "Assign →"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={setPerPage}
              itemsPerPageOptions={[5, 10, 20, 50]}
            />
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { dot: "#CBD5E1", label: "Unassigned — no ward yet" },
          { dot: "#22C55E", label: "Active — currently placed" },
          { dot: "#F97316", label: "Ending within 7 days" },
          { dot: "#F43F5E", label: "Completed — ready to reassign" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748B" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.dot, display: "inline-block" }} />
            {l.label}
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────


function RegFormField({ id, label, type, placeholder, value, onChange, error }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>
      <input
        style={{ ...INP, padding: "11px 14px", borderColor: error ? "#FCA5A5" : "#E2E8F0", background: "#F8FAFC" }}
        type={type || "text"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "#6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
        onBlur={e => { e.target.style.background = "#F8FAFC"; e.target.style.borderColor = error ? "#FCA5A5" : "#E2E8F0"; e.target.style.boxShadow = "none"; }}
      />
      {error && <p style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}><span>{"⚠️"}</span>{error}</p>}
    </div>
  );
}

function PasswordField({ value, onChange, showPw, onToggle, error }) {
  const inputStyle = { ...INP, padding: "11px 14px", paddingRight: 44, borderColor: error ? "#FCA5A5" : "#E2E8F0", background: "#F8FAFC" };
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Password</label>
      <div style={{ position: "relative" }}>
        <input style={inputStyle} type={showPw ? "text" : "password"} placeholder="••••••••" value={value} onChange={onChange}
          onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "#6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
          onBlur={e => { e.target.style.background = "#F8FAFC"; e.target.style.borderColor = error ? "#FCA5A5" : "#E2E8F0"; e.target.style.boxShadow = "none"; }} />
        <button type="button" onClick={onToggle} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
          {showPw
            ? <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}><span>{"⚠️"}</span>{error}</p>}
    </div>
  );
}

function RegisterTab({ onRegister, adminMode = false, initialRole = "Member" }) {
  const [role, setRole] = useState(initialRole || "Member");
  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", school: "", group: "nursing", wards: [] });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isIncharge = adminMode && role === "In-charge";
  const allWardNames = WARD_GROUPS.flatMap(g => g.wards.map(w => w.name));
  const allSelected = allWardNames.length > 0 && allWardNames.every(n => form.wards.includes(n));

  function submit() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.password.trim()) e.password = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!isIncharge && !form.school.trim()) e.school = "Required";
    if (isIncharge && form.wards.length === 0) e.wards = "Select at least one ward";
    setErrors(e);
    if (Object.keys(e).length) return;
    onRegister({ ...form, role });
  }

  function toggleWard(name) {
    setForm(f => ({ ...f, wards: f.wards.includes(name) ? f.wards.filter(x => x !== name) : [...f.wards, name] }));
  }

  function toggleAll() {
    setForm(f => ({ ...f, wards: allSelected ? [] : allWardNames }));
  }



  return (
    <div style={{ maxWidth: isIncharge ? 860 : 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>{isIncharge ? "Register ward in-charge" : "Register member"}</h2>
        <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>{isIncharge ? "Create a login account for a ward in-charge and assign their ward(s)." : "Add a new nurse or midwife to the 2023/2024 rotation."}</p>
      </div>

      {adminMode && (
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {[{ val: "Member", icon: "🏥", title: "Member", sub: "Nurse or Midwife" }, { val: "In-charge", icon: "🔑", title: "In-charge", sub: "Ward supervisor" }].map(r => (
            <button key={r.val} onClick={() => { setRole(r.val); setErrors({}); }} style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: role === r.val ? "2px solid #6366F1" : "1.5px solid #E2E8F0", background: role === r.val ? "#EEF2FF" : "#fff", borderRadius: 12, cursor: "pointer", transition: "all 0.15s", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: role === r.val ? "#6366F1" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{r.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: role === r.val ? "#4338CA" : "#0F172A" }}>{r.title}</div>
                <div style={{ fontSize: 12, color: role === r.val ? "#6366F1" : "#64748B", marginTop: 2 }}>{r.sub}</div>
              </div>
              {role === r.val && (
                <div style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: "50%", background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {isIncharge ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div className="premium-card" style={{ padding: "28px", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#6366F1" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Personal details</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Account credentials</div>
              </div>
            </div>
            <RegFormField id="name" label="Full name" placeholder="e.g. Abena Mensah" value={form.name} onChange={set("name")} error={errors.name} />
            <RegFormField id="email" label="Email address" type="email" placeholder="e.g. abena@hospital.com" value={form.email} onChange={set("email")} error={errors.email} />
            <RegFormField id="phone" label="Phone number" type="tel" placeholder="e.g. 0244 000 000" value={form.phone} onChange={set("phone")} error={errors.phone} />
            <PasswordField value={form.password} onChange={set("password")} showPw={showPw} onToggle={() => setShowPw(s => !s)} error={errors.password} />
            <button onClick={submit} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)", marginTop: 8, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              Create in-charge account →
            </button>
          </div>

          <div className="premium-card" style={{ padding: "28px", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" fill="none" stroke="#F97316" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Assign wards</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Select one or more</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {form.wards.length > 0 && <span style={{ background: "#6366F1", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{form.wards.length} selected</span>}
                <button onClick={toggleAll} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: allSelected ? "#FFF1F2" : "#F8FAFC", color: allSelected ? "#BE123C" : "#475569", cursor: "pointer" }}>{allSelected ? "Deselect all" : "Select all"}</button>
              </div>
            </div>

            {errors.wards && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", background: "#FFF1F2", borderRadius: 8, marginBottom: 14, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.wards}
              </div>
            )}

            {form.wards.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, padding: "10px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                {form.wards.map(w => {
                  const info = WARD_LOOKUP[w];
                  return (
                    <span key={w} onClick={() => toggleWard(w)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: info?.color || "#EEF2FF", color: info?.textColor || "#4338CA", border: "1px solid " + (info?.accent || "#6366F1") + "40", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, cursor: "pointer" }}>
                      {w}
                      <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 360, overflowY: "auto", paddingRight: 2 }}>
              {WARD_GROUPS.map(g => (
                <div key={g.group}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: g.accent }} />{g.group}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {g.wards.map(w => {
                      const checked = form.wards.includes(w.name);
                      return (
                        <div key={w.name} onClick={() => toggleWard(w.name)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 9, cursor: "pointer", background: checked ? g.color : "#F8FAFC", border: "1.5px solid " + (checked ? g.accent + "60" : "transparent"), transition: "all 0.12s" }} onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "#F1F5F9"; }} onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "#F8FAFC"; }}>
                          <div style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, border: "2px solid " + (checked ? g.accent : "#CBD5E1"), background: checked ? g.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                            {checked && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? g.textColor : "#334155", flex: 1 }}>{w.name}</span>
                          {checked && <div style={{ width: 6, height: 6, borderRadius: "50%", background: g.accent, flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (
        <div className="premium-card" style={{ padding: "32px", borderRadius: 16 }}>
          <RegFormField id="name" label="Full name" placeholder="e.g. Abena Mensah" value={form.name} onChange={set("name")} error={errors.name} />
          <RegFormField id="email" label="Email address" type="email" placeholder="e.g. abena@rota.com" value={form.email} onChange={set("email")} error={errors.email} />
          <RegFormField id="phone" label="Phone number" type="tel" placeholder="e.g. 0244 000 000" value={form.phone} onChange={set("phone")} error={errors.phone} />
          <PasswordField value={form.password} onChange={set("password")} showPw={showPw} onToggle={() => setShowPw(s => !s)} error={errors.password} />
          <RegFormField id="school" label="Training institution" placeholder="e.g. Korle Bu School of Nursing" value={form.school} onChange={set("school")} error={errors.school} />
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>GROUP</label>
            <div className="register-grid">
              {[{ val: "nursing", icon: "🏥", title: "General Nursing", desc: "52-week programme" }, { val: "midwifery", icon: "👶", title: "Midwifery", desc: "52-week programme" }].map((g) => (
                <div key={g.val} onClick={() => setForm((f) => ({ ...f, group: g.val }))} style={{ border: form.group === g.val ? "2px solid #6366F1" : "1.5px solid #E2E8F0", background: form.group === g.val ? "#EEF2FF" : "#fff", borderRadius: 12, padding: "16px", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 6, opacity: form.group === g.val ? 1 : 0.7 }} onMouseEnter={e => { if (form.group !== g.val) { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.opacity = 1; } }} onMouseLeave={e => { if (form.group !== g.val) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.opacity = 0.7; } }}>
                  <div style={{ fontSize: 26 }}>{g.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: form.group === g.val ? "#4338CA" : "#0F172A" }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: form.group === g.val ? "#6366F1" : "#64748B" }}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={submit} style={{ width: "100%", padding: "14px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.2)", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
            Complete Registration
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Assign (mixed-group aware) ───────────────────────────────────────────────

function AssignTab({ members, assignments, onBulkAssign, initialTargetIds }) {
  const targetMember = initialTargetIds?.length === 1 ? members.find(m => m.id === initialTargetIds[0]) : null;
  const [selectedIds, setSelectedIds] = useState(new Set(initialTargetIds || []));
  const [filterGroup, setFilterGroup] = useState("all");
  const [search, setSearch] = useState(targetMember ? targetMember.name : "");
  const [selectedWardName, setSelectedWardName] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);

  const selectedMembers = members.filter((m) => selectedIds.has(m.id));
  const hasN = selectedMembers.some((m) => m.group === "nursing");
  const hasM = selectedMembers.some((m) => m.group === "midwifery");
  const isMixed = hasN && hasM;

  const visibleWardGroups = useMemo(() => {
    if (!selectedMembers.length) return [];
    return WARD_GROUPS.map((g) => ({
      ...g,
      wards: g.wards.filter((w) => (hasN && w.nursing > 0) || (hasM && w.midwifery > 0)),
    })).filter((g) => g.wards.length > 0);
  }, [selectedMembers.length, hasN, hasM]);

  const visibleMembers = useMemo(() => members.filter((m) => {
    const gm = filterGroup === "all" || m.group === filterGroup;
    const sm = m.name.toLowerCase().includes(search.toLowerCase()) || m.school.toLowerCase().includes(search.toLowerCase());
    return gm && sm;
  }), [members, filterGroup, search]);

  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * perPage;
    return visibleMembers.slice(start, start + perPage);
  }, [visibleMembers, page, perPage]);

  function toggle(id) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); setSelectedWardName(null); }
  function toggleAll() {
    const allSel = visibleMembers.every((m) => selectedIds.has(m.id));
    setSelectedIds(allSel ? new Set() : new Set(visibleMembers.map((m) => m.id)));
    setSelectedWardName(null);
  }

  function wardStatus(wardName) {
    const rel = selectedMembers.filter((m) => weeksFor(m.group, wardName) > 0);
    if (!rel.length) return "none";
    const done = rel.filter((m) => assignments.some((a) => a.memberId === m.id && a.ward === wardName));
    if (done.length === rel.length) return "all";
    if (done.length > 0) return "some";
    return "none";
  }

  const ap = selectedMembers.map((m) => ({
    ...m,
    weeks: weeksFor(m.group, selectedWardName),
    alreadyAssigned: assignments.some((a) => a.memberId === m.id && a.ward === selectedWardName),
  }));
  const assignable = ap.filter((m) => m.weeks > 0 && !m.alreadyAssigned);

  function confirmAssign() {
    if (!selectedWardName || !assignable.length) return;
    const list = assignable.map((m) => ({
      id: Date.now() + Math.random(), memberId: m.id, memberName: m.name, group: m.group,
      ward: selectedWardName, weeks: m.weeks, startDate, endDate: addWeeks(startDate, m.weeks),
    }));
    onBulkAssign(list);
    setSelectedIds(new Set()); setSelectedWardName(null);
  }

  const swd = selectedWardName ? WARD_LOOKUP[selectedWardName] : null;
  const completedIds = new Set(members.filter((m) => getLatestPlacement(m.id, assignments)?.status === "completed").map((m) => m.id));

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Assign ward placement</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Select any mix of members — weeks auto-adjust per each member's programme.</p>
      </div>
      <div className="assign-layout">
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ ...INP, maxWidth: 220, flex: 1, padding: "10px 14px", background: "#fff" }} placeholder="Search members…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <FilterPills value={filterGroup} onChange={(v) => { setFilterGroup(v); setPage(1); }} options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]} />
            {selectedIds.size > 0 && (
              <button onClick={() => { setSelectedIds(new Set()); setSelectedWardName(null); }} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, borderRadius: 99, border: "1.5px solid #FCA5A5", background: "#FFF1F2", color: "#BE123C", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#FFE4E6"} onMouseLeave={e => e.currentTarget.style.background = "#FFF1F2"}>
                Clear ({selectedIds.size})
              </button>
            )}
          </div>
          {members.length === 0
            ? <div className="premium-card" style={{ padding: "60px 40px", textAlign: "center", color: "#94A3B8", borderRadius: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members registered</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>Go to the Register tab to add your first member.</div>
              </div>
            : <div className="table-wrapper">
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14, background: "rgba(248, 250, 252, 0.5)" }}>
                <Checkbox checked={visibleMembers.length > 0 && visibleMembers.every((m) => selectedIds.has(m.id))} indeterminate={visibleMembers.some((m) => selectedIds.has(m.id)) && !visibleMembers.every((m) => selectedIds.has(m.id))} onChange={toggleAll} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}</span>
                {isMixed && <span style={{ fontSize: 11, background: "#EEF2FF", color: "#4338CA", padding: "4px 10px", borderRadius: 99, fontWeight: 700, marginLeft: "auto" }}>Mixed — weeks auto-adjust ✓</span>}
              </div>
              {visibleMembers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94A3B8" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No matching members</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your search query or group filter.</div>
                </div>
              ) : (
                paginatedMembers.map((m) => {
                  const isSel = selectedIds.has(m.id);
                  const isDone = completedIds.has(m.id);
                  const preview = isSel && selectedWardName ? weeksFor(m.group, selectedWardName) : null;
                  const alreadyHas = isSel && selectedWardName && assignments.some((a) => a.memberId === m.id && a.ward === selectedWardName);
                  const latest = getLatestPlacement(m.id, assignments);
                  return (
                    <div key={m.id} onClick={() => toggle(m.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #F1F5F9", cursor: "pointer", background: isSel ? "#EEF2FF" : isDone ? "#FFF1F2" : "#fff", transition: "background 0.2s" }} onMouseEnter={e => { if(!isSel && !isDone) e.currentTarget.style.background = "#F8FAFC" }} onMouseLeave={e => { if(!isSel && !isDone) e.currentTarget.style.background = "#fff" }}>
                      <Checkbox checked={isSel} onChange={() => toggle(m.id)} />
                      <Avatar name={m.name} group={m.group} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#0F172A" }}>
                          {m.name}
                          {isDone && <span style={{ fontSize: 10, background: "#FFF1F2", color: "#BE123C", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>Completed</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {latest ? `${latest.ward} · ends ${fmtDate(latest.endDate)}` : m.school}
                        </div>
                      </div>
                      <GroupBadge group={m.group} />
                      {isSel && selectedWardName
                        ? (preview > 0
                          ? <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: alreadyHas ? "#F1F5F9" : "#ECFDF5", color: alreadyHas ? "#94A3B8" : "#065F46", whiteSpace: "nowrap" }}>{alreadyHas ? "done" : `${preview}w`}</span>
                          : <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: "#F1F5F9", color: "#94A3B8" }}>N/A</span>)
                        : <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>{assignments.filter((a) => a.memberId === m.id).length} wards</span>
                      }
                    </div>
                  );
                })
              )}
              <Pagination
                currentPage={page}
                totalItems={visibleMembers.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
                itemsPerPageOptions={[5, 8, 15, 25]}
                itemLabel="members"
              />
            </div>
          }
        </div>

        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedIds.size > 0 && (
            <div className="premium-card" style={{ padding: "24px", borderRadius: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>SELECTED ({selectedIds.size})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedMembers.map((m) => (
                  <div key={m.id} onClick={(e) => { e.stopPropagation(); toggle(m.id); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"} onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                    <Avatar name={m.name} group={m.group} size={20} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{m.name.split(" ")[0]}</span>
                    <span style={{ color: "#94A3B8", fontSize: 14, marginLeft: 2 }}>×</span>
                  </div>
                ))}
              </div>
              {isMixed && (
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: "#EEF2FF", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}><div style={{ fontWeight: 700, color: "#4338CA" }}>🏥 Nursing ({selectedMembers.filter((m) => m.group === "nursing").length})</div></div>
                  <div style={{ flex: 1, background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}><div style={{ fontWeight: 700, color: "#166534" }}>👶 Midwifery ({selectedMembers.filter((m) => m.group === "midwifery").length})</div></div>
                </div>
              )}
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="premium-card" style={{ padding: "24px", maxHeight: 400, overflowY: "auto", borderRadius: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>CHOOSE WARD</div>
              {visibleWardGroups.map((grp) => (
                <div key={grp.group} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{grp.group}</span><div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
                  </div>
                  <div className="wards-grid">
                    {grp.wards.map((w) => {
                      const st = wardStatus(w.name); const sel = selectedWardName === w.name;
                      return (
                        <div key={w.name} onClick={() => st !== "all" && setSelectedWardName(sel ? null : w.name)} style={{ border: sel ? `2px solid ${grp.accent}` : "1px solid #E2E8F0", background: sel ? grp.color : st === "all" ? "#F8FAFC" : "#fff", borderRadius: 10, padding: "10px 12px", cursor: st === "all" ? "default" : "pointer", opacity: st === "all" ? 0.45 : 1, transition: "all 0.15s" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: sel ? grp.textColor : "#334155" }}>{w.name}</div>
                          {isMixed ? (
                            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {w.nursing > 0 && <span style={{ fontSize: 10, background: "#EEF2FF", color: "#4338CA", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>N:{w.nursing}w</span>}
                              {w.midwifery > 0 && <span style={{ fontSize: 10, background: "#F0FDF4", color: "#166534", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>M:{w.midwifery}w</span>}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, fontWeight: 600 }}>
                              {selectedMembers[0] ? w[selectedMembers[0].group] : w.nursing} weeks{st === "some" ? " · some done" : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedWardName && assignable.length > 0 && (
            <div className="premium-card" style={{ padding: "24px", borderRadius: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>CONFIRM</div>
              <div style={{ background: swd?.color || "#F8FAFC", borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: `1px solid ${swd?.accent}30` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: swd?.textColor || "#0F172A" }}>{selectedWardName}</div>
                <div style={{ fontSize: 12, color: swd?.textColor || "#64748B", marginTop: 4 }}>{assignable.length} member{assignable.length > 1 ? "s" : ""} to assign</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                {ap.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <Avatar name={m.name} group={m.group} size={28} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: m.alreadyAssigned || m.weeks === 0 ? "#94A3B8" : "#0F172A" }}>{m.name.split(" ")[0]}</span>
                    <GroupBadge group={m.group} />
                    {m.alreadyAssigned ? <span style={{ fontSize: 12, color: "#94A3B8" }}>done</span>
                      : m.weeks === 0 ? <span style={{ fontSize: 12, color: "#94A3B8" }}>N/A</span>
                        : <span style={{ fontSize: 12, fontWeight: 700, background: "#ECFDF5", color: "#065F46", padding: "3px 10px", borderRadius: 99 }}>{m.weeks}w</span>}
                  </div>
                ))}
              </div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>START DATE</label>
              <input type="date" style={{ ...INP, padding: "12px 14px", marginBottom: 20, background: "#F8FAFC", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)" }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <button 
                onClick={confirmAssign} 
                style={{ width: "100%", padding: "14px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.2)", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                Assign {assignable.length} member{assignable.length > 1 ? "s" : ""} →
              </button>
            </div>
          )}

          {selectedIds.size === 0 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #CBD5E1", padding: "60px 30px", textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>Select members first</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Choose members from the left panel to configure their placement.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Confirm Modal ───────────────────────────────────────────────────

function ConfirmModal({ isOpen, title, message, confirmText = "Delete", confirmVariant = "danger", onConfirm, onCancel, loading = false }) {
  if (!isOpen) return null;
  const isDanger = confirmVariant === "danger";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
      <div className="premium-card" style={{ padding: 24, borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: isDanger ? "#FFF1F2" : "#EEF2FF", color: isDanger ? "#E11D48" : "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isDanger ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</h3>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, marginTop: 6 }}>
              {message}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ padding: "9px 16px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ padding: "9px 16px", background: isDanger ? "#E11D48" : "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Processing…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── Edit Incharge Modal ──────────────────────────────────────────────────────

function EditInchargeModal({ incharge, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    name: incharge.name || "",
    email: incharge.email || "",
    phone: incharge.phone || "",
    wards: incharge.wards || []
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const allWardNames = WARD_GROUPS.flatMap(g => g.wards.map(w => w.name));
  const allSelected = allWardNames.length > 0 && allWardNames.every(n => form.wards.includes(n));

  function toggleWard(name) {
    setForm(f => ({
      ...f,
      wards: f.wards.includes(name) ? f.wards.filter(x => x !== name) : [...f.wards, name]
    }));
  }

  function toggleAll() {
    setForm(f => ({ ...f, wards: allSelected ? [] : allWardNames }));
  }

  function removeWard(name) {
    setForm(f => ({ ...f, wards: f.wards.filter(x => x !== name) }));
  }

  function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (form.wards.length === 0) e.wards = "Assign at least one ward";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    onSave(incharge.id, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      wards: form.wards
    }).finally(() => setSaving(false));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, overflowY: "auto" }}>
      <div className="premium-card" style={{ padding: "28px", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3) !important" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>Edit In-charge</h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>Update details and manage assigned wards.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RegFormField
            id="edit-name"
            label="Full name"
            placeholder="e.g. Abena Mensah"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <RegFormField
              id="edit-email"
              label="Email address"
              type="email"
              placeholder="e.g. abena@hospital.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email}
            />
            <RegFormField
              id="edit-phone"
              label="Phone number"
              type="tel"
              placeholder="e.g. 0244 000 000"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              error={errors.phone}
            />
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ ...LS, marginBottom: 0 }}>ASSIGNED WARDS</label>
                <span style={{ background: "#6366F1", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                  {form.wards.length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: allSelected ? "#FFF1F2" : "#F8FAFC", color: allSelected ? "#BE123C" : "#475569", cursor: "pointer" }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>

            {errors.wards && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#FFF1F2", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.wards}
              </div>
            )}

            {form.wards.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, padding: "10px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                {form.wards.map(w => {
                  const info = WARD_LOOKUP[w];
                  return (
                    <span
                      key={w}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: info?.color || "#EEF2FF",
                        color: info?.textColor || "#4338CA",
                        border: "1px solid " + (info?.accent || "#6366F1") + "40",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px 3px 10px",
                        borderRadius: 99
                      }}
                    >
                      {w}
                      <button
                        type="button"
                        onClick={() => removeWard(w)}
                        title={`Remove ${w}`}
                        style={{
                          background: "rgba(0,0,0,0.08)",
                          border: "none",
                          borderRadius: "50%",
                          width: 16,
                          height: 16,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "inherit",
                          fontSize: 12,
                          lineHeight: 1,
                          padding: 0
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px", background: "#fff" }}>
              {WARD_GROUPS.map(g => (
                <div key={g.group}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: g.accent }} />{g.group}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {g.wards.map(w => {
                      const sel = form.wards.includes(w.name);
                      return (
                        <button
                          key={w.name}
                          type="button"
                          onClick={() => toggleWard(w.name)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            border: sel ? `1.5px solid ${g.accent}` : "1px solid #E2E8F0",
                            background: sel ? g.color : "#FAFAFA",
                            color: sel ? g.textColor : "#475569",
                            transition: "all 0.15s"
                          }}
                        >
                          <span style={{ fontSize: 10 }}>{sel ? "✓" : "+"}</span>
                          {w.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(incharge)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                background: "#FFF1F2",
                color: "#BE123C",
                border: "1px solid #FECDD3",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Delete In-charge
            </button>
          ) : <div />}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{ padding: "10px 18px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "10px 20px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Members ──────────────────────────────────────────────────────────────────

function InchargesTab({ showToast, onGoRegister }) {
  const [incharges, setIncharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [wardFilter, setWardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("recent");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [editingIncharge, setEditingIncharge] = useState(null);
  const [deletingIncharge, setDeletingIncharge] = useState(null);
  const [removingWard, setRemovingWard] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedEmailId, setCopiedEmailId] = useState(null);

  async function fetchIncharges() {
    const { data, error: err } = await supabase.from("incharges").select("*").order("created_at", { ascending: false });
    if (err) {
      console.error("incharges fetch error:", err);
      setError(err.message);
    } else {
      setIncharges(data || []);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchIncharges();
    const sub = supabase.channel("incharges-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, fetchIncharges)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  async function handleSaveIncharge(id, updatedFields) {
    const { error: err } = await supabase.from("incharges").update(updatedFields).eq("id", id);
    if (err) {
      console.error("Error updating incharge:", err);
      if (showToast) showToast("Error updating in-charge: " + err.message);
      else alert("Error updating in-charge: " + err.message);
      throw err;
    }
    setIncharges(prev => prev.map(inc => inc.id === id ? { ...inc, ...updatedFields } : inc));
    if (showToast) showToast("In-charge updated successfully");
    setEditingIncharge(null);
  }

  async function handleDeleteIncharge(id) {
    setActionLoading(true);
    const { error: err } = await supabase.from("incharges").delete().eq("id", id);
    setActionLoading(false);
    if (err) {
      console.error("Error deleting incharge:", err);
      if (showToast) showToast("Error deleting in-charge: " + err.message);
      else alert("Error deleting in-charge: " + err.message);
      return;
    }
    setIncharges(prev => prev.filter(inc => inc.id !== id));
    if (showToast) showToast("In-charge deleted successfully");
    setDeletingIncharge(null);
  }

  async function handleConfirmRemoveWard() {
    if (!removingWard) return;
    const { incharge, ward } = removingWard;
    const newWards = (incharge.wards || []).filter(w => w !== ward);
    setActionLoading(true);
    const { error: err } = await supabase.from("incharges").update({ wards: newWards }).eq("id", incharge.id);
    setActionLoading(false);
    if (err) {
      console.error("Error removing ward from incharge:", err);
      if (showToast) showToast("Error removing ward: " + err.message);
      else alert("Error removing ward: " + err.message);
      return;
    }
    setIncharges(prev => prev.map(inc => inc.id === incharge.id ? { ...inc, wards: newWards } : inc));
    if (showToast) showToast(`Ward "${ward}" removed from ${incharge.name}`);
    setRemovingWard(null);
  }

  function handleCopyEmail(email, id) {
    if (!email) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email).then(() => {
        setCopiedEmailId(id);
        setTimeout(() => setCopiedEmailId(null), 2000);
        if (showToast) showToast(`Email copied to clipboard`);
      }).catch(() => {});
    }
  }

  function handleHeaderSort(field) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "name" || field === "email");
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const list = incharges.filter(u => {
      const uWards = u.wards || [];
      const matchesQ = !q.trim() ||
        u.name?.toLowerCase().includes(q.toLowerCase()) ||
        u.email?.toLowerCase().includes(q.toLowerCase()) ||
        (u.phone && u.phone.includes(q)) ||
        uWards.some(w => w.toLowerCase().includes(q.toLowerCase()));

      let matchesWard = true;
      if (wardFilter === "unassigned") {
        matchesWard = uWards.length === 0;
      } else if (wardFilter !== "all") {
        matchesWard = uWards.includes(wardFilter);
      }

      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = uWards.length > 0;
      } else if (statusFilter === "unassigned") {
        matchesStatus = uWards.length === 0;
      }

      return matchesQ && matchesWard && matchesStatus;
    });

    list.sort((a, b) => {
      if (sortField === "name") {
        const res = (a.name || "").localeCompare(b.name || "");
        return sortAsc ? res : -res;
      }
      if (sortField === "email") {
        const res = (a.email || "").localeCompare(b.email || "");
        return sortAsc ? res : -res;
      }
      if (sortField === "wards") {
        const aLen = (a.wards || []).length;
        const bLen = (b.wards || []).length;
        return sortAsc ? aLen - bLen : bLen - aLen;
      }
      if (sortField === "status") {
        const aActive = (a.wards || []).length > 0 ? 1 : 0;
        const bActive = (b.wards || []).length > 0 ? 1 : 0;
        return sortAsc ? aActive - bActive : bActive - aActive;
      }
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    return list;
  }, [incharges, q, wardFilter, statusFilter, sortField, sortAsc]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  // Metrics
  const coveredWardsCount = useMemo(() => [...new Set(incharges.flatMap(u => u.wards || []))].length, [incharges]);
  const activeCount = useMemo(() => incharges.filter(u => (u.wards || []).length > 0).length, [incharges]);
  const unassignedCount = useMemo(() => incharges.filter(u => (u.wards || []).length === 0).length, [incharges]);

  return (
    <div>
      {/* Title & Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A", display: "flex", alignItems: "center", gap: 10 }}>
            Ward In-charges
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 10px", borderRadius: 99 }}>
              {incharges.length} registered
            </span>
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Manage ward supervisors, clinical contacts, and department assignments.</p>
        </div>
        {onGoRegister && (
          <button
            type="button"
            onClick={onGoRegister}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
              color: "#FFFFFF",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.28)",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Register In-charge
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#BE123C", fontWeight: 600, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <div>Could not load in-charges: {error}</div>
            <div style={{ fontWeight: 400, marginTop: 4, fontSize: 12 }}>Make sure the <code>incharges</code> table exists and RLS policies allow reads, updates, and deletes.</div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: "Total In-charges", v: incharges.length, a: "#6366F1", icon: "🔑", sub: "Registered supervisors", onClick: null },
          { l: "Wards Covered", v: `${coveredWardsCount} / ${ALL_WARD_NAMES.length}`, a: "#F97316", icon: "🏥", sub: "Hospital clinical wards", onClick: null },
          { l: "Active Supervisors", v: activeCount, a: "#10B981", icon: "🛡️", sub: "Supervising clinical wards", onClick: () => { setStatusFilter(statusFilter === "active" ? "all" : "active"); setPage(1); } },
          { l: "Unassigned", v: unassignedCount, a: unassignedCount > 0 ? "#F43F5E" : "#64748B", icon: "⚠️", sub: unassignedCount > 0 ? "Requires ward allocation" : "All assigned ✓", onClick: () => { setStatusFilter(statusFilter === "unassigned" ? "all" : "unassigned"); setPage(1); } },
        ].map(m => (
          <div
            key={m.l}
            className="stat-metric-card"
            onClick={m.onClick}
            style={{ cursor: m.onClick ? "pointer" : "default" }}
            title={m.onClick ? "Click to filter" : undefined}
          >
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.a }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</div>
              <div style={{ fontSize: 20 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          <div style={{ position: "relative", minWidth: 260, maxWidth: 360, flex: 1 }}>
            <svg width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={{ ...INP, paddingLeft: 36, paddingRight: q ? 32 : 12, padding: "10px 14px 10px 36px", background: "#fff", borderRadius: 10 }}
              placeholder="Search name, email, phone, or ward…"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
            />
            {q && (
              <button
                type="button"
                onClick={() => { setQ(""); setPage(1); }}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94A3B8", fontSize: 16, cursor: "pointer", padding: 2, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            )}
          </div>

          <FilterPills
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            options={[
              { val: "all", label: "All", count: incharges.length },
              { val: "active", label: "Active", count: activeCount },
              { val: "unassigned", label: "Unassigned", count: unassignedCount },
            ]}
          />

          <div style={{ position: "relative" }}>
            <select
              value={wardFilter}
              onChange={e => { setWardFilter(e.target.value); setPage(1); }}
              style={{
                ...INP,
                padding: "10px 32px 10px 14px",
                background: "#fff",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
                appearance: "none",
                width: "auto"
              }}
            >
              <option value="all">All Wards</option>
              <option value="unassigned">⚠️ Unassigned Only</option>
              {WARD_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.wards.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <div style={{ position: "relative" }}>
            <select
              value={sortField === "recent" ? "recent" : `${sortField}_${sortAsc ? "asc" : "desc"}`}
              onChange={e => {
                const val = e.target.value;
                if (val === "recent") {
                  setSortField("recent");
                  setSortAsc(false);
                } else {
                  const [f, d] = val.split("_");
                  setSortField(f);
                  setSortAsc(d === "asc");
                }
                setPage(1);
              }}
              style={{
                ...INP,
                padding: "10px 32px 10px 14px",
                background: "#fff",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
                appearance: "none",
                width: "auto"
              }}
            >
              <option value="recent">Sort: Recently added</option>
              <option value="name_asc">Sort: Name (A–Z)</option>
              <option value="name_desc">Sort: Name (Z–A)</option>
              <option value="wards_desc">Sort: Most wards</option>
              <option value="wards_asc">Sort: Fewest wards</option>
            </select>
            <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {(q || wardFilter !== "all" || statusFilter !== "all" || sortField !== "recent") && (
            <button
              type="button"
              onClick={() => { setQ(""); setWardFilter("all"); setStatusFilter("all"); setSortField("recent"); setSortAsc(false); setPage(1); }}
              style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#64748B", background: "#F1F5F9", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span>✕</span> Reset filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
            {filtered.length} {filtered.length === 1 ? "in-charge" : "in-charges"}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
          <div className="spin" style={{ width: 28, height: 28, border: "3px solid #E2E8F0", borderTopColor: "#6366F1", borderRadius: "50%", margin: "0 auto 12px" }} />
          Loading in-charges...
        </div>
      ) : (
        <div className="table-wrapper" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", background: "#fff" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>{incharges.length === 0 ? "No in-charges registered yet" : "No matching in-charges found"}</div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
                {incharges.length === 0 ? "Use the Register tab to add your first in-charge." : "Try adjusting your search query, status, or ward filter."}
              </div>
              {(q || wardFilter !== "all" || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => { setQ(""); setWardFilter("all"); setStatusFilter("all"); setPage(1); }}
                  style={{ marginTop: 16, padding: "8px 16px", background: "#EEF2FF", color: "#4338CA", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <table className="responsive-table incharges-table">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("name")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "name" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>In-charge</span>
                      <span style={{ fontSize: 12 }}>{sortField === "name" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("email")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "email" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Contact Info</span>
                      <span style={{ fontSize: 12 }}>{sortField === "email" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("wards")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "wards" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Assigned Wards</span>
                      <span style={{ fontSize: 12 }}>{sortField === "wards" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("status")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "status" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Status</span>
                      <span style={{ fontSize: 12 }}>{sortField === "status" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th style={{ textAlign: "right", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u, i) => {
                  const uWards = u.wards || [];
                  const isAssigned = uWards.length > 0;
                  const isCopied = copiedEmailId === u.id;
                  return (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFC", borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" }} className="hover-row">
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ position: "relative" }}>
                            <div style={{
                              width: 42,
                              height: 42,
                              borderRadius: 12,
                              background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                              border: "1.5px solid #C7D2FE",
                              color: "#4338CA",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 800,
                              flexShrink: 0,
                              boxShadow: "0 2px 6px rgba(99,102,241,0.12)"
                            }}>
                              {(u.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span
                              style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                border: "2px solid #FFFFFF",
                                background: isAssigned ? "#10B981" : "#F59E0B"
                              }}
                              title={isAssigned ? "Assigned & Active" : "Unassigned"}
                            />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 14, letterSpacing: "-0.01em" }}>{u.name || "—"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.02em" }}>
                                Ward In-charge
                              </span>
                              {u.created_at && (
                                <span style={{ fontSize: 11, color: "#94A3B8" }}>
                                  · Added {fmtDate(u.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <a
                              href={`mailto:${u.email}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#334155", fontSize: 13, textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#6366F1"}
                              onMouseLeave={e => e.currentTarget.style.color = "#334155"}
                              title="Click to send email"
                            >
                              <svg width="13" height="13" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                              <span>{u.email}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(u.email, u.id)}
                              title="Copy email to clipboard"
                              style={{
                                background: isCopied ? "#ECFDF5" : "transparent",
                                border: isCopied ? "1px solid #A7F3D0" : "none",
                                borderRadius: 5,
                                padding: "2px 5px",
                                cursor: "pointer",
                                color: isCopied ? "#059669" : "#94A3B8",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: 11,
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { if (!isCopied) e.currentTarget.style.color = "#6366F1"; }}
                              onMouseLeave={e => { if (!isCopied) e.currentTarget.style.color = "#94A3B8"; }}
                            >
                              {isCopied ? (
                                <>
                                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                                  <span>Copied</span>
                                </>
                              ) : (
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              )}
                            </button>
                          </div>
                          {u.phone ? (
                            <a
                              href={`tel:${u.phone}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 12, textDecoration: "none", transition: "color 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#6366F1"}
                              onMouseLeave={e => e.currentTarget.style.color = "#64748B"}
                              title="Click to call phone"
                            >
                              <svg width="12" height="12" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                              <span>{u.phone}</span>
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: "#CBD5E1", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span>•</span> No phone registered
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {!isAssigned ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#B45309", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              No wards assigned
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingIncharge(u)}
                              style={{
                                background: "#EEF2FF",
                                border: "1px solid #C7D2FE",
                                color: "#4338CA",
                                padding: "3px 9px",
                                borderRadius: 7,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#6366F1"; e.currentTarget.style.color = "#fff"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#EEF2FF"; e.currentTarget.style.color = "#4338CA"; }}
                            >
                              + Assign ward
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 420, alignItems: "center" }}>
                            {uWards.map(w => {
                              const info = WARD_LOOKUP[w];
                              return (
                                <span
                                  key={w}
                                  className="ward-badge-pill"
                                  style={{
                                    background: info?.color || "#F1F5F9",
                                    color: info?.textColor || "#334155",
                                    border: "1px solid " + (info?.accent || "#CBD5E1") + "40"
                                  }}
                                >
                                  {w}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRemovingWard({ incharge: u, ward: w });
                                    }}
                                    title={`Remove ${w} from ${u.name}`}
                                    style={{
                                      background: "rgba(0,0,0,0.06)",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: 16,
                                      height: 16,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      color: "inherit",
                                      fontSize: 11,
                                      lineHeight: 1,
                                      padding: 0,
                                      transition: "background 0.15s"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.18)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setEditingIncharge(u)}
                              title="Add another ward"
                              style={{
                                background: "#F8FAFC",
                                border: "1px dashed #CBD5E1",
                                borderRadius: 99,
                                padding: "3px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#64748B",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366F1"; e.currentTarget.style.color = "#4338CA"; e.currentTarget.style.background = "#EEF2FF"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.color = "#64748B"; e.currentTarget.style.background = "#F8FAFC"; }}
                            >
                              + Add
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {isAssigned ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 99 }}>
                            <span className="status-dot-pulse" />
                            Active · {uWards.length} {uWards.length === 1 ? "ward" : "wards"}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECDD3", fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 99 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444" }} />
                            Needs Ward
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            className="action-btn-secondary"
                            onClick={() => setEditingIncharge(u)}
                            title="Edit in-charge & wards"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn-danger"
                            onClick={() => setDeletingIncharge(u)}
                            title="Delete in-charge profile"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={setPerPage}
            itemsPerPageOptions={[5, 8, 15, 25]}
            itemLabel="in-charges"
          />
        </div>
      )}

      {/* Edit In-charge Modal */}
      {editingIncharge && (
        <EditInchargeModal
          incharge={editingIncharge}
          onSave={handleSaveIncharge}
          onDelete={(u) => {
            setEditingIncharge(null);
            setDeletingIncharge(u);
          }}
          onCancel={() => setEditingIncharge(null)}
        />
      )}

      {/* Delete In-charge Confirm Modal */}
      {deletingIncharge && (
        <ConfirmModal
          isOpen={true}
          title="Delete In-charge"
          message={`Are you sure you want to delete in-charge "${deletingIncharge.name}" (${deletingIncharge.email})? This will permanently remove their supervisor profile and unassign their ward supervision.`}
          confirmText="Delete In-charge"
          loading={actionLoading}
          onConfirm={() => handleDeleteIncharge(deletingIncharge.id)}
          onCancel={() => setDeletingIncharge(null)}
        />
      )}

      {/* Quick remove ward Confirm Modal */}
      {removingWard && (
        <ConfirmModal
          isOpen={true}
          title="Remove Assigned Ward"
          message={`Are you sure you want to remove ward "${removingWard.ward}" from in-charge ${removingWard.incharge.name}?`}
          confirmText="Remove Ward"
          loading={actionLoading}
          onConfirm={handleConfirmRemoveWard}
          onCancel={() => setRemovingWard(null)}
        />
      )}
    </div>
  );
}

function MembersTab({ members, assignments }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(() => members.filter((m) =>
    (m.name.toLowerCase().includes(q.toLowerCase()) || m.school.toLowerCase().includes(q.toLowerCase())) && (filter === "all" || m.group === filter)
  ), [members, q, filter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Members</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>All registered nurses and midwives.</p>
      </div>
      <div className="members-grid">
        {[
          { l: "Total Members", v: members.length, a: "#6366F1", icon: "👥" }, 
          { l: "General Nursing", v: members.filter((m) => m.group === "nursing").length, a: "#3B82F6", icon: "🏥" }, 
          { l: "Midwifery", v: members.filter((m) => m.group === "midwifery").length, a: "#10B981", icon: "👶" }
        ].map((m) => (
          <div key={m.l} className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.a }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</div>
              <div style={{ fontSize: 20, opacity: 0.8 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...INP, maxWidth: 280, width: "auto", padding: "10px 14px", background: "#fff" }}
            placeholder="Search name or school…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <FilterPills value={filter} onChange={(f) => { setFilter(f); setPage(1); }} options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]} />
        </div>
        <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </div>
      </div>
      <div className="table-wrapper" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", background: "#fff" }}>
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members found</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
            </div>
          : <>
              <table className="responsive-table members-table">
                <thead><tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>{["Member", "Institution", "Phone", "Group", "Assignments"].map((h) => <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
                <tbody>{paginated.map((m, i) => {
                  const count = assignments.filter((a) => a.memberId === m.id).length;
                  return <tr key={m.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFC", borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} className="hover-row">
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar name={m.name} group={m.group} size={36} /><span style={{ fontWeight: 700, color: "#0F172A" }}>{m.name}</span></div></td>
                    <td style={{ padding: "16px 18px", color: "#64748B", verticalAlign: "middle", fontSize: 13 }}>{m.school}</td>
                    <td style={{ padding: "16px 18px", color: "#64748B", verticalAlign: "middle", fontSize: 13 }}>{m.phone}</td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><GroupBadge group={m.group} /></td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><span style={{ background: count > 0 ? "#ECFDF5" : "#FFF7ED", color: count > 0 ? "#065F46" : "#9A3412", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99 }}>{count > 0 ? `${count} wards` : "Unassigned"}</span></td>
                  </tr>;
                })}</tbody>
              </table>
              <Pagination
                currentPage={page}
                totalItems={filtered.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
                itemsPerPageOptions={[5, 10, 20, 50]}
              />
            </>
        }
      </div>
    </div>
  );
}

// ─── Edit Assignment Modal ──────────────────────────────────────────────────────

function EditAssignmentModal({ assignment, onSave, onDelete, onCancel }) {
  const [ward, setWard] = useState(assignment.ward);
  const [startDate, setStartDate] = useState(assignment.startDate);
  const [weeks, setWeeks] = useState(assignment.weeks);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div className="premium-card" style={{ padding: 24, borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.3) !important" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Assignment</h3>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B", fontSize: 16 }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>Change the ward, start date, or duration.</p>
        
        <div style={{ marginBottom: 16 }}>
          <label style={LS}>MEMBER</label>
          <div style={{ fontSize: 14, fontWeight: 600, padding: "10px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", color: "#0F172A" }}>
            {assignment.memberName || "Member"}
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={LS}>WARD</label>
          <select 
            style={{ ...INP }}
            value={ward}
            onChange={(e) => {
              const w = e.target.value;
              setWard(w);
              setWeeks(weeksFor(assignment.group, w));
            }}
          >
            {WARD_GROUPS.map(g => {
              const validWards = g.wards.filter(w => assignment.group === "nursing" ? w.nursing > 0 : w.midwifery > 0);
              if (validWards.length === 0) return null;
              return (
                <optgroup key={g.group} label={g.group}>
                  {validWards.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="edit-modal-grid">
          <div>
            <label style={LS}>START DATE</label>
            <input type="date" style={{ ...INP }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={LS}>WEEKS</label>
            <input type="number" min="1" style={{ ...INP }} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(assignment)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "9px 12px",
                background: "#FFF1F2",
                color: "#BE123C",
                border: "1px solid #FECDD3",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Delete
            </button>
          ) : <div />}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ padding: "9px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button 
              onClick={() => onSave(assignment.id, { ward, startDate, weeks, endDate: addWeeks(startDate, weeks) })}
              style={{ padding: "9px 16px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rotations ────────────────────────────────────────────────────────────────

function RotationsTab({ members, assignments, wardRows, onNavigateTab, onEditAssignment, onDeleteAssignment }) {
  const [viewMode, setViewMode] = useState("roster"); // "roster", "analytics"
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deletingAssignment, setDeletingAssignment] = useState(null);

  const filteredMembers = useMemo(() => {
    if (filter === "all") return members;
    return members.filter((m) => m.group === filter);
  }, [members, filter]);
  
  const grouped = useMemo(() => members
    .filter((m) => (filter === "all" || m.group === filter) && m.name.toLowerCase().includes(search.toLowerCase()))
    .map((m) => {
      const wards = assignments.filter((a) => a.memberId === m.id);
      const done = wards.reduce((s, a) => s + a.weeks, 0);
      const total = TOTAL_WEEKS[m.group] || 52;
      return { ...m, wards, done, total, pct: Math.round((done / total) * 100) };
    }), [members, assignments, filter, search]);

  const paginatedGrouped = useMemo(() => {
    const start = (page - 1) * perPage;
    return grouped.slice(start, start + perPage);
  }, [grouped, page, perPage]);

  const cohortStats = useMemo(() => {
    let completed = 0;
    let totalPct = 0;
    let totalWeeks = 0;
    members.forEach((m) => {
      const wards = assignments.filter((a) => a.memberId === m.id);
      const done = wards.reduce((s, a) => s + a.weeks, 0);
      totalWeeks += done;
      const total = TOTAL_WEEKS[m.group] || 52;
      const pct = Math.min(100, Math.round((done / total) * 100));
      totalPct += pct;
      if (pct >= 100) completed++;
    });
    return {
      avgPct: members.length ? Math.round(totalPct / members.length) : 0,
      completed,
      active: members.length - completed,
      totalWeeks,
    };
  }, [members, assignments]);

  return (
    <div>
      {/* Header & View Mode Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A", margin: 0 }}>Rotation Tracker</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 9px", borderRadius: 99 }}>
              52-Week Curriculum
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 5 }}>
            Each member's cumulative ward progress, competency completion milestones, and cohort analytics.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", padding: 3, background: "#F1F5F9", borderRadius: 10, border: "1px solid #E2E8F0" }}>
            <button
              type="button"
              onClick={() => setViewMode("roster")}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: viewMode === "roster" ? "#fff" : "transparent",
                color: viewMode === "roster" ? "#1E293B" : "#64748B",
                boxShadow: viewMode === "roster" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📋 Member Rosters
            </button>
            <button
              type="button"
              onClick={() => setViewMode("analytics")}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: viewMode === "analytics" ? "#fff" : "transparent",
                color: viewMode === "analytics" ? "#4338CA" : "#64748B",
                boxShadow: viewMode === "analytics" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📊 Visual Analytics & Funnel
            </button>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab("analytics")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#4338CA", cursor: "pointer", transition: "all 0.15s ease" }}
            >
              <span>Full Analytics Report</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === "analytics" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Quick Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Cohort Completion</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#4338CA", marginTop: 4 }}>{cohortStats.avgPct}%</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Cumulative progression across all {members.length} trainees</div>
            </div>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Fully Graduated (52w)</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#059669", marginTop: 4 }}>{cohortStats.completed}</div>
              <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>{members.length > 0 ? Math.round((cohortStats.completed / members.length) * 100) : 0}% of registered cohort</div>
            </div>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Active In-Rotation</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#D97706", marginTop: 4 }}>{cohortStats.active}</div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>Currently completing ward rotations</div>
            </div>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Delivered Weeks</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", marginTop: 4 }}>{cohortStats.totalWeeks}w</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Cumulative hospital clinical training weeks</div>
            </div>
          </div>

          {/* Filter Pills for the analytics view */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <FilterPills
              value={filter}
              onChange={setFilter}
              options={[
                { val: "all", label: "All Disciplines", count: members.length },
                { val: "nursing", label: "Nursing", count: members.filter((m) => m.group === "nursing").length },
                { val: "midwifery", label: "Midwifery", count: members.filter((m) => m.group === "midwifery").length },
              ]}
            />
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("analytics")}
                style={{ fontSize: 12.5, fontWeight: 700, color: "#4338CA", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <span>View Full Executive Analytics & Reports</span>
                <span>→</span>
              </button>
            )}
          </div>

          {/* Visual Charts Grid */}
          <div className="analytics-grid">
            <CohortCompletionTierChart members={filteredMembers} assignments={assignments} />
            <DisciplineComparisonWidget members={members} assignments={assignments} />
          </div>
        </div>
      ) : (
        <>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...INP, maxWidth: 280, width: "auto", padding: "10px 14px", background: "#fff" }}
            placeholder="Search member…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <FilterPills
            value={filter}
            onChange={(f) => { setFilter(f); setPage(1); }}
            options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]}
          />
        </div>
        <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
          {grouped.length} {grouped.length === 1 ? "member" : "members"}
        </div>
      </div>
      {grouped.length === 0
        ? <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #CBD5E1", padding: "60px 40px", textAlign: "center", color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No rotation data</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
          </div>
        : <>
            {paginatedGrouped.map((m) => (
              <div key={m.id} className="premium-card" style={{ padding: "24px", marginBottom: 16, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  <Avatar name={m.name} group={m.group} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{m.name}</span><GroupBadge group={m.group} /></div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{m.school}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: m.pct === 100 ? "#10B981" : "#6366F1", letterSpacing: "-0.02em" }}>{m.pct}%</div>
                    <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500, marginTop: 2 }}>{m.done} / {m.total} weeks</div>
                  </div>
                </div>
                <div style={{ height: 8, background: "#F1F5F9", borderRadius: 99, overflow: "hidden", marginBottom: m.wards.length ? 20 : 0 }}>
                  <div style={{ height: "100%", width: `${m.pct}%`, background: m.pct === 100 ? "#10B981" : "#6366F1", borderRadius: 99, transition: "width .4s" }} />
                </div>
                {m.wards.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {m.wards.map((a) => {
                      const wd = WARD_LOOKUP[a.ward]; const dl = daysLeft(a.endDate); const isDone = dl < 0;
                      const item = { ...a, memberName: a.memberName || m.name };
                      return (
                        <div key={a.id} style={{ background: isDone ? "#F8FAFC" : wd?.color || "#F8FAFC", border: `1px solid ${isDone ? "#E2E8F0" : wd?.accent || "#E2E8F0"}40`, borderRadius: 10, padding: "10px 14px", opacity: isDone ? 0.75 : 1, position: "relative" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? "#94A3B8" : wd?.textColor || "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                            {isDone && <span style={{ fontSize: 12 }}>✓</span>}
                            <span>{a.ward}</span>
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => setEditingAssignment(item)}
                                style={{ background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", color: isDone ? "#64748B" : (wd?.textColor || "#64748B"), padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.14)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
                                title="Edit assignment"
                              >
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </button>
                              {onDeleteAssignment && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingAssignment(item)}
                                  style={{ background: "rgba(225,29,72,0.08)", border: "none", cursor: "pointer", color: "#E11D48", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(225,29,72,0.18)"}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(225,29,72,0.08)"}
                                  title="Delete assignment"
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                            {fmtDate(a.startDate)} → {fmtDate(a.endDate)} · <span style={{fontWeight: 600}}>{a.weeks}w</span> · {isDone ? `done ${Math.abs(dl)}d ago` : dl === 0 ? "ends today" : `${dl}d left`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", marginTop: 8 }}>
              <Pagination
                currentPage={page}
                totalItems={grouped.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
                itemsPerPageOptions={[4, 8, 16, 24]}
              />
            </div>
          </>
      }
        </>
      )}
      
      {editingAssignment && (
        <EditAssignmentModal 
          assignment={editingAssignment} 
          onCancel={() => setEditingAssignment(null)} 
          onSave={(id, data) => {
            onEditAssignment(id, data);
            setEditingAssignment(null);
          }}
          onDelete={(a) => {
            setEditingAssignment(null);
            setDeletingAssignment(a);
          }}
        />
      )}

      {deletingAssignment && (
        <ConfirmModal
          isOpen={true}
          title="Delete Rotation Assignment"
          message={`Are you sure you want to delete the ${deletingAssignment.ward} placement for ${deletingAssignment.memberName} (${deletingAssignment.weeks}w: ${fmtDate(deletingAssignment.startDate)} – ${fmtDate(deletingAssignment.endDate)})? This action cannot be undone.`}
          confirmText="Delete Assignment"
          onConfirm={() => {
            onDeleteAssignment(deletingAssignment.id);
            setDeletingAssignment(null);
          }}
          onCancel={() => setDeletingAssignment(null)}
        />
      )}
    </div>
  );
}

// ─── Wards (admin) ────────────────────────────────────────────────────────────

const SELECT_STYLE = { ...INP, padding: "10px 32px 10px 14px", background: "#fff", borderRadius: 10, fontSize: 13, cursor: "pointer", appearance: "none", width: "auto" };

function SelectChevron() {
  return (
    <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function WardFormModal({ ward, departments, existingNames, onSave, onCancel, saving }) {
  const isEdit = !!ward;
  const [form, setForm] = useState({
    name: ward?.name || "",
    department: ward?.department || departments[0] || "",
    nursing_weeks: ward?.nursing_weeks ?? 2,
    midwifery_weeks: ward?.midwifery_weeks ?? 2,
    capacity: ward?.capacity ?? "",
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const theme = themeForDept(form.department.trim());

  function submit() {
    const e = {};
    const name = form.name.trim();
    const dept = form.department.trim();
    if (!name) e.name = "Ward name is required";
    else if (existingNames.some(n => n.toLowerCase() === name.toLowerCase() && n !== ward?.name)) e.name = "A ward with this name already exists";
    if (!dept) e.department = "Department is required";
    const nw = Number(form.nursing_weeks), mw = Number(form.midwifery_weeks);
    if (!Number.isInteger(nw) || nw < 0) e.nursing_weeks = "Must be 0 or more";
    if (!Number.isInteger(mw) || mw < 0) e.midwifery_weeks = "Must be 0 or more";
    if (!e.nursing_weeks && !e.midwifery_weeks && nw === 0 && mw === 0) e.nursing_weeks = "At least one group needs weeks > 0";
    const cap = form.capacity === "" ? null : Number(form.capacity);
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) e.capacity = "Whole number above 0, or leave blank";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ name, department: dept, nursing_weeks: nw, midwifery_weeks: mw, capacity: cap });
  }

  const Err = ({ k }) => errors[k] ? <div style={{ fontSize: 11, color: "#E11D48", marginTop: 5, fontWeight: 600 }}>{errors[k]}</div> : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div className="premium-card" style={{ padding: 0, borderRadius: 18, width: "100%", maxWidth: 480, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.3) !important" }}>
        <div style={{ padding: "20px 24px", background: theme.color, borderBottom: `1px solid ${theme.accent}33`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isEdit ? "Edit ward" : "New ward"}</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: "4px 0 0", color: "#0F172A" }}>{form.name.trim() || "Untitled ward"}</h3>
          </div>
          <button type="button" onClick={onCancel} style={{ background: "#fff", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#64748B", fontSize: 17 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={LS}>WARD NAME</label>
            <input id="ward-form-name" style={{ ...INP, borderColor: errors.name ? "#FCA5A5" : "#E2E8F0" }} value={form.name} onChange={set("name")} placeholder="e.g. Cardiology Ward" autoFocus />
            <Err k="name" />
            {isEdit && form.name.trim() && form.name.trim() !== ward.name && (
              <div style={{ fontSize: 11, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "6px 10px", borderRadius: 8, marginTop: 8 }}>
                Renaming also updates every assignment and in-charge linked to "{ward.name}".
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={LS}>DEPARTMENT</label>
            <input id="ward-form-department" list="ward-departments" style={{ ...INP, borderColor: errors.department ? "#FCA5A5" : "#E2E8F0" }} value={form.department} onChange={set("department")} placeholder="Pick existing or type a new one" />
            <datalist id="ward-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
            <Err k="department" />
          </div>

          <div className="edit-modal-grid" style={{ marginBottom: 16 }}>
            <div>
              <label style={LS}>NURSING WEEKS</label>
              <input id="ward-form-nursing" type="number" min="0" style={{ ...INP, borderColor: errors.nursing_weeks ? "#FCA5A5" : "#E2E8F0" }} value={form.nursing_weeks} onChange={set("nursing_weeks")} />
              <Err k="nursing_weeks" />
            </div>
            <div>
              <label style={LS}>MIDWIFERY WEEKS</label>
              <input id="ward-form-midwifery" type="number" min="0" style={{ ...INP, borderColor: errors.midwifery_weeks ? "#FCA5A5" : "#E2E8F0" }} value={form.midwifery_weeks} onChange={set("midwifery_weeks")} />
              <Err k="midwifery_weeks" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: -8, marginBottom: 16 }}>Set 0 to make the ward unavailable for that group.</div>

          <div>
            <label style={LS}>CAPACITY (OPTIONAL)</label>
            <input id="ward-form-capacity" type="number" min="1" style={{ ...INP, borderColor: errors.capacity ? "#FCA5A5" : "#E2E8F0" }} value={form.capacity} onChange={set("capacity")} placeholder="Max people at once — leave blank for no limit" />
            <Err k="capacity" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid #F1F5F9", background: "#FAFBFC" }}>
          <button type="button" onClick={onCancel} disabled={saving} style={{ padding: "9px 16px", background: "#fff", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button id="ward-form-save" type="button" onClick={submit} disabled={saving} style={{ padding: "9px 18px", background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create ward"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WardDetailModal({ ward, members, assignments, supervisors, onAdd, onEditAssignment, onDeleteAssignment, onEditWard, onClose }) {
  const theme = themeForDept(ward.department);
  const [filter, setFilter] = useState("current");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(6);
  const [showAdd, setShowAdd] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");
  const [addStart, setAddStart] = useState(new Date().toISOString().split("T")[0]);
  const [addWeeks, setAddWeeksVal] = useState("");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const rows = useMemo(() => assignments
    .filter(a => a.ward === ward.name)
    .map(a => {
      const m = members.find(x => x.id === a.memberId);
      return { ...a, member: m, memberName: a.memberName || m?.name || "Unknown", status: assignmentStatus(a) };
    })
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)), [assignments, members, ward.name]);

  const counts = {
    current: rows.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
    upcoming: rows.filter(r => r.status === "upcoming").length,
    completed: rows.filter(r => r.status === "completed").length,
    all: rows.length,
  };

  const filtered = rows.filter(r => {
    const fm = filter === "all" || (filter === "current" ? ACTIVE_STATUSES.includes(r.status) : r.status === filter);
    const qm = !q.trim() || r.memberName.toLowerCase().includes(q.toLowerCase()) || (r.member?.school || "").toLowerCase().includes(q.toLowerCase());
    return fm && qm;
  });
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // People who can be added: eligible group, not already current/upcoming here.
  const busyIds = new Set(rows.filter(r => r.status !== "completed").map(r => r.memberId));
  const eligible = members
    .filter(m => (m.group === "nursing" ? ward.nursing_weeks : ward.midwifery_weeks) > 0 && !busyIds.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const addMember = members.find(m => String(m.id) === String(addMemberId));
  const defaultWeeks = addMember ? (addMember.group === "nursing" ? ward.nursing_weeks : ward.midwifery_weeks) : 0;
  const effectiveWeeks = addWeeks === "" ? defaultWeeks : Number(addWeeks);

  function submitAdd() {
    if (!addMember || !addStart || !(effectiveWeeks > 0)) return;
    onAdd([{ id: Date.now(), memberId: addMember.id, memberName: addMember.name, group: addMember.group, ward: ward.name, weeks: effectiveWeeks, startDate: addStart, endDate: addWeeks_(addStart, effectiveWeeks) }]);
    setAddMemberId(""); setAddWeeksVal(""); setShowAdd(false); setFilter(new Date(addStart) > new Date() ? "upcoming" : "current"); setPage(1);
  }

  const cap = ward.capacity;
  const pct = cap ? Math.min(100, Math.round((counts.current / cap) * 100)) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 90 }} onClick={onClose}>
      <div className="ward-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "22px 26px 18px", background: `linear-gradient(135deg, ${theme.color} 0%, #fff 100%)`, borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.textColor, background: "#fff", border: `1px solid ${theme.accent}44`, padding: "3px 10px", borderRadius: 99 }}>{ward.department}</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "10px 0 4px", letterSpacing: "-0.02em" }}>{ward.name}</h2>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Nursing {ward.nursing_weeks ? `${ward.nursing_weeks}w` : "—"} · Midwifery {ward.midwifery_weeks ? `${ward.midwifery_weeks}w` : "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {onEditWard && <button type="button" className="action-btn-secondary" onClick={onEditWard}>Edit ward</button>}
              <button type="button" onClick={onClose} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#64748B", fontSize: 17 }}>×</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
            {[
              { l: "Currently placed", v: cap ? `${counts.current} / ${cap}` : counts.current, c: "#059669" },
              { l: "Upcoming", v: counts.upcoming, c: "#6366F1" },
              { l: "Completed", v: counts.completed, c: "#64748B" },
            ].map(s => (
              <div key={s.l} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          {pct !== null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 6, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: counts.current > cap ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981", transition: "width .4s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: counts.current > cap ? "#E11D48" : "#64748B", marginTop: 4, fontWeight: 600 }}>
                {counts.current > cap ? `Over capacity by ${counts.current - cap}` : `${cap - counts.current} spot${cap - counts.current === 1 ? "" : "s"} free`}
              </div>
            </div>
          )}

          {/* Supervised by / Clinical Supervision section */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>🩺</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Supervised by
                </span>
                {supervisors.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", padding: "1px 8px", borderRadius: 99, border: "1px solid #C7D2FE" }}>
                    {supervisors.length} {supervisors.length === 1 ? "In-charge" : "In-charges"}
                  </span>
                )}
              </div>
            </div>

            {supervisors.length === 0 ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#FFFBEB",
                border: "1px dashed #FCD34D",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 12,
                color: "#92400E"
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, color: "#92400E" }}>No in-charge assigned yet</div>
                  <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
                    Assign a supervisor to this ward in the In-charges tab to enable clinical oversight.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: supervisors.length > 1 ? "repeat(auto-fit, minmax(240px, 1fr))" : "1fr",
                gap: 8
              }}>
                {supervisors.map(s => (
                  <div
                    key={s.id}
                    className="supervisor-card"
                    style={{
                      background: "#fff",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      boxShadow: "0 1px 3px rgba(15,23,42,0.03)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 800,
                          boxShadow: "0 2px 6px rgba(79,70,229,0.22)"
                        }}>
                          {initials(s.name || "In Charge")}
                        </div>
                        <span
                          style={{
                            position: "absolute",
                            bottom: -1,
                            right: -1,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#10B981",
                            border: "2px solid #fff"
                          }}
                          title="Active Supervisor"
                        />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.name}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#166534", background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "1px 6px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0 }}>
                            In-Charge
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap", fontSize: 11, color: "#64748B" }}>
                          {s.phone && (
                            <a
                              href={`tel:${s.phone}`}
                              className="supervisor-link"
                              title={`Call ${s.phone}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#475569", textDecoration: "none", fontWeight: 500 }}
                            >
                              <span>📞</span> {s.phone}
                            </a>
                          )}
                          {s.email && (
                            <a
                              href={`mailto:${s.email}`}
                              className="supervisor-link"
                              title={`Email ${s.email}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#4F46E5", textDecoration: "none", fontWeight: 500 }}
                            >
                              <span>✉️</span> {s.email}
                            </a>
                          )}
                          {!s.phone && !s.email && (
                            <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Ward supervisor</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(s.email || s.phone) && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {s.email && (
                          <a
                            href={`mailto:${s.email}`}
                            className="icon-btn"
                            title={`Email ${s.name}`}
                            style={{ textDecoration: "none" }}
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                          </a>
                        )}
                        {s.phone && (
                          <a
                            href={`tel:${s.phone}`}
                            className="icon-btn"
                            title={`Call ${s.name}`}
                            style={{ textDecoration: "none" }}
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 26px", flex: 1, overflowY: "auto" }}>
          {/* Add person */}
          {showAdd ? (
            <div style={{ border: "1.5px dashed #A5B4FC", background: "#F5F7FF", borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3730A3", marginBottom: 12 }}>Add a person to {ward.name}</div>
              <div style={{ marginBottom: 12, position: "relative" }}>
                <label style={LS}>MEMBER</label>
                <select id="ward-add-member" style={{ ...INP, background: "#fff" }} value={addMemberId} onChange={e => { setAddMemberId(e.target.value); setAddWeeksVal(""); }}>
                  <option value="">{eligible.length ? `Select from ${eligible.length} eligible member${eligible.length === 1 ? "" : "s"}…` : "No eligible members available"}</option>
                  {["nursing", "midwifery"].map(g => {
                    const list = eligible.filter(m => m.group === g);
                    if (!list.length) return null;
                    return <optgroup key={g} label={g === "nursing" ? "Nursing" : "Midwifery"}>{list.map(m => <option key={m.id} value={m.id}>{m.name} — {m.school}</option>)}</optgroup>;
                  })}
                </select>
              </div>
              <div className="edit-modal-grid">
                <div>
                  <label style={LS}>START DATE</label>
                  <input id="ward-add-start" type="date" style={{ ...INP, background: "#fff" }} value={addStart} onChange={e => setAddStart(e.target.value)} />
                </div>
                <div>
                  <label style={LS}>WEEKS</label>
                  <input id="ward-add-weeks" type="number" min="1" style={{ ...INP, background: "#fff" }} value={addWeeks === "" ? (defaultWeeks || "") : addWeeks} onChange={e => setAddWeeksVal(e.target.value)} placeholder="—" />
                </div>
              </div>
              {addMember && effectiveWeeks > 0 && (
                <div style={{ fontSize: 12, color: "#4338CA", marginTop: 10 }}>Ends {fmtDate(addWeeks_(addStart, effectiveWeeks))}</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={() => setShowAdd(false)} style={{ padding: "8px 14px", background: "#fff", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button id="ward-add-submit" type="button" onClick={submitAdd} disabled={!addMember || !(effectiveWeeks > 0)} style={{ padding: "8px 16px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: addMember ? "pointer" : "not-allowed", opacity: addMember && effectiveWeeks > 0 ? 1 : 0.5 }}>Assign to ward</button>
              </div>
            </div>
          ) : (
            <button id="ward-add-open" type="button" onClick={() => setShowAdd(true)} className="ward-add-btn">
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add person to this ward
            </button>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <FilterPills value={filter} onChange={v => { setFilter(v); setPage(1); }} options={[
              { val: "current", label: "Current", count: counts.current },
              { val: "upcoming", label: "Upcoming", count: counts.upcoming },
              { val: "completed", label: "Completed", count: counts.completed },
              { val: "all", label: "All", count: counts.all },
            ]} />
            <input style={{ ...INP, width: "auto", flex: 1, minWidth: 160, background: "#fff", padding: "8px 12px", fontSize: 13 }} placeholder="Search people…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
          </div>

          {/* People list */}
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🛏️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No {filter === "all" ? "" : filter} placements{q ? " match your search" : ""}</div>
              </div>
            ) : paginated.map((r, i) => {
              const dl = daysLeft(r.endDate);
              return (
                <div key={r.id} className="hover-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #F1F5F9" : "none" }}>
                  <Avatar name={r.memberName} group={r.group} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#0F172A", fontSize: 14 }}>{r.memberName}</span>
                      <GroupBadge group={r.group} />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                      {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · {r.weeks}w
                      {r.status !== "completed" && r.status !== "upcoming" && <> · <b style={{ color: dl <= 7 ? "#EA580C" : "#334155" }}>{dl === 0 ? "ends today" : `${dl}d left`}</b></>}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" title="Edit / move" className="icon-btn" onClick={() => setEditing(r)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button type="button" title="Remove from ward" className="icon-btn icon-btn-danger" onClick={() => setRemoving(r)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length > 0 && (
              <Pagination currentPage={page} totalItems={filtered.length} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemsPerPageOptions={[6, 12, 24]} itemLabel="people" />
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div onClick={e => e.stopPropagation()}>
          <EditAssignmentModal
            assignment={editing}
            onSave={(id, data) => { onEditAssignment(id, data); setEditing(null); }}
            onDelete={(a) => { setEditing(null); setRemoving(a); }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      {removing && (
        <div onClick={e => e.stopPropagation()}>
          <ConfirmModal
            isOpen
            title="Remove from ward"
            message={`Remove ${removing.memberName} from ${ward.name} (${fmtDate(removing.startDate)} → ${fmtDate(removing.endDate)})? This deletes the assignment.`}
            confirmText="Remove"
            onConfirm={() => { onDeleteAssignment(removing.id); setRemoving(null); }}
            onCancel={() => setRemoving(null)}
          />
        </div>
      )}
    </div>
  );
}
// Alias so the local `addWeeks` state name in WardDetailModal doesn't shadow the helper.
const addWeeks_ = (d, w) => addWeeks(d, w);

function WardsTab({ members, assignments, wardRows, tableMissing, onWardsChanged, onBulkAssign, onEditAssignment, onDeleteAssignment, showToast }) {
  const rows = wardRows || DEFAULT_WARD_ROWS;
  const canEditWards = !tableMissing;
  const [incharges, setIncharges] = useState([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [occ, setOcc] = useState("all");
  const [sort, setSort] = useState("order");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [formWard, setFormWard] = useState(undefined); // undefined = closed, null = new, row = edit
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [detailName, setDetailName] = useState(null);

  async function fetchIncharges() {
    const { data } = await supabase.from("incharges").select("id, name, email, phone, wards");
    if (data) setIncharges(data);
  }
  useEffect(() => {
    fetchIncharges();
    const ch = supabase.channel("incharges_wards_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, () => fetchIncharges())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const departments = useMemo(() => [...new Set(rows.map(r => r.department))], [rows]);

  const stats = useMemo(() => {
    const s = {};
    rows.forEach(r => { s[r.name] = { current: 0, upcoming: 0, completed: 0, nursing: 0, midwifery: 0 }; });
    assignments.forEach(a => {
      const st = s[a.ward];
      if (!st) return;
      const status = assignmentStatus(a);
      if (ACTIVE_STATUSES.includes(status)) {
        st.current++;
        if (a.group === "midwifery") st.midwifery++; else st.nursing++;
      } else if (status === "upcoming") st.upcoming++;
      else st.completed++;
    });
    return s;
  }, [rows, assignments]);

  const supervisorsFor = (name) => incharges.filter(i => (i.wards || []).includes(name));

  const totals = useMemo(() => {
    const vals = Object.values(stats);
    return {
      current: vals.reduce((n, v) => n + v.current, 0),
      upcoming: vals.reduce((n, v) => n + v.upcoming, 0),
      empty: rows.filter(r => stats[r.name]?.current === 0).length,
      over: rows.filter(r => r.capacity && stats[r.name]?.current > r.capacity).length,
    };
  }, [stats, rows]);

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      const st = stats[r.name];
      const qm = !q.trim() || r.name.toLowerCase().includes(q.toLowerCase()) || r.department.toLowerCase().includes(q.toLowerCase());
      const dm = dept === "all" || r.department === dept;
      const om = occ === "all" || (occ === "occupied" ? st.current > 0 : occ === "empty" ? st.current === 0 : r.capacity && st.current > r.capacity);
      return qm && dm && om;
    });
    const sorters = {
      order: (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      most: (a, b) => stats[b.name].current - stats[a.name].current || a.name.localeCompare(b.name),
      least: (a, b) => stats[a.name].current - stats[b.name].current || a.name.localeCompare(b.name),
    };
    return list.sort(sorters[sort]);
  }, [rows, stats, q, dept, occ, sort]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  async function handleSaveWard(fields) {
    setSaving(true);
    try {
      if (formWard) {
        const oldName = formWard.name;
        const { error } = await supabase.from("wards").update(fields).eq("id", formWard.id);
        if (error) throw error;
        if (fields.name !== oldName) {
          const { error: aErr } = await supabase.from("assignments").update({ ward: fields.name }).eq("ward", oldName);
          if (aErr) throw aErr;
          const affected = incharges.filter(i => (i.wards || []).includes(oldName));
          for (const inc of affected) {
            await supabase.from("incharges").update({ wards: inc.wards.map(w => w === oldName ? fields.name : w) }).eq("id", inc.id);
          }
          if (detailName === oldName) setDetailName(fields.name);
          fetchIncharges();
        }
        showToast(`Ward "${fields.name}" updated`);
      } else {
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
        const { error } = await supabase.from("wards").insert([{ ...fields, sort_order: maxOrder + 10 }]);
        if (error) throw error;
        showToast(`Ward "${fields.name}" created`);
      }
      setFormWard(undefined);
      onWardsChanged();
    } catch (err) {
      console.error(err);
      showToast("Error saving ward: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWard() {
    const w = deleting;
    setSaving(true);
    const { error } = await supabase.from("wards").delete().eq("id", w.id);
    if (!error) {
      const affected = incharges.filter(i => (i.wards || []).includes(w.name));
      for (const inc of affected) {
        await supabase.from("incharges").update({ wards: inc.wards.filter(x => x !== w.name) }).eq("id", inc.id);
      }
      fetchIncharges();
    }
    setSaving(false);
    if (error) { showToast("Error deleting ward: " + error.message); return; }
    showToast(`Ward "${w.name}" deleted`);
    setDeleting(null);
    onWardsChanged();
  }

  const detailWard = detailName ? rows.find(r => r.name === detailName) : null;
  const deleteBlocked = deleting && (stats[deleting.name]?.current + stats[deleting.name]?.upcoming) > 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A", display: "flex", alignItems: "center", gap: 10 }}>
            Wards
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 10px", borderRadius: 99 }}>{rows.length} wards · {departments.length} departments</span>
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>See who is placed in every ward and manage wards and their people.</p>
        </div>
        <button id="ward-create" type="button" disabled={!canEditWards} onClick={() => setFormWard(null)} title={canEditWards ? "" : "Run supabase/wards.sql first"}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: canEditWards ? "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)" : "#CBD5E1", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: canEditWards ? "pointer" : "not-allowed", boxShadow: canEditWards ? "0 4px 12px rgba(99,102,241,0.28)" : "none" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New ward
        </button>
      </div>

      {tableMissing && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#92400E" }}>
          <b>Ward editing is turned off.</b> The <code>wards</code> table doesn't exist in Supabase yet. Run <code>supabase/wards.sql</code> in the Supabase SQL editor to turn on creating, renaming and deleting wards. Until then you can still view headcounts and manage the people in each ward.
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: "Currently placed", v: totals.current, a: "#10B981", icon: "🩺", sub: "People on a ward today", onClick: () => { setOcc(occ === "occupied" ? "all" : "occupied"); setPage(1); } },
          { l: "Upcoming", v: totals.upcoming, a: "#6366F1", icon: "📅", sub: "Scheduled to start", onClick: null },
          { l: "Empty wards", v: totals.empty, a: totals.empty ? "#F59E0B" : "#64748B", icon: "🛏️", sub: totals.empty ? "Nobody placed today" : "Every ward staffed ✓", onClick: () => { setOcc(occ === "empty" ? "all" : "empty"); setPage(1); } },
          { l: "Over capacity", v: totals.over, a: totals.over ? "#F43F5E" : "#64748B", icon: "⚠️", sub: totals.over ? "Above their limit" : "Within limits ✓", onClick: () => { setOcc(occ === "over" ? "all" : "over"); setPage(1); } },
        ].map(m => (
          <div key={m.l} className="stat-metric-card" onClick={m.onClick || undefined} style={{ cursor: m.onClick ? "pointer" : "default" }} title={m.onClick ? "Click to filter" : undefined}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.a }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</div>
              <div style={{ fontSize: 20 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 240, maxWidth: 340, flex: 1 }}>
          <svg width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input id="ward-search" style={{ ...INP, padding: "10px 14px 10px 36px", background: "#fff", borderRadius: 10 }} placeholder="Search ward or department…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        </div>
        <FilterPills value={occ} onChange={v => { setOcc(v); setPage(1); }} options={[
          { val: "all", label: "All", count: rows.length },
          { val: "occupied", label: "Occupied", count: rows.length - totals.empty },
          { val: "empty", label: "Empty", count: totals.empty },
        ]} />
        <div style={{ position: "relative" }}>
          <select id="ward-dept-filter" value={dept} onChange={e => { setDept(e.target.value); setPage(1); }} style={SELECT_STYLE}>
            <option value="all">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <SelectChevron />
        </div>
        <div style={{ position: "relative" }}>
          <select id="ward-sort" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={SELECT_STYLE}>
            <option value="order">Sort: Department order</option>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="most">Sort: Most people</option>
            <option value="least">Sort: Fewest people</option>
          </select>
          <SelectChevron />
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", background: "#fff" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>{rows.length ? "No wards match your filters" : "No wards yet"}</div>
          </div>
        ) : (
          <table className="responsive-table incharges-table">
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                {["Ward", "Rotation length", "People assigned", "Upcoming", "In-charge", ""].map(h => (
                  <th key={h} style={{ textAlign: h ? "left" : "right", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => {
                const st = stats[r.name];
                const theme = themeForDept(r.department);
                const sup = supervisorsFor(r.name);
                const over = r.capacity && st.current > r.capacity;
                const pct = r.capacity ? Math.min(100, (st.current / r.capacity) * 100) : null;
                return (
                  <tr key={r.id ?? r.name} className="hover-row" style={{ background: i % 2 ? "#FAFAFC" : "#fff", borderBottom: "1px solid #F1F5F9", cursor: "pointer" }} onClick={() => setDetailName(r.name)}>
                    <td data-label="Ward" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.color, border: `1px solid ${theme.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: theme.accent }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 14 }}>{r.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textColor, marginTop: 2 }}>{r.department}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Rotation length" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: r.nursing_weeks ? "#EEF2FF" : "#F1F5F9", color: r.nursing_weeks ? "#4338CA" : "#94A3B8" }}>N {r.nursing_weeks ? `${r.nursing_weeks}w` : "—"}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: r.midwifery_weeks ? "#F0FDF4" : "#F1F5F9", color: r.midwifery_weeks ? "#166534" : "#94A3B8" }}>M {r.midwifery_weeks ? `${r.midwifery_weeks}w` : "—"}</span>
                      </div>
                    </td>
                    <td data-label="People assigned" style={{ padding: "14px 18px", verticalAlign: "middle", minWidth: 170 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: over ? "#E11D48" : st.current ? "#0F172A" : "#CBD5E1" }}>{st.current}</span>
                        {r.capacity && <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>/ {r.capacity}</span>}
                        {st.current > 0 && <span style={{ fontSize: 11, color: "#64748B" }}>{st.nursing}N · {st.midwifery}M</span>}
                      </div>
                      {pct !== null && (
                        <div style={{ height: 4, background: "#EEF2F6", borderRadius: 99, marginTop: 6, overflow: "hidden", maxWidth: 140 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: over ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981" }} />
                        </div>
                      )}
                    </td>
                    <td data-label="Upcoming" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      {st.upcoming ? <span style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", padding: "3px 10px", borderRadius: 99 }}>+{st.upcoming}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                    <td data-label="In-charge" style={{ padding: "14px 18px", verticalAlign: "middle", fontSize: 13, minWidth: 160 }}>
                      {sup.length > 0 ? (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {sup.map(s => (
                            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: "#F1F5F9", color: "#1E293B", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid #E2E8F0" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1" }} />
                              {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "3px 9px", borderRadius: 99 }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button type="button" className="action-btn-secondary" onClick={() => setDetailName(r.name)}>People</button>
                        <button type="button" className="action-btn-secondary" disabled={!canEditWards} style={{ opacity: canEditWards ? 1 : 0.45 }} onClick={() => setFormWard(r)}>Edit</button>
                        <button type="button" className="action-btn-danger" disabled={!canEditWards} style={{ opacity: canEditWards ? 1 : 0.45 }} onClick={() => setDeleting(r)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <Pagination currentPage={page} totalItems={filtered.length} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemsPerPageOptions={[5, 10, 20, 50]} itemLabel="wards" />
        )}
      </div>

      {detailWard && (
        <WardDetailModal
          ward={detailWard}
          members={members}
          assignments={assignments}
          supervisors={supervisorsFor(detailWard.name)}
          onAdd={onBulkAssign}
          onEditAssignment={onEditAssignment}
          onDeleteAssignment={onDeleteAssignment}
          onEditWard={canEditWards ? () => setFormWard(detailWard) : null}
          onClose={() => setDetailName(null)}
        />
      )}

      {formWard !== undefined && (
        <WardFormModal
          ward={formWard}
          departments={departments}
          existingNames={rows.map(r => r.name)}
          saving={saving}
          onSave={handleSaveWard}
          onCancel={() => setFormWard(undefined)}
        />
      )}

      {deleting && (deleteBlocked ? (
        <ConfirmModal
          isOpen
          title="Can't delete this ward yet"
          message={`${deleting.name} still has ${stats[deleting.name].current} current and ${stats[deleting.name].upcoming} upcoming placement(s). Move or remove those people first.`}
          confirmText="Open ward"
          confirmVariant="info"
          onConfirm={() => { setDetailName(deleting.name); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      ) : (
        <ConfirmModal
          isOpen
          title="Delete ward"
          message={`Delete "${deleting.name}"? It will be removed from any in-charge's ward list. Past placements (${stats[deleting.name]?.completed || 0}) stay in history.`}
          confirmText="Delete ward"
          loading={saving}
          onConfirm={handleDeleteWard}
          onCancel={() => setDeleting(null)}
        />
      ))}
    </div>
  );
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

const NAV_ICONS = {
  dashboard: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  wards: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 3v15" /><path d="M9 10h.01M9 14h.01M17 10h.01M17 14h.01" /></svg>,
  register: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>,
  assign: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 16l2 2 4-4" /></svg>,
  members: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  incharges: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  rotations: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  analytics: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>,
};

// ─── Login screen ─────────────────────────────────────────────────────────────
// Demo auth only — swap handleLogin for a real API call when wiring up a backend.

function LoginScreen({ onGoRegister, onGoForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Enter both email and password."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError("Invalid email or password.");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: "#6366F1", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
            <svg width="26" height="26" fill="none" stroke="white" strokeWidth="2.3" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>RotaManager</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>2023 / 2024 rotation system</div>
        </div>

        <div className="premium-card" style={{ borderRadius: 20, padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Welcome back</div>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Sign in to manage rotations.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={LS}>EMAIL ADDRESS</label>
            <input
              type="email" autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="admin@rota.com"
              style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0" }}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ ...LS, marginBottom: 0 }}>PASSWORD</label>
              {onGoForgotPassword && (
                <button
                  type="button"
                  onClick={onGoForgotPassword}
                  style={{ background: "none", border: "none", color: "#6366F1", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0", paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                {showPw ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, padding: "9px 12px", background: "#FFF1F2", borderRadius: 8, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "12px", marginTop: 20, background: loading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.35)" }}>
            {loading ? "Signing in…" : "Sign in →"}
          </button>

          {onGoRegister && (
            <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#64748B" }}>
              Don't have an account?{" "}
              <button onClick={onGoRegister} style={{ background: "none", border: "none", color: "#6366F1", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                Create one now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Forgot Password Screen ──────────────────────────────────────────────────

function ForgotPasswordScreen({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleResetPassword() {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    setLoading(false);
    if (err) {
      setError(err.message || "Unable to send reset email. Please try again.");
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: "#6366F1", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
            <svg width="26" height="26" fill="none" stroke="white" strokeWidth="2.3" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>RotaManager</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>2023 / 2024 rotation system</div>
        </div>

        <div className="premium-card" style={{ borderRadius: 20, padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, background: "#ECFDF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#10B981" }}>
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Check your email</div>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>
                We've sent a password reset link to <strong style={{ color: "#0F172A" }}>{email}</strong>. Open the link to create your new password.
              </p>
              <button
                onClick={onBackToLogin}
                style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
              >
                Back to sign in
              </button>
              <div style={{ marginTop: 18, fontSize: 13, color: "#94A3B8" }}>
                Didn't receive the email?{" "}
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  style={{ background: "none", border: "none", color: "#6366F1", fontWeight: 700, cursor: loading ? "default" : "pointer", padding: 0 }}
                >
                  {loading ? "Sending..." : "Click to resend"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Reset password</div>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Enter your account email to receive a password reset link.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={LS}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                  placeholder="name@hospital.com"
                  style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0" }}
                />
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, padding: "9px 12px", background: "#FFF1F2", borderRadius: 8, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {error}
                </div>
              )}

              <button
                onClick={handleResetPassword}
                disabled={loading}
                style={{ width: "100%", padding: "12px", marginTop: 20, background: loading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.35)" }}
              >
                {loading ? "Sending link…" : "Send reset link →"}
              </button>

              <button
                onClick={onBackToLogin}
                style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 22, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Screen ───────────────────────────────────────────────────

function ResetPasswordScreen({ onSuccess, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpdatePassword() {
    setError("");
    if (!password.trim()) {
      setError("Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message || "Failed to update password. Link may have expired.");
    } else {
      onSuccess();
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: "#6366F1", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
            <svg width="26" height="26" fill="none" stroke="white" strokeWidth="2.3" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>RotaManager</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>2023 / 2024 rotation system</div>
        </div>

        <div className="premium-card" style={{ borderRadius: 20, padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Set new password</div>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Enter your new password below.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={LS}>NEW PASSWORD</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdatePassword()}
                placeholder="At least 6 characters"
                style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0", paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                {showPw ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={LS}>CONFIRM NEW PASSWORD</label>
            <input
              type={showPw ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdatePassword()}
              placeholder="Repeat new password"
              style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0" }}
            />
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, padding: "9px 12px", background: "#FFF1F2", borderRadius: 8, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {error}
            </div>
          )}

          <button
            onClick={handleUpdatePassword}
            disabled={loading}
            style={{ width: "100%", padding: "12px", marginTop: 20, background: loading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.35)" }}
          >
            {loading ? "Updating password…" : "Update password →"}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 22, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── In-Charge View ──────────────────────────────────────────────────────────

function InChargeMemberRow({ a, i, cols }) {
  return (
    <tr style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={a.member.name} group={a.member.group} size={34} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{a.member.name}</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>{a.member.school}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}><GroupBadge group={a.member.group} /></td>
      <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 13, verticalAlign: "middle" }}>{fmtDate(a.startDate)}</td>
      <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 13, verticalAlign: "middle" }}>{fmtDate(a.endDate)}</td>
      {cols === "full" && (
        <>
          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
            <span style={{ fontWeight: 700, color: a.daysLeft <= 7 ? "#EA580C" : "#334155", fontSize: 13 }}>
              {a.daysLeft === 0 ? "Today" : a.daysLeft + "d"}
            </span>
          </td>
          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}><StatusChip status={a.status} /></td>
        </>
      )}
    </tr>
  );
}

function InChargeTab({ user, members, assignments }) {
  const wards = user.wards || [];
  const [activeWard, setActiveWard] = useState("all");

  function enrichForWard(wardName) {
    const now = new Date();
    return assignments
      .filter(a => a.ward === wardName)
      .map(a => {
        const member = members.find(m => m.id === a.memberId);
        if (!member) return null;
        const dl = daysLeft(a.endDate);
        const ds = Math.ceil((new Date(a.startDate) - now) / (1000 * 60 * 60 * 24));
        let status;
        if (ds > 0) status = "upcoming";
        else if (dl < 0) status = "completed";
        else if (dl === 0) status = "completing_today";
        else if (dl <= 7) status = "ending_soon";
        else status = "active";
        return { ...a, member, status, daysLeft: dl };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }

  const wardData = useMemo(() =>
    wards.map(w => ({ ward: w, wd: WARD_LOOKUP[w], rows: enrichForWard(w) })),
    [assignments, members, wards]
  );

  const singleData = useMemo(() => {
    if (activeWard === "all") return null;
    return wardData.find(d => d.ward === activeWard) || null;
  }, [activeWard, wardData]);

  if (wards.length === 0) return (
    <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{"🔑"}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No wards assigned</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Contact your admin to assign wards to your account.</div>
    </div>
  );

  const WardTable = ({ rows, showWardCol }) => {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(8);

    const activeCount = useMemo(() => rows.filter(a => ["active", "ending_soon", "completing_today"].includes(a.status)).length, [rows]);
    const upcomingCount = useMemo(() => rows.filter(a => a.status === "upcoming").length, [rows]);

    const filtered = useMemo(() => {
      return rows.filter(a => {
        const matchesSearch = !search.trim() ||
          a.member.name?.toLowerCase().includes(search.toLowerCase()) ||
          a.member.school?.toLowerCase().includes(search.toLowerCase()) ||
          (showWardCol && a.ward?.toLowerCase().includes(search.toLowerCase()));

        let matchesStatus = true;
        if (statusFilter === "current") {
          matchesStatus = ["active", "ending_soon", "completing_today"].includes(a.status);
        } else if (statusFilter === "upcoming") {
          matchesStatus = a.status === "upcoming";
        }

        return matchesSearch && matchesStatus;
      });
    }, [rows, search, statusFilter, showWardCol]);

    const paginated = useMemo(() => {
      const start = (page - 1) * perPage;
      return filtered.slice(start, start + perPage);
    }, [filtered, page, perPage]);

    if (rows.length === 0) return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: 12, border: "1px dashed #E2E8F0" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>{"🏥"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No one assigned yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>No members are currently scheduled for this ward.</div>
      </div>
    );

    const headers = showWardCol
      ? ["Member", "Ward", "Group", "Started", "Ends", "Days left", "Status"]
      : ["Member", "Group", "Started", "Ends", "Days left", "Status"];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.length > 2 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", minWidth: 200 }}>
                <input
                  style={{ ...INP, paddingLeft: 32, padding: "8px 12px 8px 32px", fontSize: 12, borderRadius: 8, background: "#fff" }}
                  placeholder="Search member or school…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
                <svg width="13" height="13" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <FilterPills
                value={statusFilter}
                onChange={val => { setStatusFilter(val); setPage(1); }}
                options={[
                  { val: "all", label: "All", count: rows.length },
                  { val: "current", label: "Current", count: activeCount },
                  { val: "upcoming", label: "Upcoming", count: upcomingCount },
                ]}
              />
            </div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              {filtered.length} {filtered.length === 1 ? "member" : "members"}
            </div>
          </div>
        )}

        <div className="table-wrapper" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #E2E8F0", background: "#fff" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 20px", color: "#94A3B8" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No matching members</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing your search query or status filter.</div>
            </div>
          ) : (
            <table className="responsive-table">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {headers.map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }} className="hover-row">
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={a.member.name} group={a.member.group} size={34} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{a.member.name}</div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>{a.member.school}</div>
                        </div>
                      </div>
                    </td>
                    {showWardCol && (
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: WARD_LOOKUP[a.ward]?.textColor || "#334155", background: WARD_LOOKUP[a.ward]?.color || "#F8FAFC", padding: "3px 10px", borderRadius: 99 }}>
                          {a.ward}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <GroupBadge group={a.member.group} />
                    </td>
                    <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 13, verticalAlign: "middle" }}>
                      {fmtDate(a.startDate)}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 13, verticalAlign: "middle" }}>
                      {fmtDate(a.endDate)}
                    </td>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <span style={{ fontWeight: 700, color: a.daysLeft <= 7 ? "#EA580C" : "#334155", fontSize: 13 }}>
                        {a.daysLeft === 0 ? "Today" : a.daysLeft + "d"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <StatusChip status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={setPerPage}
            itemsPerPageOptions={[5, 8, 15, 25]}
            itemLabel="members"
          />
        </div>
      </div>
    );
  };

  const totalActive = wardData.reduce((s, d) => s + d.rows.filter(a => ["active","ending_soon","completing_today"].includes(a.status)).length, 0);
  const totalUpcoming = wardData.reduce((s, d) => s + d.rows.filter(a => a.status === "upcoming").length, 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>My Wards</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>People assigned to your ward(s).</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
        <button onClick={() => setActiveWard("all")} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, borderRadius: 99, cursor: "pointer", border: activeWard === "all" ? "2px solid #6366F1" : "1.5px solid #E2E8F0", background: activeWard === "all" ? "#EEF2FF" : "#fff", color: activeWard === "all" ? "#4338CA" : "#64748B", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
          All wards
          <span style={{ background: activeWard === "all" ? "#6366F1" : "#E2E8F0", color: activeWard === "all" ? "#fff" : "#64748B", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99 }}>{totalActive}</span>
        </button>
        {wardData.map(({ ward, wd, rows }) => {
          const isSel = activeWard === ward;
          const cnt = rows.filter(a => ["active","ending_soon","completing_today"].includes(a.status)).length;
          return (
            <button key={ward} onClick={() => setActiveWard(ward)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, borderRadius: 99, cursor: "pointer", border: isSel ? "2px solid " + (wd?.accent || "#6366F1") : "1.5px solid #E2E8F0", background: isSel ? (wd?.color || "#EEF2FF") : "#fff", color: isSel ? (wd?.textColor || "#4338CA") : "#64748B", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
              {ward}
              <span style={{ background: isSel ? (wd?.accent || "#6366F1") : "#E2E8F0", color: isSel ? "#fff" : "#64748B", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99 }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {activeWard === "all" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {wardData.map(({ ward, wd, rows }) => (
            <div key={ward}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid " + (wd?.accent || "#E2E8F0") + "30" }}>
                {wd && <div style={{ width: 10, height: 10, borderRadius: 3, background: wd.accent }} />}
                <span style={{ fontSize: 16, fontWeight: 700, color: wd?.textColor || "#0F172A" }}>{ward}</span>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>· {rows.filter(a => ["active","ending_soon","completing_today"].includes(a.status)).length} current</span>
              </div>
              <WardTable rows={rows} showWardCol={false} />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            {singleData?.wd && <div style={{ width: 12, height: 12, borderRadius: 3, background: singleData.wd.accent }} />}
            <span style={{ fontSize: 18, fontWeight: 700, color: singleData?.wd?.textColor || "#0F172A" }}>{activeWard}</span>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>· {singleData?.rows.filter(a => ["active","ending_soon","completing_today"].includes(a.status)).length || 0} current, {singleData?.rows.filter(a => a.status === "upcoming").length || 0} upcoming</span>
          </div>
          <WardTable rows={singleData?.rows || []} showWardCol={false} />
        </div>
      )}
    </div>
  );
}


// ─── Member Dashboard ─────────────────────────────────────────────────────────

function MemberDashboardTab({ user, members, assignments }) {
  const member = members.find(m => m.auth_id === user.id);
  const internalMemberId = member?.id;
  const myAssignments = assignments.filter(a => a.memberId === internalMemberId).sort((a,b) => new Date(b.startDate) - new Date(a.startDate));

  if (!member) return <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading your profile...</div>;

  const enrichedAssignments = myAssignments.map(a => {
    const wd = WARD_LOOKUP[a.ward];
    const now = new Date();
    const ed = new Date(a.endDate);
    const sd = new Date(a.startDate);
    const diffDays = Math.ceil((ed - now) / (1000 * 60 * 60 * 24));
    const startDiff = Math.ceil((sd - now) / (1000 * 60 * 60 * 24));
    let status = "active";
    if (startDiff > 0) status = "upcoming";
    else if (diffDays < 0) status = "completed";
    else if (diffDays === 0) status = "completing_today";
    else if (diffDays <= 7) status = "ending_soon";
    return { ...a, wd, status };
  });

  const active = enrichedAssignments.filter(a => ["active", "ending_soon", "completing_today"].includes(a.status));
  const upcoming = enrichedAssignments.filter(a => a.status === "upcoming");
  const past = enrichedAssignments.filter(a => a.status === "completed");

  const [pastPage, setPastPage] = useState(1);
  const [pastPerPage, setPastPerPage] = useState(5);
  const paginatedPast = useMemo(() => {
    const start = (pastPage - 1) * pastPerPage;
    return past.slice(start, start + pastPerPage);
  }, [past, pastPage, pastPerPage]);

  const AssignmentCard = ({ a }) => {
    const isActive = ["active", "ending_soon", "completing_today"].includes(a.status);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, background: isActive ? "#F0FDF4" : "#F8FAFC", border: "1px solid", borderColor: isActive ? "#BBF7D0" : "#E2E8F0", borderRadius: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: a.wd?.accent || "#CBD5E1" }} />
            <div style={{ fontWeight: 700, color: a.wd?.textColor || "#334155" }}>{a.ward}</div>
          </div>
          <div style={{ fontSize: 13, color: "#64748B" }}>
            {fmtDate(a.startDate)} – {fmtDate(a.endDate)} ({a.weeks} weeks)
          </div>
        </div>
        <div>
          <StatusChip status={a.status} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Welcome back, {member.name.split(" ")[0]}!</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Track your rotation schedule and ward placements.</p>
      </div>

      <div className="premium-card" style={{ padding: "28px 32px", marginBottom: 24, borderRadius: 16 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #F1F5F9" }}>
          <Avatar name={member.name} group={member.group} size={56} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{member.name}</div>
            <div style={{ fontSize: 14, color: "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              {member.school} <span style={{ color: "#CBD5E1" }}>•</span> <GroupBadge group={member.group} />
            </div>
          </div>
        </div>
        
        {enrichedAssignments.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: 12, border: "2px dashed #E2E8F0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>No placements yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>You have not been assigned to any wards.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {active.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#10B981", borderRadius: "50%", boxShadow: "0 0 0 3px #D1FAE5" }} /> Current Placement
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {active.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
              </div>
            )}
            
            {upcoming.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Upcoming</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {upcoming.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
              </div>
            )}
            
            {past.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                  Past History ({past.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {paginatedPast.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
                {past.length > pastPerPage && (
                  <div style={{ marginTop: 14, background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                    <Pagination
                      currentPage={pastPage}
                      totalItems={past.length}
                      itemsPerPage={pastPerPage}
                      onPageChange={setPastPage}
                      onItemsPerPageChange={setPastPerPage}
                      itemsPerPageOptions={[5, 10, 20]}
                      itemLabel="past rotations"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

function MainApp({ user, onLogout }) {
  const [tab, setTab] = useState(user.role === "Member" ? "memberDashboard" : user.role === "In-charge" ? "inCharge" : "dashboard");
  const [assignTargetIds, setAssignTargetIds] = useState([]);
  const [registerInitialRole, setRegisterInitialRole] = useState("Member");
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [wardRows, setWardRows] = useState(DEFAULT_WARD_ROWS);
  const [tableMissing, setTableMissing] = useState(false);
  const [toast, setToast] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ password: "", confirmPassword: "", show: false });
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changePwError, setChangePwError] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function fetchWards() {
    supabase.from('wards').select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation "public.wards" does not exist')) {
            setTableMissing(true);
            applyWardRows(DEFAULT_WARD_ROWS);
          } else {
            console.error("wards fetch error:", error);
          }
          return;
        }
        setTableMissing(false);
        if (data && data.length > 0) {
          setWardRows(data);
          applyWardRows(data);
        } else {
          applyWardRows(DEFAULT_WARD_ROWS);
        }
      })
      .catch(console.error);
  }

  async function handleChangePassword() {
    setChangePwError("");
    if (!changePwForm.password.trim()) { setChangePwError("Enter a new password."); return; }
    if (changePwForm.password.length < 6) { setChangePwError("Password must be at least 6 characters."); return; }
    if (changePwForm.password !== changePwForm.confirmPassword) { setChangePwError("Passwords do not match."); return; }
    setChangePwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: changePwForm.password });
    setChangePwLoading(false);
    if (error) {
      setChangePwError(error.message || "Failed to update password.");
    } else {
      showToast("Password updated successfully!");
      setShowChangePassword(false);
      setChangePwForm({ password: "", confirmPassword: "", show: false });
    }
  }

  useEffect(() => {
    // Initial fetch
    supabase.from('members').select('*').then(({ data }) => data && setMembers(data)).catch(console.error);
    supabase.from('assignments').select('*').then(({ data }) => data && setAssignments(data)).catch(console.error);
    fetchWards();

    // Setup realtime subscriptions
    const memberSub = supabase.channel('members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        supabase.from('members').select('*').then(({ data }) => data && setMembers(data));
      })
      .subscribe();

    const assignmentSub = supabase.channel('assignments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        supabase.from('assignments').select('*').then(({ data }) => data && setAssignments(data));
      })
      .subscribe();

    const wardSub = supabase.channel('wards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wards' }, () => {
        fetchWards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(memberSub);
      supabase.removeChannel(assignmentSub);
      supabase.removeChannel(wardSub);
    };
  }, []);

  async function handleRegister(form) {
    if (form.role === "In-charge") {
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { role: "In-charge", name: form.name, wards: form.wards } }
      });
      if (adminSession) await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
          showToast("Email already exists in Auth — delete the user from Supabase Auth first");
        } else {
          showToast("Error: " + error.message);
        }
        return;
      }
      // Supabase silently returns existing user without error — detect by checking identities
      if (!data.user?.identities || data.user.identities.length === 0) {
        showToast("Email already exists in Auth — delete the user from Supabase Auth first");
        return;
      }
      await supabase.from("incharges").insert([{ name: form.name, email: form.email, phone: form.phone, wards: form.wards, auth_id: data.user?.id }]);
      showToast(`In-charge ${form.name} registered successfully`);
    } else {
      const { id, role, ward, ...memberData } = form;
      supabase.from('members').insert([memberData]).select().single()
        .then(({ data, error }) => {
          if (error) throw error;
          setMembers((p) => [...p, data]);
          showToast(`${data.name} registered`);
        })
        .catch(err => { console.error(err); showToast("Error registering member"); });
    }
  }

  function handleBulkAssign(list) {
    const insertList = list.map(({ id, ...rest }) => rest);
    supabase.from('assignments').insert(insertList)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from('assignments').select('*');
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`${list.length} member${list.length > 1 ? "s" : ""} assigned to ${list[0]?.ward}`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error assigning wards");
      });
  }

  function handleEditAssignment(assignmentId, newData) {
    supabase.from('assignments').update(newData).eq('id', assignmentId)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from('assignments').select('*');
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`Assignment updated successfully`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error updating assignment: " + (err.message || ""));
      });
  }

  function handleDeleteAssignment(assignmentId) {
    supabase.from('assignments').delete().eq('id', assignmentId)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from('assignments').select('*');
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`Assignment deleted successfully`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error deleting assignment: " + (err.message || ""));
      });
  }

  const completedCount = useMemo(() =>
    members.filter((m) => getLatestPlacement(m.id, assignments)?.status === "completed").length,
    [members, assignments]
  );

  const NAV = user.role === "Member" ? [
    { id: "memberDashboard", label: "My Rotations", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg> }
  ] : user.role === "In-charge" ? [
    { id: "inCharge", label: "My Ward", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> }
  ] : [
    { id: "dashboard", label: "Dashboard" },
    { id: "wards", label: "Wards" },
    { id: "assign", label: "Assign wards" },
    { id: "members", label: "Members" },
    { id: "incharges", label: "In-charges" },
    { id: "rotations", label: "Rotations" },
    { id: "analytics", label: "Analytics & Reports" },
    { id: "register", label: "Register" },
  ];

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: "#6366F1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>RotaManager</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>2023 / 2024</div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav-container" style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", padding: "8px 10px 4px", letterSpacing: "0.1em" }}>MANAGEMENT</div>
          {NAV.map(({ id, label, icon }) => (
            <button key={id} className="sidebar-nav-btn" onClick={() => { if (id === "register") setRegisterInitialRole("Member"); setTab(id); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, background: tab === id ? "rgba(99,102,241,0.2)" : "transparent", color: tab === id ? "#818CF8" : "rgba(255,255,255,0.5)", border: "none", width: "100%", textAlign: "left", transition: "all .15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{icon || NAV_ICONS[id]}<span>{label}</span></div>
              {id === "dashboard" && completedCount > 0 && (
                <span style={{ background: "#F43F5E", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, minWidth: 18, textAlign: "center" }}>{completedCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", padding: "0 4px 10px" }}>{members.length} members · {assignments.length} assignments</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#6366F1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {(user?.name || user?.email || "User").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || user?.email || "User"}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{user?.role || "Member"}</div>
            </div>
            <button onClick={() => { setChangePwError(""); setChangePwForm({ password: "", confirmPassword: "", show: false }); setShowChangePassword(true); }} title="Change password" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#818CF8"; e.currentTarget.style.background = "rgba(99,102,241,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "none"; }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </button>
            <button onClick={() => setShowLogoutConfirm(true)} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.background = "rgba(248,113,113,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "none"; }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          </div>
        </div>
      </aside>
      <main className="app-main">
        {tab === "dashboard" && (
          <DashboardTab
            members={members}
            assignments={assignments}
            wardRows={wardRows}
            onNavigateTab={setTab}
            onGoAssign={(ids) => { 
              if (!ids) setAssignTargetIds([]);
              else if (Array.isArray(ids)) setAssignTargetIds(ids);
              else setAssignTargetIds([ids]);
              setTab("assign"); 
            }}
          />
        )}
        {tab === "wards" && (
          <WardsTab
            members={members}
            assignments={assignments}
            wardRows={wardRows}
            tableMissing={tableMissing}
            onWardsChanged={fetchWards}
            onBulkAssign={handleBulkAssign}
            onEditAssignment={handleEditAssignment}
            onDeleteAssignment={handleDeleteAssignment}
            showToast={showToast}
          />
        )}
        {tab === "register" && <RegisterTab onRegister={handleRegister} adminMode={true} initialRole={registerInitialRole} />}
        {tab === "assign" && <AssignTab members={members} assignments={assignments} onBulkAssign={handleBulkAssign} initialTargetIds={assignTargetIds} />}
        {tab === "members" && <MembersTab members={members} assignments={assignments} />}
        {tab === "incharges" && <InchargesTab showToast={showToast} onGoRegister={() => { setRegisterInitialRole("In-charge"); setTab("register"); }} />}
        {tab === "rotations" && (
          <RotationsTab
            members={members}
            assignments={assignments}
            wardRows={wardRows}
            onNavigateTab={setTab}
            onEditAssignment={handleEditAssignment}
            onDeleteAssignment={handleDeleteAssignment}
          />
        )}
        {tab === "analytics" && (
          <AnalyticsReportTab
            members={members}
            assignments={assignments}
            wardRows={wardRows}
            onNavigateTab={setTab}
          />
        )}
        {tab === "memberDashboard" && <MemberDashboardTab user={user} members={members} assignments={assignments} />}
        {tab === "inCharge" && <InChargeTab user={user} members={members} assignments={assignments} />}
      </main>
      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div className="premium-card" style={{ padding: "28px 28px", maxWidth: 340, width: "90%", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.25) !important" }}>
            <div style={{ width: 44, height: 44, background: "#FFF1F2", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width="22" height="22" fill="none" stroke="#BE123C" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>Sign out?</div>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 22 }}>You will be returned to the login screen.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: "10px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={onLogout} style={{ flex: 1, padding: "10px", background: "#BE123C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Change Password Modal */}
      {showChangePassword && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div className="premium-card" style={{ padding: "28px 28px", maxWidth: 380, width: "100%", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.25) !important" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, background: "#EEF2FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#6366F1" }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Change Password</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Update your account password</div>
                </div>
              </div>
              <button onClick={() => setShowChangePassword(false)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 4 }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={LS}>NEW PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input
                  type={changePwForm.show ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={changePwForm.password}
                  onChange={(e) => setChangePwForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                  style={{ ...INP, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setChangePwForm(f => ({ ...f, show: !f.show }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                  {changePwForm.show ? (
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LS}>CONFIRM PASSWORD</label>
              <input
                type={changePwForm.show ? "text" : "password"}
                placeholder="Repeat new password"
                value={changePwForm.confirmPassword}
                onChange={(e) => setChangePwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                style={INP}
              />
            </div>

            {changePwError && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, padding: "8px 12px", background: "#FFF1F2", borderRadius: 8, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {changePwError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowChangePassword(false)} style={{ flex: 1, padding: "10px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleChangePassword} disabled={changePwLoading} style={{ flex: 1.3, padding: "10px", background: changePwLoading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: changePwLoading ? "default" : "pointer" }}>
                {changePwLoading ? "Saving..." : "Save Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [isRecovery, setIsRecovery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    // Check if arriving via a recovery URL hash or search parameter
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (hash.includes("type=recovery") || search.includes("type=recovery")) {
        setIsRecovery(true);
      }
      if (hash.includes("error_description=")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const desc = params.get("error_description");
        if (desc) {
          showToast(decodeURIComponent(desc.replace(/\+/g, " ")));
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    }

    async function syncUserSession(session) {
      if (!session?.user) {
        setUser(null);
        return;
      }
      const role = session.user.user_metadata?.role || "Member";
      let name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User";
      let wards = session.user.user_metadata?.wards || [];

      if (role === "In-charge") {
        try {
          const { data: inc } = await supabase.from("incharges")
            .select("wards, name")
            .or(`auth_id.eq.${session.user.id},email.eq.${session.user.email}`)
            .maybeSingle();
          if (inc) {
            if (Array.isArray(inc.wards)) wards = inc.wards;
            if (inc.name) name = inc.name;
          }
        } catch (e) {
          console.warn("Could not sync incharge wards from table:", e);
        }
      }

      setUser({
        id: session.user.id,
        name,
        email: session.user.email,
        role,
        wards
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isRecoveryHash = typeof window !== "undefined" && window.location.hash && window.location.hash.includes("type=recovery");
      if (session?.user && !isRecovery && !isRecoveryHash) {
        syncUserSession(session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      } else if (session?.user && !isRecovery && !window.location.hash?.includes("type=recovery")) {
        syncUserSession(session);
      } else if (!session?.user) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isRecovery]);

  if (loading) return <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Inter', sans-serif" }}>Loading session...</div>;

  // If in password recovery mode, render the reset password view
  if (isRecovery || view === "resetPassword") {
    return (
      <>
        <ResetPasswordScreen
          onSuccess={async () => {
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            setIsRecovery(false);
            setView("login");
            showToast("Password updated successfully! Please sign in with your new password.");
            await supabase.auth.signOut();
          }}
          onCancel={() => {
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            setIsRecovery(false);
            setView("login");
          }}
        />
        <Toast msg={toast} />
      </>
    );
  }

  if (user) {
    return <MainApp user={user} onLogout={() => supabase.auth.signOut()} />;
  }

  if (view === "forgotPassword") {
    return (
      <>
        <ForgotPasswordScreen onBackToLogin={() => setView("login")} />
        <Toast msg={toast} />
      </>
    );
  }

  if (view === "register") {
    return (
      <>
        <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="premium-card" style={{ padding: "32px 40px", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
            <RegisterTab onRegister={async (form) => {
              const { data, error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: { data: { role: 'Member', name: form.name } }
              });
              if (error) {
                showToast("Error registering: " + error.message);
              } else if (data.user) {
                await supabase.from('members').insert([{
                  auth_id: data.user.id,
                  name: form.name,
                  email: form.email,
                  phone: form.phone,
                  school: form.school,
                  group: form.group
                }]);
                showToast("Successfully registered! Please log in.");
                setView("login");
              }
            }} />
            <button onClick={() => setView("login")} style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 24, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back to sign in
            </button>
          </div>
        </div>
        <Toast msg={toast} />
      </>
    );
  }

  return (
    <>
      <LoginScreen
        onGoRegister={() => setView("register")}
        onGoForgotPassword={() => setView("forgotPassword")}
      />
      <Toast msg={toast} />
    </>
  );
}
