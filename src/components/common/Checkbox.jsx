import React from "react";

export function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        border: checked || indeterminate ? "2px solid #6366F1" : "2px solid #CBD5E1",
        background: checked ? "#6366F1" : indeterminate ? "#6366F1" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        transition: "all .12s",
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1.5 5l2.5 2.5 4.5-4.5"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {indeterminate && !checked && (
        <div style={{ width: 8, height: 2, background: "#fff", borderRadius: 1 }} />
      )}
    </div>
  );
}

export default Checkbox;
