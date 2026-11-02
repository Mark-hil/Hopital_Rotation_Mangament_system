import React from "react";
import { initials } from "../../utils/formatters";

export default function Avatar({ name = "", group = "nursing", size = 36 }) {
  const cfg = {
    nursing: { bg: "#EEF2FF", c: "#4338CA" },
    midwifery: { bg: "#F0FDF4", c: "#166534" },
  };
  const { bg, c } = cfg[group] || cfg.nursing;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: c,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(10, Math.round(size * 0.34)),
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
        border: "1.5px solid rgba(255, 255, 255, 0.8)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}
    >
      {initials(name)}
    </div>
  );
}
