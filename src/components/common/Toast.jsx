import React from "react";

export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1E293B",
        color: "#fff",
        padding: "12px 24px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        zIndex: 999,
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "#4ADE80" }}>✓</span>
      {msg}
    </div>
  );
}

export default Toast;
