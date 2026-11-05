import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { DEFAULT_WARD_ROWS, themeForDept } from "../../constants/wardGroups";
import { TOTAL_WEEKS, assignmentStatus, ACTIVE_STATUSES } from "../../utils/rotationRules";
import FilterPills from "../../components/common/FilterPills";
import StatCard from "../dashboard/StatCard";
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
    <div className="dashboard-container fadeIn">
      {/* Header & Print Actions */}
      <div className="dashboard-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 className="dashboard-title-text">Clinical Analytics & Executive Reports</h2>
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
                padding: "3px 10px",
                borderRadius: 99,
              }}
            >
              Executive Visualizations
            </span>
          </div>
          <p style={{ fontSize: 13.5, color: "#64748B", marginTop: 6, maxWidth: 650 }}>
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
              gap: 7,
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
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid">
        <StatCard
          title="Hospital Occupancy"
          value={`${occupancyPct}%`}
          badge="Monitored Beds"
          subtitle={`${monitoredPlaced} / ${totalCapacity || "—"} monitored bed capacity`}
          accentColor="#6366F1"
          iconBg="#EEF2FF"
          textColor="#3730A3"
          progressPct={occupancyPct}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
        />

        <StatCard
          title="Active Trainee Load"
          value={totalPlaced}
          badge="Placed in Wards"
          subtitle={`Across ${wards.filter((w) => (wardStats[w.name]?.current || 0) > 0).length} active hospital wards`}
          accentColor="#10B981"
          iconBg="#ECFDF5"
          textColor="#065F46"
          progressPct={filteredMembers.length > 0 ? Math.round((totalPlaced / filteredMembers.length) * 100) : 0}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />

        <StatCard
          title="Avg Cohort Progress"
          value={`${avgCohortProgress}%`}
          badge="52-Week Curriculum"
          subtitle={`${totalWeeksDelivered} cumulative training weeks logged`}
          accentColor="#F59E0B"
          iconBg="#FFFBEB"
          textColor="#92400E"
          progressPct={avgCohortProgress}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />

        <StatCard
          title="Clinical Oversight"
          value={`${supervisedPct}%`}
          badge="In-Charge Coverage"
          subtitle={`${supervisedCount} of ${wards.length} wards assigned supervisors`}
          accentColor="#0EA5E9"
          iconBg="#E0F2FE"
          textColor="#0369A1"
          progressPct={supervisedPct}
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
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
        className="table-wrapper"
        style={{
          marginTop: 12,
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
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

        {/* Desktop Table */}
        <div className="desktop-table-view">
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

        {/* Mobile Cards View (< 768px) */}
        <div className="mobile-cards-view">
          {wards.map((w) => {
            const st = wardStats[w.name] || { current: 0, nursing: 0, midwifery: 0 };
            const theme = themeForDept(w.department);
            const sups = supervisorsFor(w.name);
            const cap = w.capacity;
            const over = cap && st.current > cap;
            const pct = cap ? Math.round((st.current / cap) * 100) : null;
            return (
              <div key={w.id || w.name} className="mobile-roster-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>{w.name}</div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 3,
                        fontSize: 10,
                        fontWeight: 700,
                        color: theme.textColor,
                        background: theme.color,
                        padding: "1px 7px",
                        borderRadius: 99,
                      }}
                    >
                      {w.department}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: over ? "#BE123C" : "#0F172A" }}>
                      {st.current} / {cap || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      {st.nursing}N · {st.midwifery}M
                    </div>
                  </div>
                </div>
                {cap && (
                  <div style={{ height: 5, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        height: "100%",
                        background: over ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981",
                      }}
                    />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#64748B" }}>
                  <span>
                    Supervisor:{" "}
                    <strong style={{ color: "#334155" }}>
                      {sups.length > 0 ? sups.map((s) => s.name).join(", ") : "Unsupervised"}
                    </strong>
                  </span>
                  {pct !== null && <span style={{ fontWeight: 700 }}>{pct}% full</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsReportTab;
