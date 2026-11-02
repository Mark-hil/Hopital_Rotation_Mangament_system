import React, { useMemo } from "react";
import { TOTAL_WEEKS } from "../../utils/rotationRules";

export function CohortCompletionTierChart({ members, assignments }) {
  const tiers = useMemo(() => {
    let completed = 0; // 100%
    let advanced = 0; // 75-99%
    let midway = 0; // 25-74%
    let early = 0; // <25%
    let totalPct = 0;

    members.forEach((m) => {
      const wards = assignments.filter((a) => a.memberId === m.id);
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
      ].map((t) => ({
        ...t,
        pct: Math.round((t.count / totalCount) * 100),
      })),
    };
  }, [members, assignments]);

  return (
    <div className="chart-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <h4
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#0F172A",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Cohort Curriculum Progression Funnel
          </h4>
          <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
            Trainee distribution across 52-week clinical competency stages
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#4338CA", lineHeight: 1 }}>
            {tiers.avg}%
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Avg Progress
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {tiers.list.map((t) => (
          <div
            key={t.label}
            style={{
              background: t.bg,
              border: `1px solid ${t.color}33`,
              borderRadius: 12,
              padding: "11px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.count} trainees</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>({t.pct}%)</span>
              </div>
            </div>
            <div
              style={{
                height: 6,
                background: "rgba(0,0,0,0.06)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${t.pct}%`,
                  background: t.color,
                  borderRadius: 99,
                  transition: "width .4s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CohortCompletionTierChart;
