import React, { useState } from "react";
import { WARD_GROUPS, WARD_LOOKUP } from "../../constants/wardGroups";
import { RegFormField } from "../members/RegisterTab";

const LS = { display: "block", fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 6, letterSpacing: "0.05em" };

export default function EditInchargeModal({ incharge, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    name: incharge.name || "",
    email: incharge.email || "",
    phone: incharge.phone || "",
    wards: incharge.wards || []
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const allWardNames = WARD_GROUPS.flatMap(g => g.wards.map(w => w.name));
  const allSelected = allWardNames.length > 0 && allWardNames.every(n => form.wards.includes(n));

  function toggleWard(name) {
    setForm(f => ({
      ...f,
      wards: f.wards.includes(name) ? f.wards.filter(x => x !== name) : [...f.wards, name]
    }));
  }

  function toggleAll() {
    setForm(f => ({ ...f, wards: allSelected ? [] : allWardNames }));
  }

  function removeWard(name) {
    setForm(f => ({ ...f, wards: f.wards.filter(x => x !== name) }));
  }

  function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (form.wards.length === 0) e.wards = "Assign at least one ward";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    onSave(incharge.id, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      wards: form.wards
    }).finally(() => setSaving(false));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, overflowY: "auto" }}>
      <div className="premium-card" style={{ padding: "28px", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>Edit In-charge</h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>Update details and manage assigned wards.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RegFormField
            id="edit-name"
            label="Full name"
            placeholder="e.g. Abena Mensah"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <RegFormField
              id="edit-email"
              label="Email address"
              type="email"
              placeholder="e.g. abena@hospital.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email}
            />
            <RegFormField
              id="edit-phone"
              label="Phone number"
              type="tel"
              placeholder="e.g. 0244 000 000"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              error={errors.phone}
            />
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ ...LS, marginBottom: 0 }}>ASSIGNED WARDS</label>
                <span style={{ background: "#6366F1", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                  {form.wards.length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: allSelected ? "#FFF1F2" : "#F8FAFC", color: allSelected ? "#BE123C" : "#475569", cursor: "pointer" }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>

            {errors.wards && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#FFF1F2", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.wards}
              </div>
            )}

            {form.wards.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, padding: "10px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                {form.wards.map(w => {
                  const info = WARD_LOOKUP[w];
                  return (
                    <span
                      key={w}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: info?.color || "#EEF2FF",
                        color: info?.textColor || "#4338CA",
                        border: "1px solid " + (info?.accent || "#6366F1") + "40",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px 3px 10px",
                        borderRadius: 99
                      }}
                    >
                      {w}
                      <button
                        type="button"
                        onClick={() => removeWard(w)}
                        title={`Remove ${w}`}
                        style={{
                          background: "rgba(0,0,0,0.08)",
                          border: "none",
                          borderRadius: "50%",
                          width: 16,
                          height: 16,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "inherit",
                          fontSize: 12,
                          lineHeight: 1,
                          padding: 0
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px", background: "#fff" }}>
              {WARD_GROUPS.map(g => (
                <div key={g.group}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: g.accent }} />{g.group}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {g.wards.map(w => {
                      const sel = form.wards.includes(w.name);
                      return (
                        <button
                          key={w.name}
                          type="button"
                          onClick={() => toggleWard(w.name)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            border: sel ? `1.5px solid ${g.accent}` : "1px solid #E2E8F0",
                            background: sel ? g.color : "#FAFAFA",
                            color: sel ? g.textColor : "#475569",
                            transition: "all 0.15s"
                          }}
                        >
                          <span style={{ fontSize: 10 }}>{sel ? "✓" : "+"}</span>
                          {w.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(incharge)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                background: "#FFF1F2",
                color: "#BE123C",
                border: "1px solid #FECDD3",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Delete In-charge
            </button>
          ) : <div />}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{ padding: "10px 18px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "10px 20px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
