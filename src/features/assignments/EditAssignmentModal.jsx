import React, { useState } from "react";
import { WARD_GROUPS } from "../../constants/wardGroups";
import { weeksFor } from "../../utils/rotationRules";
import { addWeeks } from "../../utils/dates";

const INP = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  background: "#F8FAFC",
  color: "#0F172A",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const LS = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#94A3B8",
  marginBottom: 6,
  letterSpacing: "0.05em",
};

export default function EditAssignmentModal({ assignment, onSave, onDelete, onCancel }) {
  const [ward, setWard] = useState(assignment.ward);
  const [startDate, setStartDate] = useState(assignment.startDate);
  const [weeks, setWeeks] = useState(assignment.weeks);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div className="premium-card" style={{ padding: 24, borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0F172A" }}>Edit Assignment</h3>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B", fontSize: 16 }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>Change the ward, start date, or duration.</p>
        
        <div style={{ marginBottom: 16 }}>
          <label style={LS}>MEMBER</label>
          <div style={{ fontSize: 14, fontWeight: 600, padding: "10px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", color: "#0F172A" }}>
            {assignment.memberName || "Member"}
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={LS}>WARD</label>
          <select 
            style={{ ...INP }}
            value={ward}
            onChange={(e) => {
              const w = e.target.value;
              setWard(w);
              setWeeks(weeksFor(assignment.group, w));
            }}
          >
            {WARD_GROUPS.map(g => {
              const validWards = g.wards.filter(w => assignment.group === "nursing" ? w.nursing > 0 : w.midwifery > 0);
              if (validWards.length === 0) return null;
              return (
                <optgroup key={g.group} label={g.group}>
                  {validWards.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="edit-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={LS}>START DATE</label>
            <input type="date" style={{ ...INP }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={LS}>WEEKS</label>
            <input type="number" min="1" style={{ ...INP }} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(assignment)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "9px 12px",
                background: "#FFF1F2",
                color: "#BE123C",
                border: "1px solid #FECDD3",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Delete
            </button>
          ) : <div />}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ padding: "9px 14px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button 
              onClick={() => onSave(assignment.id, { ward, startDate, weeks, endDate: addWeeks(startDate, weeks) })}
              style={{ padding: "9px 16px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
