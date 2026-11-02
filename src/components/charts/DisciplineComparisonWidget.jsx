import React, { useMemo } from "react";
import { getLatestPlacement } from "../../utils/rotationRules";

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
        <h4
          style={{
            fontSize: 16,
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
        <div
          style={{
            background: "#EEF2FF",
            border: "1px solid #C7D2FE",
            borderRadius: 14,
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "#3730A3" }}>Nursing</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#4338CA",
                background: "#fff",
                padding: "2px 8px",
                borderRadius: 99,
              }}
            >
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

        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 14,
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>Midwifery</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#15803D",
                background: "#fff",
                padding: "2px 8px",
                borderRadius: 99,
              }}
            >
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

export default DisciplineComparisonWidget;
