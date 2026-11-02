import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { DEFAULT_WARD_ROWS, WARD_LOOKUP, themeForDept } from "../../constants/wardGroups";
import { assignmentStatus, ACTIVE_STATUSES, getLatestPlacement } from "../../utils/rotationRules";
import { fmtDate } from "../../utils/dates";
import Avatar from "../../components/common/Avatar";
import { GroupBadge, StatusChip } from "../../components/common/Badge";
import Pagination from "../../components/common/Pagination";
import FilterPills from "../../components/common/FilterPills";
import WardCapacityBarChart from "../../components/charts/WardCapacityBarChart";
import DepartmentDistributionDonut from "../../components/charts/DepartmentDistributionDonut";
import CohortCompletionTierChart from "../../components/charts/CohortCompletionTierChart";
import DisciplineComparisonWidget from "../../components/charts/DisciplineComparisonWidget";
import AnalyticsReportTab from "../analytics/AnalyticsReportTab";

const INP = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  background: "#F8FAFC",
  color: "#0F172A",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export function DashboardTab({ members, assignments, wardRows, onNavigateTab, onGoAssign }) {
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
    supabase
      .from("incharges")
      .select("id, name, email, phone, wards")
      .then(({ data }) => {
        if (data) setIncharges(data);
      });
    const ch = supabase
      .channel("dashboard_incharges_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, () => {
        supabase
          .from("incharges")
          .select("id, name, email, phone, wards")
          .then(({ data }) => {
            if (data) setIncharges(data);
          });
      })
      .subscribe();
    return () => {
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

  const filtered = enriched.filter((m) => {
    const sm =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.school.toLowerCase().includes(search.toLowerCase());
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 26,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#0F172A",
                margin: 0,
              }}
            >
              Clinical Rotation Dashboard
            </h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: "#166534",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                padding: "2px 9px",
                borderRadius: 99,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
              Live Hospital View
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 5, maxWidth: 640 }}>
            Live command center for hospital ward occupancy, departmental trainee capacity, and individual rotation timelines.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              padding: 3,
              background: "#F1F5F9",
              borderRadius: 10,
              border: "1px solid #E2E8F0",
            }}
          >
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
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#1E293B",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <span>🏥</span>
                <span>Wards Directory</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab("assign")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "#6366F1",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
                }}
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
            <div
              className="premium-card"
              style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#10B981" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Active Rotations
                </div>
                <div style={{ fontSize: 20 }}>🏥</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#065F46", lineHeight: 1 }}>
                {counts.active}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#059669",
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>
                  {nursingActive} Nursing · {midwiferyActive} Midwifery
                </span>
              </div>
            </div>

            <div
              className="premium-card"
              style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#6366F1" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Ward Utilization
                </div>
                <div style={{ fontSize: 20 }}>🛏️</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#3730A3", lineHeight: 1 }}>
                {wardMetrics.occupiedWards}{" "}
                <span style={{ fontSize: 18, fontWeight: 600, color: "#94A3B8" }}>
                  / {wardMetrics.totalWards}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", marginTop: 8 }}>
                {wardMetrics.totalCapacity
                  ? `${wardMetrics.overallOccupancyPct}% capacity (${wardMetrics.monitoredPlaced}/${wardMetrics.totalCapacity} spots)`
                  : `${wardMetrics.occupiedWards} occupied · ${wardMetrics.emptyWards} empty`}
              </div>
            </div>

            <div
              className="premium-card"
              style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#F59E0B" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Unassigned Trainees
                </div>
                <div style={{ fontSize: 20 }}>👥</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#92400E", lineHeight: 1 }}>
                {counts.unassigned}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#B45309", marginTop: 8 }}>
                {counts.ending_soon > 0
                  ? `${counts.ending_soon} placement${counts.ending_soon === 1 ? "" : "s"} ending within 7d`
                  : `${counts.all} total registered members`}
              </div>
            </div>

            <div
              className="premium-card"
              style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#F43F5E" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Completed — Ready
                </div>
                <div style={{ fontSize: 20 }}>✅</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#BE123C", lineHeight: 1 }}>
                {counts.completed}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: counts.completed > 0 ? "#E11D48" : "#94A3B8",
                  marginTop: 8,
                }}
              >
                {counts.completed > 0 ? "Awaiting next ward assignment" : "All members assigned"}
              </div>
            </div>
          </div>

          {/* Alert banner */}
          {counts.completed > 0 && (
            <div
              style={{
                background: "#FFF1F2",
                border: "1px solid #FECDD3",
                borderRadius: 16,
                padding: "16px 20px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 16,
                boxShadow: "0 4px 12px rgba(244,63,94,0.05)",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "#FFE4E6",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                🔔
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#BE123C" }}>
                  {counts.completed} member{counts.completed > 1 ? "s" : ""} have completed their placement and need reassignment
                </div>
                <div style={{ fontSize: 13, color: "#9F1239", marginTop: 2 }}>
                  Click the button to immediately select all completed members and assign their next ward.
                </div>
              </div>
              <button
                onClick={() => onGoAssign(completedIds)}
                style={{
                  padding: "10px 18px",
                  background: "#BE123C",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s",
                  boxShadow: "0 4px 12px rgba(190,18,60,0.3)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#9F1239")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#BE123C")}
              >
                Reassign all {counts.completed} →
              </button>
            </div>
          )}

          {/* Hospital Rotation Analytics & Visualizations Panel */}
          <div
            style={{
              marginBottom: 36,
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 18,
              padding: "22px 24px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20 }}>📊</span>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#0F172A",
                      margin: 0,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Hospital Clinical Graphics & Analytics
                  </h3>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
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
                    transition: "all 0.15s ease",
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
                    boxShadow: "0 2px 6px rgba(15,23,42,0.15)",
                  }}
                >
                  <span>Full Executive Report</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* Primary 2-column Visual Chart Grid */}
            <div className="analytics-grid" style={{ marginBottom: showCohortCharts ? 16 : 0 }}>
              <WardCapacityBarChart
                wards={wards}
                wardStats={wardStats}
                onSelectWard={() => onNavigateTab && onNavigateTab("wards")}
              />
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
          <div
            style={{
              marginBottom: 36,
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 18,
              padding: "22px 24px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
            }}
          >
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
                  <span style={{ fontSize: 18 }}>🏥</span>
                  <h3
                    style={{
                      fontSize: 17,
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
                      ⚠️ {wardMetrics.overCapacityWards} Over Capacity
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
                  Live bed capacity tracking, trainee distribution by discipline, and clinical supervision across all hospital units.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "inline-flex",
                    padding: 3,
                    background: "#F1F5F9",
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                  }}
                >
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
                      transition: "all 0.15s ease",
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
                      transition: "all 0.15s ease",
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
                      transition: "all 0.15s ease",
                    }}
                  >
                    🍩 Department Share
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
                    <span>Wards Table</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            </div>

            {wardViewMode === "chart" ? (
              <WardCapacityBarChart
                wards={wards}
                wardStats={wardStats}
                onSelectWard={() => onNavigateTab && onNavigateTab("wards")}
              />
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
                        whiteSpace: "nowrap",
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
                            padding: "5px 12px",
                            borderRadius: 99,
                            border: `1.5px solid ${isSelected ? theme.accent : "#E2E8F0"}`,
                            background: isSelected ? theme.color : "#fff",
                            color: isSelected ? theme.textColor : "#475569",
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease",
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
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 16,
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                    <div style={{ position: "relative", minWidth: 200, maxWidth: 260 }}>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        style={{
                          position: "absolute",
                          left: 10,
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
                          paddingLeft: 32,
                          padding: "8px 12px 8px 32px",
                          fontSize: 12.5,
                          background: "#fff",
                          borderRadius: 10,
                        }}
                        placeholder="Filter wards…"
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
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏥</div>
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
                            padding: "16px 16px 14px",
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
                            <span style={{ fontSize: 12 }}>🩺</span>
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
                          ? "Show less ↑"
                          : `Show all ${filteredWards.length} wards (${filteredWards.length - 8} more) ↓`}
                      </button>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Member Placements Roster Section Header */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0F172A",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Live Member Placements Roster
                </h3>
                <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                  Detailed trainee rotation status, placement durations, and upcoming reassignment workflows.
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
              <div style={{ position: "relative", minWidth: 220, maxWidth: 280 }}>
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
                    paddingLeft: 36,
                    paddingRight: search ? 30 : 12,
                    padding: "9px 12px 9px 36px",
                    background: "#fff",
                    borderRadius: 10,
                  }}
                  placeholder="Search member or school…"
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
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
            <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
              {filtered.length} {filtered.length === 1 ? "member" : "members"}
            </div>
          </div>

          {/* Table */}
          <div
            className="table-wrapper"
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              background: "#fff",
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members found</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {members.length === 0
                    ? "You haven't registered any members yet."
                    : "No members match your current filter and search."}
                </div>
              </div>
            ) : (
              <>
                <div className="table-scroll-wrapper">
                  <table className="responsive-table">
                    <thead>
                      <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                        {[
                          "Member",
                          "Group",
                          "Current ward",
                          "Started",
                          "Ends",
                          "Days left",
                          "Status",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "14px 18px",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#64748B",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {h}
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
                            <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <Avatar name={m.name} group={m.group} size={36} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>
                                    {m.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#64748B",
                                      marginTop: 2,
                                      maxWidth: 160,
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
                            <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                              <GroupBadge group={m.group} />
                            </td>
                            <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                              {p ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: 3,
                                      background: wd?.accent || "#CBD5E1",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: wd?.textColor || "#334155",
                                      fontSize: 13,
                                    }}
                                  >
                                    {p.ward}
                                  </span>
                                  <span style={{ fontSize: 11, color: "#94A3B8" }}>({p.weeks}w)</span>
                                </div>
                              ) : (
                                <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "16px 18px",
                                verticalAlign: "middle",
                                color: "#64748B",
                                fontSize: 13,
                              }}
                            >
                              {p ? fmtDate(p.startDate) : "—"}
                            </td>
                            <td
                              style={{
                                padding: "16px 18px",
                                verticalAlign: "middle",
                                color: "#64748B",
                                fontSize: 13,
                              }}
                            >
                              {p ? fmtDate(p.endDate) : "—"}
                            </td>
                            <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                              {p ? (
                                p.daysLeft < 0 ? (
                                  <span style={{ fontWeight: 700, color: "#BE123C", fontSize: 13 }}>
                                    {Math.abs(p.daysLeft)}d ago
                                  </span>
                                ) : p.daysLeft === 0 ? (
                                  <span style={{ fontWeight: 700, color: "#EA580C", fontSize: 13 }}>
                                    Today
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: p.daysLeft <= 7 ? "#EA580C" : "#334155",
                                      fontSize: 13,
                                    }}
                                  >
                                    {p.daysLeft}d
                                  </span>
                                )
                              ) : (
                                <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                              <StatusChip status={p?.status || "unassigned"} />
                            </td>
                            <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                              {(isCompleted || !p) && onGoAssign && (
                                <button
                                  onClick={() => onGoAssign(m.id)}
                                  style={{
                                    padding: "5px 12px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    border: "1.5px solid",
                                    borderColor: isCompleted ? "#FECDD3" : "#E2E8F0",
                                    background: isCompleted ? "#FFF1F2" : "#F8FAFC",
                                    color: isCompleted ? "#BE123C" : "#64748B",
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
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748B" }}
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
        </>
      )}
    </div>
  );
}

export default DashboardTab;
