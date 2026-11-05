import React from "react";

export function StatCard({
  title,
  icon,
  value,
  unit,
  subtitle,
  badge,
  accentColor = "#6366F1",
  iconBg = "#EEF2FF",
  textColor = "#0F172A",
  progressPct = null,
  active = false,
  onClick,
}) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`stat-metric-card ${onClick ? "is-interactive" : ""} ${active ? "is-active" : ""}`}
      style={{
        "--color-primary": accentColor,
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: accentColor,
        }}
      />

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                lineHeight: 1.3,
              }}
            >
              {title}
            </div>
            {badge && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 99,
                  background: iconBg,
                  color: accentColor,
                }}
              >
                {badge}
              </span>
            )}
          </div>

          {icon && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: iconBg,
                color: accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 18,
              }}
            >
              {icon}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </div>
          {unit && (
            <span style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>
              {unit}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {progressPct !== null && (
          <div
            style={{
              height: 5,
              background: "#F1F5F9",
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
                height: "100%",
                background: accentColor,
                borderRadius: 99,
                transition: "width 0.35s ease",
              }}
            />
          </div>
        )}

        {subtitle && (
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "#64748B",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <span style={{ color: accentColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {subtitle}
            </span>
            {onClick && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: active ? accentColor : "#94A3B8",
                  flexShrink: 0,
                }}
              >
                {active ? "Filtered ✓" : "View →"}
              </span>
            )}
          </div>
        )}
      </div>
    </Tag>
  );
}

export default StatCard;
