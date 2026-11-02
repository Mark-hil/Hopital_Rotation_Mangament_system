import React from "react";

export function FilterPills({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(({ val, label, count }) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          style={{
            padding: "6px 13px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 99,
            cursor: "pointer",
            border: "1.5px solid",
            borderColor: value === val ? "#6366F1" : "#E2E8F0",
            background: value === val ? "#EEF2FF" : "#fff",
            color: value === val ? "#4338CA" : "#64748B",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {label}
          {count != null && (
            <span
              style={{
                background: value === val ? "#6366F1" : "#E2E8F0",
                color: value === val ? "#fff" : "#64748B",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 99,
              }}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default FilterPills;
