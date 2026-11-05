import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { DEFAULT_WARD_ROWS, WARD_LOOKUP, themeForDept } from "../../constants/wardGroups";
import { assignmentStatus, ACTIVE_STATUSES, getLatestPlacement } from "../../utils/rotationRules";
import { fmtDate } from "../../utils/dates";
import Avatar from "../../components/common/Avatar";
import { GroupBadge, StatusChip } from "../../components/common/Badge";
import Pagination from "../../components/common/Pagination";
import FilterPills from "../../components/common/FilterPills";
import StatCard from "./StatCard";
import WardCapacityBarChart from "../../components/charts/WardCapacityBarChart";
import DepartmentDistributionDonut from "../../components/charts/DepartmentDistributionDonut";
import CohortCompletionTierChart from "../../components/charts/CohortCompletionTierChart";
import DisciplineComparisonWidget from "../../components/charts/DisciplineComparisonWidget";
import AnalyticsReportTab from "../analytics/AnalyticsReportTab";

const INP = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13.5,
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  background: "#FFFFFF",
  color: "#0F172A",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export function DashboardTab({ members, assignments, wardRows, onNavigateTab, onGoAssign }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortCol, setSortCol] = useState("daysLeft"); // "name", "group", "ward", "startDate", "daysLeft", "status"
  const [sortDir, setSortDir] = useState("asc");

  const rosterSectionRef = useRef(null);
  const wardsSectionRef = useRef(null);

  // Wards state & search/filter
  const wards = useMemo(() => wardRows || DEFAULT_WARD_ROWS, [wardRows]);
  const [wardSearch, setWardSearch] = useState("");
  const [wardDept, setWardDept] = useState("all");
  const [wardOcc, setWardOcc] = useState("all");
  const [showAllWards, setShowAllWards] = useState(false);
  const [wardCardDensity, setWardCardDensity] = useState("detailed"); // "detailed" | "compact"
  const [dashMode, setDashMode] = useState("operations"); // "operations", "analytics"
  const [showInsightsPanel, setShowInsightsPanel] = useState(true);
  const [showCohortCharts, setShowCohortCharts] = useState(true);

  // In-charges sync for supervisor lookup with offline caching
  const [incharges, setIncharges] = useState(() => {
    try {
      const cached = localStorage.getItem("rotamanager_cache_incharges");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const loadIncharges = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }
      supabase
        .from("incharges")
        .select("id, name, email, phone, wards")
        .then(({ data, error }) => {
          if (!error && data) {
            setIncharges(data);
            try {
              localStorage.setItem("rotamanager_cache_incharges", JSON.stringify(data));
            } catch {}
          }
        })
        .catch((err) => {
          console.warn("Offline or network issue fetching incharges:", err?.message || err);
        });
    };

    loadIncharges();

    const handleOnline = () => {
      loadIncharges();
    };
    window.addEventListener("online", handleOnline);

    const ch = supabase
      .channel("dashboard_incharges_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, () => {
        loadIncharges();
      })
      .subscribe();

    return () => {
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(ch);
    };
  }, []);

  const supervisorsFor = (name) => incharges.filter((i) => (i.wards || []).includes(name));

  // Compute ward stats: current placements, upcoming, discipline counts
  const wardStats = useMemo(() => {
    const s = {};
    wards.forEach((w) => {
      s[w.name] = { current: 0, upcoming: 0, completed: 0, nursing: 0, midwifery: 0 };
    });
    assignments.forEach((a) => {
      const st = s[a.ward];
      if (!st) return;
      const status = assignmentStatus(a);
      if (ACTIVE_STATUSES.includes(status)) {
        st.current++;
        if (a.group === "midwifery") st.midwifery++;
        else st.nursing++;
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

    wards.forEach((w) => {
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

  const departments = useMemo(() => [...new Set(wards.map((w) => w.department))], [wards]);

  const filteredWards = useMemo(() => {
    return wards.filter((w) => {
      const st = wardStats[w.name] || { current: 0 };
      const sm =
        !wardSearch.trim() ||
        w.name.toLowerCase().includes(wardSearch.toLowerCase()) ||
        w.department.toLowerCase().includes(wardSearch.toLowerCase());
      const dm = wardDept === "all" || w.department === wardDept;
      const isOver = w.capacity && st.current > w.capacity;
      const isNear = w.capacity && !isOver && st.current / w.capacity >= 0.8 && st.current > 0;
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
  const enriched = useMemo(
    () =>
      members.map((m) => {
        const placement = getLatestPlacement(m.id, assignments);
        return { ...m, placement };
      }),
    [members, assignments]
  );

  const counts = {
    all: enriched.length,
    unassigned: enriched.filter((m) => !m.placement).length,
    active: enriched.filter((m) => m.placement?.status === "active").length,
    ending_soon: enriched.filter((m) => ["ending_soon", "completing_today"].includes(m.placement?.status)).length,
    completed: enriched.filter((m) => m.placement?.status === "completed").length,
  };
  const completedIds = enriched.filter((m) => m.placement?.status === "completed").map((m) => m.id);

  const nursingActive = enriched.filter((m) => m.group === "nursing" && m.placement?.status === "active").length;
  const midwiferyActive = enriched.filter((m) => m.group === "midwifery" && m.placement?.status === "active").length;

  const filtered = useMemo(() => {
    const list = enriched.filter((m) => {
      const sm =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.school.toLowerCase().includes(search.toLowerCase()) ||
        (m.placement?.ward || "").toLowerCase().includes(search.toLowerCase());
      if (!sm) return false;
      if (filter === "all") return true;
      if (filter === "unassigned") return !m.placement;
      if (filter === "active") return m.placement?.status === "active";
      if (filter === "ending_soon") return ["ending_soon", "completing_today"].includes(m.placement?.status);
      if (filter === "completed") return m.placement?.status === "completed";
      return true;
    });

    return [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortCol === "name") return a.name.localeCompare(b.name) * dir;
      if (sortCol === "group") return (a.group || "").localeCompare(b.group || "") * dir;
      if (sortCol === "ward") {
        const wa = a.placement?.ward || "zzz";
        const wb = b.placement?.ward || "zzz";
        return wa.localeCompare(wb) * dir;
      }
      if (sortCol === "startDate") {
        const da = a.placement?.startDate || "9999-12-31";
        const db = b.placement?.startDate || "9999-12-31";
        return da.localeCompare(db) * dir;
      }
      if (sortCol === "status") {
        const sa = a.placement?.status || "unassigned";
        const sb = b.placement?.status || "unassigned";
        return sa.localeCompare(sb) * dir;
      }
      // default: daysLeft
      const dla = a.placement ? a.placement.daysLeft : 9999;
      const dlb = b.placement ? b.placement.daysLeft : 9999;
      return (dla - dlb) * dir;
    });
  }, [enriched, search, filter, sortCol, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const handleKpiFilter = (targetFilter) => {
    const nextFilter = filter === targetFilter ? "all" : targetFilter;
    setFilter(nextFilter);
    setPage(1);
    if (rosterSectionRef.current) {
      rosterSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="dashboard-container fadeIn">
      {/* Header & Quick Navigation */}
      <div className="dashboard-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 className="dashboard-title-text">Clinical Rotation Command Center</h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: "#065F46",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                padding: "3px 10px",
                borderRadius: 99,
              }}
            >
              <span className="status-dot-pulse" />
              Live Hospital View
            </span>
          </div>
          <p style={{ fontSize: 13.5, color: "#64748B", marginTop: 6, maxWidth: 640, lineHeight: 1.45 }}>
            Real-time oversight of hospital ward occupancy, departmental trainee capacity, and clinical rotation schedules.
          </p>
        </div>

        <div className="dashboard-header-controls">
          <div className="dashboard-mode-toggle">
            <button
              type="button"
              onClick={() => setDashMode("operations")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: dashMode === "operations" ? "#fff" : "transparent",
                color: dashMode === "operations" ? "#0F172A" : "#64748B",
                boxShadow: dashMode === "operations" ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span>Live Operations</span>
            </button>
            <button
              type="button"
              onClick={() => setDashMode("analytics")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: dashMode === "analytics" ? "#fff" : "transparent",
                color: dashMode === "analytics" ? "#4338CA" : "#64748B",
                boxShadow: dashMode === "analytics" ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Executive Analytics</span>
            </button>
          </div>

          {onNavigateTab && (
            <div className="dashboard-quick-actions">
              <button
                type="button"
                onClick={() => onNavigateTab("wards")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  background: "#fff",
                  border: "1px solid #CBD5E1",
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#1E293B",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="14" height="14" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M3 9h6M3 15h6" />
                </svg>
                <span>Wards Directory</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab("assign")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 15px",
                  background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.28)",
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
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
          {/* Interactive KPI Metric Cards */}
          <div className="dashboard-grid">
            <StatCard
              title="Active Rotations"
              value={counts.active}
              unit={`/ ${counts.all || 0}`}
              badge="Currently Placed"
              subtitle={`${nursingActive} Nursing · ${midwiferyActive} Midwifery`}
              accentColor="#10B981"
              iconBg="#ECFDF5"
              textColor="#065F46"
              progressPct={counts.all > 0 ? Math.round((counts.active / counts.all) * 100) : 0}
              active={filter === "active"}
              onClick={() => handleKpiFilter("active")}
              icon={
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              }
            />

            <StatCard
              title="Ward Utilization"
              value={wardMetrics.occupiedWards}
              unit={`/ ${wardMetrics.totalWards} wards`}
              badge={
                wardMetrics.overCapacityWards > 0
                  ? `${wardMetrics.overCapacityWards} Over Cap`
                  : `${wardMetrics.overallOccupancyPct}% Bed Load`
              }
              subtitle={
                wardMetrics.totalCapacity
                  ? `${wardMetrics.monitoredPlaced} of ${wardMetrics.totalCapacity} monitored beds filled`
                  : `${wardMetrics.occupiedWards} occupied · ${wardMetrics.emptyWards} empty`
              }
              accentColor="#6366F1"
              iconBg="#EEF2FF"
              textColor="#3730A3"
              progressPct={wardMetrics.overallOccupancyPct}
              onClick={() => {
                if (wardsSectionRef.current) {
                  wardsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              icon={
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
            />

            <StatCard
              title="Unassigned Trainees"
              value={counts.unassigned}
              badge={counts.ending_soon > 0 ? `${counts.ending_soon} Ending ≤7d` : "Pending Placement"}
              subtitle={
                counts.ending_soon > 0
                  ? `${counts.ending_soon} active placement${counts.ending_soon === 1 ? "" : "s"} ending within 7 days`
                  : `${counts.all} total registered members`
              }
              accentColor="#F59E0B"
              iconBg="#FFFBEB"
              textColor="#92400E"
              progressPct={counts.all > 0 ? Math.round((counts.unassigned / counts.all) * 100) : 0}
              active={filter === "unassigned"}
              onClick={() => handleKpiFilter("unassigned")}
              icon={
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />

            <StatCard
              title="Completed — Ready"
              value={counts.completed}
              badge={counts.completed > 0 ? "Action Required" : "All Clear"}
              subtitle={
                counts.completed > 0 ? "Awaiting next ward rotation" : "No overdue reassignments"
              }
              accentColor="#F43F5E"
              iconBg="#FFF1F2"
              textColor="#BE123C"
              progressPct={counts.all > 0 ? Math.round((counts.completed / counts.all) * 100) : 0}
              active={filter === "completed"}
              onClick={() => handleKpiFilter("completed")}
              icon={
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
          </div>

          {/* Alert banner */}
          {counts.completed > 0 && (
            <div className="dashboard-alert-banner">
              <div
                style={{
                  width: 42,
                  height: 42,
                  background: "#FFE4E6",
                  color: "#BE123C",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid #FECDD3",
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#9F1239" }}>
                  {counts.completed} {counts.completed > 1 ? "trainees have" : "trainee has"} completed their ward rotation and need reassignment
                </div>
                <div style={{ fontSize: 12.5, color: "#BE123C", marginTop: 2 }}>
                  Select all completed members immediately to schedule their next clinical ward placement.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onGoAssign(completedIds)}
                style={{
                  padding: "10px 18px",
                  background: "#BE123C",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s",
                  boxShadow: "0 4px 12px rgba(190,18,60,0.25)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#9F1239")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#BE123C")}
              >
                Reassign all {counts.completed} →
              </button>
            </div>
          )}

          {/* Hospital Rotation Analytics & Visualizations Panel */}
          <div className="dashboard-section-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: showInsightsPanel ? 18 : 0,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "#EEF2FF",
                      color: "#4338CA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>
                  <h3
                    style={{
                      fontSize: 17.5,
                      fontWeight: 800,
                      color: "#0F172A",
                      margin: 0,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Hospital Clinical Insights & Capacity Analytics
                  </h3>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#4338CA",
                      background: "#EEF2FF",
                      border: "1px solid #C7D2FE",
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    Interactive Visuals
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
                  Live bed capacity comparisons, departmental trainee distribution, and 52-week clinical progression funnels.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {showInsightsPanel && (
                  <button
                    type="button"
                    onClick={() => setShowCohortCharts(!showCohortCharts)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: showCohortCharts ? "#C7D2FE" : "#E2E8F0",
                      background: showCohortCharts ? "#EEF2FF" : "#fff",
                      color: showCohortCharts ? "#4338CA" : "#64748B",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{showCohortCharts ? "Hide 52w Funnel ↑" : "Show 52w Funnel ↓"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowInsightsPanel(!showInsightsPanel)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span>{showInsightsPanel ? "Collapse Charts" : "Expand Charts"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashMode("analytics")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 13px",
                    background: "#0F172A",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(15,23,42,0.15)",
                  }}
                >
                  <span>Executive Report</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {showInsightsPanel && (
              <>
                <div className="analytics-grid" style={{ marginBottom: showCohortCharts ? 16 : 0 }}>
                  <WardCapacityBarChart
                    wards={wards}
                    wardStats={wardStats}
                    onSelectWard={() => onNavigateTab && onNavigateTab("wards")}
                  />
                  <DepartmentDistributionDonut departments={departments} wards={wards} wardStats={wardStats} />
                </div>

                {showCohortCharts && (
                  <div className="analytics-grid" style={{ marginTop: 16, marginBottom: 0 }}>
                    <CohortCompletionTierChart members={members} assignments={assignments} />
                    <DisciplineComparisonWidget members={members} assignments={assignments} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ward Clinical Occupancy & Capacity Explorer */}
          <div ref={wardsSectionRef} className="dashboard-section-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "#ECFDF5",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <h3
                    style={{
                      fontSize: 17.5,
                      fontWeight: 800,
                      color: "#0F172A",
                      margin: 0,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Ward Clinical Occupancy & Capacity
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#4338CA",
                      background: "#EEF2FF",
                      border: "1px solid #C7D2FE",
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    {wards.length} Wards
                  </span>
                  {wardMetrics.overCapacityWards > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#9F1239",
                        background: "#FFE4E6",
                        border: "1px solid #FECDD3",
                        padding: "2px 8px",
                        borderRadius: 99,
                      }}
                    >
                      {wardMetrics.overCapacityWards} Over Capacity
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
                  Filter hospital units by department or capacity threshold, inspect clinical supervision, and manage ward beds.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div className="dashboard-view-switcher">
                  <button
                    type="button"
                    onClick={() => setWardCardDensity("detailed")}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      background: wardCardDensity === "detailed" ? "#fff" : "transparent",
                      color: wardCardDensity === "detailed" ? "#0F172A" : "#64748B",
                      boxShadow: wardCardDensity === "detailed" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Detailed Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setWardCardDensity("compact")}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      background: wardCardDensity === "compact" ? "#fff" : "transparent",
                      color: wardCardDensity === "compact" ? "#0F172A" : "#64748B",
                      boxShadow: wardCardDensity === "compact" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Compact View
                  </button>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab("wards")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 12px",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4338CA",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>Manage Wards</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            </div>

            {/* Department Quick Filter Strip */}
            {departments.length > 0 && (
              <div className="dept-filter-strip">
                <button
                  type="button"
                  onClick={() => setWardDept("all")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 13px",
                    borderRadius: 99,
                    border: `1.5px solid ${wardDept === "all" ? "#6366F1" : "#E2E8F0"}`,
                    background: wardDept === "all" ? "#EEF2FF" : "#fff",
                    color: wardDept === "all" ? "#4338CA" : "#64748B",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  All Departments ({wards.length})
                </button>
                {departments.map((d) => {
                  const theme = themeForDept(d);
                  const dWards = wards.filter((w) => w.department === d);
                  const dCurrent = dWards.reduce(
                    (sum, w) => sum + (wardStats[w.name]?.current || 0),
                    0
                  );
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
                        padding: "6px 13px",
                        borderRadius: 99,
                        border: `1.5px solid ${isSelected ? theme.accent : "#E2E8F0"}`,
                        background: isSelected ? theme.color : "#fff",
                        color: isSelected ? theme.textColor : "#475569",
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{ width: 7, height: 7, borderRadius: "50%", background: theme.accent }}
                      />
                      <span>{d}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: isSelected ? "#fff" : "#F1F5F9",
                          color: isSelected ? theme.textColor : "#64748B",
                        }}
                      >
                        {dCurrent} placed · {dWards.length}w
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Wards Search & Filter Toolbar */}
            <div className="dashboard-toolbar">
              <div className="dashboard-toolbar-left">
                <div className="dashboard-search-box">
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    style={{
                      position: "absolute",
                      left: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    style={{
                      ...INP,
                      padding: "8px 30px 8px 32px",
                      fontSize: 12.5,
                    }}
                    placeholder="Filter wards or departments…"
                    value={wardSearch}
                    onChange={(e) => setWardSearch(e.target.value)}
                  />
                  {wardSearch && (
                    <button
                      type="button"
                      onClick={() => setWardSearch("")}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#94A3B8",
                        fontSize: 15,
                        cursor: "pointer",
                      }}
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
                    {
                      val: "near_over",
                      label: "Near / Over Cap",
                      count: wardMetrics.nearCapacityWards + wardMetrics.overCapacityWards,
                    },
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
                <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>
                  No wards match your filters
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Try clearing your search or occupancy filter.
                </div>
              </div>
            ) : (
              <div className="dashboard-ward-grid">
                {displayedWards.map((w) => {
                  const st = wardStats[w.name] || {
                    current: 0,
                    upcoming: 0,
                    nursing: 0,
                    midwifery: 0,
                  };
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
                        padding: wardCardDensity === "compact" ? "13px 14px" : "16px 16px 14px",
                        position: "relative",
                        overflow: "hidden",
                        cursor: onNavigateTab ? "pointer" : "default",
                      }}
                    >
                      {/* Top color bar */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3.5,
                          background: theme.accent,
                        }}
                      />

                      {/* Header: Department + Status */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: theme.textColor,
                            background: theme.color,
                            border: `1px solid ${theme.accent}33`,
                            padding: "2px 8px",
                            borderRadius: 99,
                          }}
                        >
                          {w.department}
                        </span>
                        {over ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#9F1239",
                              background: "#FFE4E6",
                              border: "1px solid #FECDD3",
                              padding: "2px 7px",
                              borderRadius: 99,
                            }}
                          >
                            Over Cap
                          </span>
                        ) : pct !== null && pct >= 80 ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#92400E",
                              background: "#FFFBEB",
                              border: "1px solid #FDE68A",
                              padding: "2px 7px",
                              borderRadius: 99,
                            }}
                          >
                            Near Cap
                          </span>
                        ) : st.current > 0 ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#065F46",
                              background: "#ECFDF5",
                              border: "1px solid #A7F3D0",
                              padding: "2px 7px",
                              borderRadius: 99,
                            }}
                          >
                            Active
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#64748B",
                              background: "#F1F5F9",
                              padding: "2px 7px",
                              borderRadius: 99,
                            }}
                          >
                            Empty
                          </span>
                        )}
                      </div>

                      {/* Ward Title & Weeks */}
                      <h4
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: "#0F172A",
                          margin: "10px 0 2px",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {w.name}
                      </h4>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>
                        Nursing {w.nursing_weeks ? `${w.nursing_weeks}w` : "—"} · Midwifery{" "}
                        {w.midwifery_weeks ? `${w.midwifery_weeks}w` : "—"}
                      </div>

                      {/* Occupancy & Progress Meter */}
                      <div style={{ marginTop: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            marginBottom: 5,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                            {st.current}{" "}
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>
                              placed
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: over ? "#E11D48" : pct >= 80 ? "#D97706" : "#64748B",
                            }}
                          >
                            {cap ? `${pct}% of ${cap}` : "No limit"}
                          </span>
                        </div>
                        {cap ? (
                          <div
                            style={{
                              height: 6,
                              background: "#F1F5F9",
                              borderRadius: 99,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                height: "100%",
                                background: over ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981",
                                transition: "width .3s ease",
                              }}
                            />
                          </div>
                        ) : null}
                      </div>

                      {wardCardDensity === "detailed" && (
                        <>
                          {/* Breakdown pill */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 10,
                              fontSize: 11,
                              color: "#64748B",
                              background: "#F8FAFC",
                              borderRadius: 8,
                              padding: "5px 8px",
                            }}
                          >
                            <span>
                              {st.nursing} Nurs · {st.midwifery} Midw
                            </span>
                            {st.upcoming > 0 ? (
                              <span style={{ color: "#4338CA", fontWeight: 700 }}>
                                +{st.upcoming} upcoming
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>0 upcoming</span>
                            )}
                          </div>

                          {/* Supervision Footer */}
                          <div
                            style={{
                              marginTop: 9,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              color: "#475569",
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            {sup.length > 0 ? (
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "#334155",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {sup.map((s) => s.name).join(", ")}
                              </span>
                            ) : (
                              <span style={{ color: "#B45309", fontStyle: "italic", fontSize: 10.5 }}>
                                Unassigned supervisor
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show all wards toggle */}
            {filteredWards.length > 8 &&
              !wardSearch.trim() &&
              wardDept === "all" &&
              wardOcc === "all" && (
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
                      transition: "all 0.15s ease",
                    }}
                  >
                    {showAllWards
                      ? "Show fewer wards ↑"
                      : `Show all ${filteredWards.length} wards (${filteredWards.length - 8} more) ↓`}
                  </button>
                </div>
              )}
          </div>

          {/* Live Member Placements Roster Section */}
          <div ref={rosterSectionRef} className="dashboard-section-card" style={{ marginBottom: 0 }}>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "#EEF2FF",
                        color: "#4338CA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <h3
                      style={{
                        fontSize: 17.5,
                        fontWeight: 800,
                        color: "#0F172A",
                        margin: 0,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Live Member Placements Roster
                    </h3>
                  </div>
                  <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                    Detailed trainee rotation status, placement durations, and immediate reassignment workflows.
                  </p>
                </div>

                {filter !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setPage(1);
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: "1px solid #C7D2FE",
                      background: "#EEF2FF",
                      color: "#4338CA",
                      cursor: "pointer",
                    }}
                  >
                    Clear active filter ({filter.replace("_", " ")}) ×
                  </button>
                )}
              </div>
            </div>

            {/* Filters & Search */}
            <div className="dashboard-toolbar">
              <div className="dashboard-toolbar-left">
                <div className="dashboard-search-box">
                  <svg
                    width="15"
                    height="15"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    style={{
                      ...INP,
                      padding: "9px 32px 9px 36px",
                    }}
                    placeholder="Search trainee, school, or ward…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#94A3B8",
                        fontSize: 16,
                        cursor: "pointer",
                        padding: 2,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <FilterPills
                  value={filter}
                  onChange={(val) => {
                    setFilter(val);
                    setPage(1);
                  }}
                  options={[
                    { val: "all", label: "All", count: counts.all },
                    { val: "unassigned", label: "Unassigned", count: counts.unassigned },
                    { val: "active", label: "Active", count: counts.active },
                    { val: "ending_soon", label: "Ending soon", count: counts.ending_soon },
                    { val: "completed", label: "Completed", count: counts.completed },
                  ]}
                />
              </div>
              <div style={{ fontSize: 12.5, color: "#64748B", fontWeight: 700 }}>
                {filtered.length} {filtered.length === 1 ? "member" : "members"}
              </div>
            </div>

            {/* Table & Mobile Cards Container */}
            <div
              className="table-wrapper"
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid #E2E8F0",
                background: "#fff",
              }}
            >
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "#94A3B8" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>No members found</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {members.length === 0
                      ? "You haven't registered any members yet."
                      : "No members match your current filter and search."}
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop Sortable Table (≥ 768px) */}
                  <div className="desktop-table-view">
                    <div className="table-scroll-wrapper">
                      <table className="responsive-table">
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                            {[
                              { key: "name", label: "Member" },
                              { key: "group", label: "Group" },
                              { key: "ward", label: "Current Ward" },
                              { key: "startDate", label: "Timeline" },
                              { key: "daysLeft", label: "Days Left" },
                              { key: "status", label: "Status" },
                              { key: null, label: "Action" },
                            ].map((col, idx) => (
                              <th
                                key={col.label || idx}
                                className={col.key ? "sortable-th" : ""}
                                onClick={() => col.key && handleSort(col.key)}
                                style={{
                                  textAlign: "left",
                                  padding: "13px 16px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: sortCol === col.key ? "#4338CA" : "#64748B",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  {col.label}
                                  {col.key && sortCol === col.key && (
                                    <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                                  )}
                                </span>
                              </th>
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
                              <tr
                                key={m.id}
                                style={{
                                  background: isCompleted
                                    ? "#FFF1F2"
                                    : isEndingSoon
                                    ? "#FFFBEB"
                                    : i % 2 === 0
                                    ? "#fff"
                                    : "#FAFAFA",
                                  borderBottom: "1px solid #F1F5F9",
                                  transition: "background 0.2s",
                                }}
                                className="hover-row"
                              >
                                <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                    <Avatar name={m.name} group={m.group} size={36} />
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0F172A" }}>
                                        {m.name}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 11.5,
                                          color: "#64748B",
                                          marginTop: 1,
                                          maxWidth: 180,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {m.school}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                                  <GroupBadge group={m.group} />
                                </td>
                                <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                                  {p ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div
                                        style={{
                                          width: 9,
                                          height: 9,
                                          borderRadius: 3,
                                          background: wd?.accent || "#CBD5E1",
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: wd?.textColor || "#334155",
                                          fontSize: 13,
                                        }}
                                      >
                                        {p.ward}
                                      </span>
                                      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                                        ({p.weeks}w)
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#94A3B8", fontSize: 12.5 }}>Unassigned</span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: "14px 16px",
                                    verticalAlign: "middle",
                                    color: "#475569",
                                    fontSize: 12.5,
                                  }}
                                >
                                  {p ? (
                                    <div>
                                      <span style={{ fontWeight: 600 }}>{fmtDate(p.startDate)}</span>
                                      <span style={{ color: "#94A3B8", margin: "0 5px" }}>→</span>
                                      <span>{fmtDate(p.endDate)}</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#94A3B8" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                                  {p ? (
                                    p.daysLeft < 0 ? (
                                      <span style={{ fontWeight: 700, color: "#BE123C", fontSize: 12.5 }}>
                                        {Math.abs(p.daysLeft)}d ago
                                      </span>
                                    ) : p.daysLeft === 0 ? (
                                      <span style={{ fontWeight: 700, color: "#EA580C", fontSize: 12.5 }}>
                                        Today
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: p.daysLeft <= 7 ? "#EA580C" : "#334155",
                                          fontSize: 12.5,
                                        }}
                                      >
                                        {p.daysLeft}d left
                                      </span>
                                    )
                                  ) : (
                                    <span style={{ color: "#94A3B8", fontSize: 12.5 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                                  <StatusChip status={p?.status || "unassigned"} />
                                </td>
                                <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                                  {(isCompleted || !p) && onGoAssign && (
                                    <button
                                      type="button"
                                      onClick={() => onGoAssign(m.id)}
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        borderRadius: 8,
                                        cursor: "pointer",
                                        border: "1.5px solid",
                                        borderColor: isCompleted ? "#FECDD3" : "#C7D2FE",
                                        background: isCompleted ? "#FFF1F2" : "#EEF2FF",
                                        color: isCompleted ? "#BE123C" : "#4338CA",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {isCompleted ? "Reassign →" : "Assign →"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Card View (< 768px) */}
                  <div className="mobile-cards-view">
                    {paginated.map((m) => {
                      const p = m.placement;
                      const wd = p ? WARD_LOOKUP[p.ward] : null;
                      const isCompleted = p?.status === "completed";
                      return (
                        <div key={m.id} className="mobile-roster-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <Avatar name={m.name} group={m.group} size={38} />
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    fontSize: 14,
                                    color: "#0F172A",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {m.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: "#64748B",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {m.school}
                                </div>
                              </div>
                            </div>
                            <StatusChip status={p?.status || "unassigned"} />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                              padding: "10px 12px",
                              background: "#F8FAFC",
                              borderRadius: 10,
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                                Ward & Group
                              </div>
                              <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {p ? (
                                  <span style={{ fontWeight: 700, color: wd?.textColor || "#0F172A" }}>
                                    {p.ward} ({p.weeks}w)
                                  </span>
                                ) : (
                                  <span style={{ color: "#94A3B8" }}>No ward</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                                Schedule
                              </div>
                              <div style={{ marginTop: 3, fontWeight: 600, color: "#334155" }}>
                                {p ? `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}` : "—"}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <GroupBadge group={m.group} />
                              {p && (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: p.daysLeft < 0 ? "#BE123C" : p.daysLeft <= 7 ? "#EA580C" : "#475569",
                                  }}
                                >
                                  {p.daysLeft < 0
                                    ? `${Math.abs(p.daysLeft)}d ago`
                                    : p.daysLeft === 0
                                    ? "Ends today"
                                    : `${p.daysLeft}d remaining`}
                                </span>
                              )}
                            </div>

                            {(isCompleted || !p) && onGoAssign && (
                              <button
                                type="button"
                                onClick={() => onGoAssign(m.id)}
                                style={{
                                  padding: "6px 14px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  border: "1.5px solid",
                                  borderColor: isCompleted ? "#FECDD3" : "#C7D2FE",
                                  background: isCompleted ? "#FFF1F2" : "#EEF2FF",
                                  color: isCompleted ? "#BE123C" : "#4338CA",
                                }}
                              >
                                {isCompleted ? "Reassign →" : "Assign →"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

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
                <div
                  key={l.label}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#64748B" }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: l.dot,
                      display: "inline-block",
                    }}
                  />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardTab;
