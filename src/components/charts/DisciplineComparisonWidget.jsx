import React, { useMemo } from "react";
import { getLatestPlacement, TOTAL_WEEKS } from "../../utils/rotationRules";

export function DisciplineComparisonWidget({ members, assignments }) {
  const stats = useMemo(() => {
    const calc = (grp) => {
      const list = members.filter((m) => m.group === grp);
      const active = list.filter((m) => {
        const p = getLatestPlacement(m.id, assignments);
        return p?.status === "active";
      }).length;
      const unassigned = list.filter((m) => !getLatestPlacement(m.id, assignments)).length;
      let totalDone = 0;
      list.forEach((m) => {
        const wards = assignments.filter((a) => a.memberId === m.id);
        totalDone += wards.reduce((s, a) => s + a.weeks, 0);
      });
      const targetWeeks = TOTAL_WEEKS[grp] || 52;
      const avgWeeks = list.length ? Math.round(totalDone / list.length) : 0;
      const avgPct = Math.min(100, Math.round((avgWeeks / targetWeeks) * 100));
      return { total: list.length, active, unassigned, avgWeeks, targetWeeks, avgPct };
    };
    return {
      nursing: calc("nursing"),
      midwifery: calc("midwifery"),
    };
  }, [members, assignments]);

  const cohorts = [
    {
      key: "nursing",
      title: "Nursing Cohort",
      data: stats.nursing,
      bg: "#EEF2FF",
      border: "#C7D2FE",
      titleColor: "#3730A3",
      badgeColor: "#4338CA",
      barColor: "#6366F1",
    },
    {
      key: "midwifery",
      title: "Midwifery Cohort",
      data: stats.midwifery,
      bg: "#F0FDF4",
      border: "#BBF7D0",
      titleColor: "#166534",
      badgeColor: "#15803D",
      barColor: "#10B981",
    },
  ];

  return (
    <div className="chart-card">
      <div style={{ marginBottom: 16 }}>
        <h4
          style={{
            fontSize: 15.5,
            fontWeight: 800,
            color: "#0F172A",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Discipline Breakdown & Benchmarks
        </h4>
        <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
          Comparative rotation status between Nursing and Midwifery cohorts
        </p>
      </div>

      <div className="discipline-grid">
        {cohorts.map((c) => (
          <div
            key={c.key}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: "15px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 800, color: c.titleColor }}>{c.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.badgeColor,
                    background: "#fff",
                    padding: "2px 8px",
                    borderRadius: 99,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  {c.data.total} {c.data.total === 1 ? "Member" : "Members"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#475569", fontWeight: 500 }}>Active in Wards</span>
                  <span style={{ fontWeight: 800, color: "#059669" }}>{c.data.active}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#475569", fontWeight: 500 }}>Unassigned</span>
                  <span style={{ fontWeight: 800, color: "#D97706" }}>{c.data.unassigned}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#475569", fontWeight: 500 }}>Avg Weeks Done</span>
                  <span style={{ fontWeight: 800, color: c.titleColor }}>
                    {c.data.avgWeeks} / {c.data.targetWeeks}w ({c.data.avgPct}%)
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 6,
                  background: "rgba(255, 255, 255, 0.75)",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${c.data.avgPct}%`,
                    background: c.barColor,
                    borderRadius: 99,
                    transition: "width 0.35s ease",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DisciplineComparisonWidget;
