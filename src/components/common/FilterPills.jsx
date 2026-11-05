import React from "react";

export function FilterPills({ value, onChange, options }) {
  return (
    <div className="filter-pills-container">
      {options.map(({ val, label, count }) => {
        const isSelected = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            style={{
              padding: "6px 13px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 99,
              cursor: "pointer",
              border: "1.5px solid",
              borderColor: isSelected ? "#6366F1" : "#E2E8F0",
              background: isSelected ? "#EEF2FF" : "#fff",
              color: isSelected ? "#4338CA" : "#64748B",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            <span>{label}</span>
            {count != null && (
              <span
                style={{
                  background: isSelected ? "#6366F1" : "#F1F5F9",
                  color: isSelected ? "#fff" : "#64748B",
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6.5px",
                  borderRadius: 99,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FilterPills;
