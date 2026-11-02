import React from "react";

export function StatCard({ title, icon, value, subtitle, accentColor = "#6366F1", textColor }) {
  return (
    <div
      className="premium-card"
      style={{
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: accentColor }} />
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
          {title}
        </div>
        {icon && <div style={{ fontSize: 20 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: textColor || "#0F172A", lineHeight: 1 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, fontWeight: 600, color: accentColor, marginTop: 8 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default StatCard;
