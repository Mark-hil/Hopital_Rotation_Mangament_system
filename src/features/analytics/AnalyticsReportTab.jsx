import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { DEFAULT_WARD_ROWS, themeForDept } from "../../constants/wardGroups";
import { TOTAL_WEEKS, assignmentStatus, ACTIVE_STATUSES } from "../../utils/rotationRules";
import FilterPills from "../../components/common/FilterPills";
import WardCapacityBarChart from "../../components/charts/WardCapacityBarChart";
import DepartmentDistributionDonut from "../../components/charts/DepartmentDistributionDonut";
import CohortCompletionTierChart from "../../components/charts/CohortCompletionTierChart";
import DisciplineComparisonWidget from "../../components/charts/DisciplineComparisonWidget";

export function AnalyticsReportTab({ members, assignments, wardRows, onNavigateTab }) {
  const [filterGroup, setFilterGroup] = useState("all");
  const wards = useMemo(() => wardRows || DEFAULT_WARD_ROWS, [wardRows]);
  const departments = useMemo(() => [...new Set(wards.map((w) => w.department))], [wards]);

  // Supervisors sync with offline caching
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
          console.warn("Offline or network issue fetching incharges in analytics:", err?.message || err);
        });
    };

    loadIncharges();

    const handleOnline = () => {
      loadIncharges();
    };
    window.addEventListener("online", handleOnline);

    const ch = supabase
      .channel("analytics_incharges_sync")
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

  const filteredMembers = useMemo(() => {
    if (filterGroup === "all") return members;
    return members.filter((m) => m.group === filterGroup);
  }, [members, filterGroup]);

  const filteredAssignments = useMemo(() => {
    if (filterGroup === "all") return assignments;
    const memberIds = new Set(filteredMembers.map((m) => m.id));
    return assignments.filter((a) => memberIds.has(a.memberId));
  }, [assignments, filteredMembers, filterGroup]);

  const wardStats = useMemo(() => {
    const s = {};
    wards.forEach((w) => {
      s[w.name] = { current: 0, upcoming: 0, completed: 0, nursing: 0, midwifery: 0 };
    });
    filteredAssignments.forEach((a) => {
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
  }, [wards, filteredAssignments]);

  const totalPlaced = Object.values(wardStats).reduce((sum, v) => sum + v.current, 0);
  const totalCapacity = wards.filter((w) => w.capacity).reduce((sum, w) => sum + w.capacity, 0);
  const monitoredPlaced = wards
    .filter((w) => w.capacity)
    .reduce((sum, w) => sum + (wardStats[w.name]?.current || 0), 0);
  const occupancyPct = totalCapacity > 0 ? Math.round((monitoredPlaced / totalCapacity) * 100) : 0;
  const supervisedCount = wards.filter((w) => supervisorsFor(w.name).length > 0).length;
  const supervisedPct = wards.length > 0 ? Math.round((supervisedCount / wards.length) * 100) : 0;

  let totalPctSum = 0;
  let totalWeeksDelivered = 0;
  filteredMembers.forEach((m) => {
    const mAssignments = filteredAssignments.filter((a) => a.memberId === m.id);
    const done = mAssignments.reduce((s, a) => s + a.weeks, 0);
    totalWeeksDelivered += done;
    const total = TOTAL_WEEKS[m.group] || 52;
    totalPctSum += Math.min(100, Math.round((done / total) * 100));
  });
  const avgCohortProgress = filteredMembers.length
    ? Math.round(totalPctSum / filteredMembers.length)
    : 0;

  return (
    <div>
      {/* Header & Print Actions */}
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
              Clinical Analytics & Reports
            </h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: "#4338CA",
                background: "#EEF2FF",
                border: "1px solid #C7D2FE",
                padding: "2px 9px",
                borderRadius: 99,
              }}
            >
              📊 Executive Visualizations
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 5, maxWidth: 650 }}>
            Visual hospital rotation metrics, ward occupancy benchmarks, and clinical competency
            progression reports.
          </p>
        </div>

        <div
          className="print-hide"
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          <FilterPills
            value={filterGroup}
            onChange={setFilterGroup}
            options={[
              { val: "all", label: "All Disciplines", count: members.length },
              {
                val: "nursing",
                label: "Nursing",
                count: members.filter((m) => m.group === "nursing").length,
              },
              {
                val: "midwifery",
                label: "Midwifery",
                count: members.filter((m) => m.group === "midwifery").length,
              },
            ]}
          />
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 15px",
              background: "#0F172A",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(15,23,42,0.2)",
            }}
          >
            <span>🖨️</span>
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div
          className="premium-card"
          style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#6366F1" }} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Hospital Occupancy
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#3730A3", lineHeight: 1 }}>
            {occupancyPct}%
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", marginTop: 8 }}>
            {monitoredPlaced} / {totalCapacity || "—"} monitored bed capacity
          </div>
        </div>

        <div
          className="premium-card"
          style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#10B981" }} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Active Trainee Load
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#065F46", lineHeight: 1 }}>
            {totalPlaced}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#059669", marginTop: 8 }}>
            Across {wards.filter((w) => (wardStats[w.name]?.current || 0) > 0).length} active hospital wards
          </div>
        </div>

        <div
          className="premium-card"
          style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#F59E0B" }} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Avg Cohort Progress
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#92400E", lineHeight: 1 }}>
            {avgCohortProgress}%
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#B45309", marginTop: 8 }}>
            {totalWeeksDelivered} cumulative training weeks logged
          </div>
        </div>

        <div
          className="premium-card"
          style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#0EA5E9" }} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Clinical Oversight
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#0369A1", lineHeight: 1 }}>
            {supervisedPct}%
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0284C7", marginTop: 8 }}>
            {supervisedCount} of {wards.length} wards assigned supervisors
          </div>
        </div>
      </div>

      {/* Visual Chart Grid */}
      <div className="analytics-grid">
        <WardCapacityBarChart
          wards={wards}
          wardStats={wardStats}
          onSelectWard={() => onNavigateTab && onNavigateTab("wards")}
        />
        <DepartmentDistributionDonut departments={departments} wards={wards} wardStats={wardStats} />
      </div>

      <div className="analytics-grid">
        <CohortCompletionTierChart members={filteredMembers} assignments={filteredAssignments} />
        <DisciplineComparisonWidget members={members} assignments={assignments} />
      </div>

      {/* Executive Ward Allocation Summary Table */}
      <div
        style={{
          marginTop: 12,
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Hospital Ward Allocation & Status Matrix
            </h4>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
              Official clinical review of ward placements, supervisor coverage, and capacity status.
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              background: "#F1F5F9",
              padding: "4px 10px",
              borderRadius: 99,
            }}
          >
            {wards.length} Monitored Units
          </span>
        </div>

        <div className="table-scroll-wrapper">
          <table className="responsive-table">
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                {[
                  "Ward",
                  "Department",
                  "Supervisors",
                  "Placed / Cap",
                  "Occupancy %",
                  "Discipline Split",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 18px",
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
              {wards.map((w, i) => {
                const st = wardStats[w.name] || { current: 0, nursing: 0, midwifery: 0 };
                const theme = themeForDept(w.department);
                const sups = supervisorsFor(w.name);
                const cap = w.capacity;
                const over = cap && st.current > cap;
                const pct = cap ? Math.round((st.current / cap) * 100) : null;
                return (
                  <tr
                    key={w.id || w.name}
                    className="hover-row"
                    style={{ background: i % 2 ? "#FAFAFC" : "#fff", borderBottom: "1px solid #F1F5F9" }}
                  >
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                      {w.name}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          fontSize: 10.5,
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
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12 }}>
                      {sups.length > 0 ? (
                        <span style={{ fontWeight: 600, color: "#334155" }}>
                          {sups.map((s) => s.name).join(", ")}
                        </span>
                      ) : (
                        <span style={{ color: "#B45309", fontStyle: "italic", fontSize: 11 }}>
                          Unsupervised
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "14px 18px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: over ? "#BE123C" : pct >= 80 ? "#B45309" : "#1E293B",
                      }}
                    >
                      {st.current} / {cap || "—"}
                    </td>
                    <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      {cap ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
                          <div
                            style={{
                              flex: 1,
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
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: over ? "#E11D48" : "#475569",
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#94A3B8", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#64748B" }}>
                      {st.nursing} Nurs · {st.midwifery} Midw
                    </td>
                    <td style={{ padding: "14px 18px" }}>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsReportTab;
