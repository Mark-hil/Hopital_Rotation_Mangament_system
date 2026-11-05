import React, { useState, useMemo } from "react";
import { themeForDept } from "../../constants/wardGroups";

export function DepartmentDistributionDonut({ departments, wards, wardStats }) {
  const [hoveredDept, setHoveredDept] = useState(null);

  const deptData = useMemo(() => {
    let totalPlacements = 0;
    const items = departments.map((d) => {
      const dWards = wards.filter((w) => w.department === d);
      const count = dWards.reduce((sum, w) => sum + (wardStats[w.name]?.current || 0), 0);
      totalPlacements += count;
      const theme = themeForDept(d);
      return { dept: d, count, wardsCount: dWards.length, theme };
    });

    const withPct = items
      .map((item) => ({
        ...item,
        pct: totalPlacements > 0 ? item.count / totalPlacements : 0,
        pctInt: totalPlacements > 0 ? Math.round((item.count / totalPlacements) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { total: totalPlacements, items: withPct };
  }, [departments, wards, wardStats]);

  // SVG Donut calculations
  const size = 176;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const segments = deptData.items.map((item) => {
    const strokeDasharray = `${item.pct * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += item.pct * circumference;
    return { ...item, strokeDasharray, strokeDashoffset };
  });

  const activeItem = hoveredDept ? deptData.items.find((i) => i.dept === hoveredDept) : null;

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
          Departmental Trainee Distribution
        </h4>
        <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
          Allocation share of active rotations across hospital departments
        </p>
      </div>

      <div className="donut-layout">
        {/* SVG Donut */}
        <div className="donut-svg-wrap" style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {deptData.total > 0 &&
              segments.map((seg) => (
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
                    opacity: hoveredDept && hoveredDept !== seg.dept ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setHoveredDept(seg.dept)}
                  onMouseLeave={() => setHoveredDept(null)}
                />
              ))}
          </svg>

          {/* Center text */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
              {activeItem ? activeItem.count : deptData.total}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: activeItem ? activeItem.theme.textColor : "#64748B",
                marginTop: 3,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                textAlign: "center",
                maxWidth: 100,
              }}
            >
              {activeItem ? activeItem.dept : "Total Placed"}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170, flex: 1 }}>
          {deptData.items.map((item) => {
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
                  padding: "5px 9px",
                  borderRadius: 8,
                  background: isHovered ? item.theme.color : "#F8FAFC",
                  border: `1px solid ${isHovered ? item.theme.accent + "40" : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: item.theme.accent,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1E293B",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.dept}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{item.count}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: item.theme.textColor,
                      background: item.theme.color,
                      padding: "1px 6px",
                      borderRadius: 99,
                      minWidth: 36,
                      textAlign: "center",
                    }}
                  >
                    {item.pctInt}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DepartmentDistributionDonut;
