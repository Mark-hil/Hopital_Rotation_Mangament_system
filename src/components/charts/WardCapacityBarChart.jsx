import React, { useState, useMemo } from "react";
import { themeForDept } from "../../constants/wardGroups";

export function WardCapacityBarChart({ wards, wardStats, onSelectWard }) {
  const [sortMode, setSortMode] = useState("occupied"); // "occupied", "pct", "name"

  const sortedWards = useMemo(() => {
    return [...wards].sort((a, b) => {
      const sta = wardStats[a.name] || { current: 0 };
      const stb = wardStats[b.name] || { current: 0 };
      if (sortMode === "occupied") return stb.current - sta.current;
      if (sortMode === "pct") {
        const pcta = a.capacity ? sta.current / a.capacity : 0;
        const pctb = b.capacity ? stb.current / b.capacity : 0;
        return pctb - pcta;
      }
      return a.name.localeCompare(b.name);
    });
  }, [wards, wardStats, sortMode]);

  const maxVal = useMemo(() => {
    return Math.max(
      8,
      ...wards.map((w) => {
        const st = wardStats[w.name] || { current: 0 };
        return Math.max(w.capacity || 0, st.current || 0);
      })
    );
  }, [wards, wardStats]);

  return (
    <div className="chart-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
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
            { id: "name", label: "Name" },
          ].map((s) => (
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
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 400,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {sortedWards.map((w) => {
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
              <div className="chart-bar-ward-col">
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#1E293B",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {w.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: theme.textColor,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 1,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent }} />
                  <span>{w.department}</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: 18,
                  background: "#F1F5F9",
                  borderRadius: 6,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                }}
              >
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
                    transition: "width 0.4s ease",
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
                      zIndex: 2,
                    }}
                    title={`Capacity limit: ${cap}`}
                  />
                )}
              </div>

              {/* Metrics Right */}
              <div style={{ width: 95, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 700 }}>
                <span
                  style={{
                    color: over ? "#BE123C" : pct >= 80 ? "#B45309" : current > 0 ? "#047857" : "#94A3B8",
                  }}
                >
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #F1F5F9",
          paddingTop: 12,
          marginTop: 14,
          fontSize: 11,
          color: "#64748B",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
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

export default WardCapacityBarChart;
