import React, { useState } from "react";
import { themeForDept } from "../../constants/wardGroups";

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

export default function WardFormModal({ ward, departments, existingNames, onSave, onCancel, saving }) {
  const isEdit = !!ward;
  const [form, setForm] = useState({
    name: ward?.name || "",
    department: ward?.department || departments[0] || "",
    nursing_weeks: ward?.nursing_weeks ?? 2,
    midwifery_weeks: ward?.midwifery_weeks ?? 2,
    capacity: ward?.capacity ?? "",
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const theme = themeForDept(form.department.trim());

  function submit() {
    const e = {};
    const name = form.name.trim();
    const dept = form.department.trim();
    if (!name) e.name = "Ward name is required";
    else if (existingNames.some(n => n.toLowerCase() === name.toLowerCase() && n !== ward?.name)) e.name = "A ward with this name already exists";
    if (!dept) e.department = "Department is required";
    const nw = Number(form.nursing_weeks), mw = Number(form.midwifery_weeks);
    if (!Number.isInteger(nw) || nw < 0) e.nursing_weeks = "Must be 0 or more";
    if (!Number.isInteger(mw) || mw < 0) e.midwifery_weeks = "Must be 0 or more";
    if (!e.nursing_weeks && !e.midwifery_weeks && nw === 0 && mw === 0) e.nursing_weeks = "At least one group needs weeks > 0";
    const cap = form.capacity === "" ? null : Number(form.capacity);
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) e.capacity = "Whole number above 0, or leave blank";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ name, department: dept, nursing_weeks: nw, midwifery_weeks: mw, capacity: cap });
  }

  const Err = ({ k }) => errors[k] ? <div style={{ fontSize: 11, color: "#E11D48", marginTop: 5, fontWeight: 600 }}>{errors[k]}</div> : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div className="premium-card" style={{ padding: 0, borderRadius: 18, width: "100%", maxWidth: 480, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 24px", background: theme.color, borderBottom: `1px solid ${theme.accent}33`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isEdit ? "Edit ward" : "New ward"}</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: "4px 0 0", color: "#0F172A" }}>{form.name.trim() || "Untitled ward"}</h3>
          </div>
          <button type="button" onClick={onCancel} style={{ background: "#fff", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#64748B", fontSize: 17 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={LS}>WARD NAME</label>
            <input id="ward-form-name" style={{ ...INP, borderColor: errors.name ? "#FCA5A5" : "#E2E8F0" }} value={form.name} onChange={set("name")} placeholder="e.g. Cardiology Ward" autoFocus />
            <Err k="name" />
            {isEdit && form.name.trim() && form.name.trim() !== ward.name && (
              <div style={{ fontSize: 11, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "6px 10px", borderRadius: 8, marginTop: 8 }}>
                Renaming also updates every assignment and in-charge linked to "{ward.name}".
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={LS}>DEPARTMENT</label>
            <input id="ward-form-department" list="ward-departments" style={{ ...INP, borderColor: errors.department ? "#FCA5A5" : "#E2E8F0" }} value={form.department} onChange={set("department")} placeholder="Pick existing or type a new one" />
            <datalist id="ward-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
            <Err k="department" />
          </div>

          <div className="edit-modal-grid" style={{ marginBottom: 16 }}>
            <div>
              <label style={LS}>NURSING WEEKS</label>
              <input id="ward-form-nursing" type="number" min="0" style={{ ...INP, borderColor: errors.nursing_weeks ? "#FCA5A5" : "#E2E8F0" }} value={form.nursing_weeks} onChange={set("nursing_weeks")} />
              <Err k="nursing_weeks" />
            </div>
            <div>
              <label style={LS}>MIDWIFERY WEEKS</label>
              <input id="ward-form-midwifery" type="number" min="0" style={{ ...INP, borderColor: errors.midwifery_weeks ? "#FCA5A5" : "#E2E8F0" }} value={form.midwifery_weeks} onChange={set("midwifery_weeks")} />
              <Err k="midwifery_weeks" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: -8, marginBottom: 16 }}>Set 0 to make the ward unavailable for that group.</div>

          <div>
            <label style={LS}>CAPACITY (OPTIONAL)</label>
            <input id="ward-form-capacity" type="number" min="1" style={{ ...INP, borderColor: errors.capacity ? "#FCA5A5" : "#E2E8F0" }} value={form.capacity} onChange={set("capacity")} placeholder="Max people at once — leave blank for no limit" />
            <Err k="capacity" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid #F1F5F9", background: "#FAFBFC" }}>
          <button type="button" onClick={onCancel} disabled={saving} style={{ padding: "9px 16px", background: "#fff", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button id="ward-form-save" type="button" onClick={submit} disabled={saving} style={{ padding: "9px 18px", background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create ward"}
          </button>
        </div>
      </div>
    </div>
  );
}
