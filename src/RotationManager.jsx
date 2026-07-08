import { useState, useMemo, useEffect } from "react";
import { supabase } from "./lib/supabase";

// ─── Ward Data ────────────────────────────────────────────────────────────────
// Ward names are shared across groups; weeks differ per group.

const WARD_GROUPS = [
  {
    group: "Medical", color: "#EFF6FF", accent: "#3B82F6", textColor: "#1E40AF",
    wards: [
      { name: "Emergency",       nursing: 3, midwifery: 2 },
      { name: "Males' Ward",     nursing: 3, midwifery: 2 },
      { name: "Females' Ward",   nursing: 3, midwifery: 2 },
      { name: "Paediatric Ward", nursing: 3, midwifery: 2 },
      { name: "OPD",             nursing: 0, midwifery: 2 },
    ],
  },
  {
    group: "Surgical", color: "#F0FDF4", accent: "#22C55E", textColor: "#15803D",
    wards: [
      { name: "Surgical Ward",  nursing: 4, midwifery: 2 },
      { name: "Theatre",        nursing: 4, midwifery: 2 },
      { name: "Recovery Ward",  nursing: 4, midwifery: 2 },
    ],
  },
  {
    group: "Special Clinics", color: "#FFF7ED", accent: "#F97316", textColor: "#C2410C",
    wards: [
      { name: "Eye Clinic",                    nursing: 1, midwifery: 1 },
      { name: "ENT",                           nursing: 2, midwifery: 1 },
      { name: "Dental",                        nursing: 2, midwifery: 1 },
      { name: "Dialysis",                      nursing: 1, midwifery: 1 },
      { name: "Sickle Cell / HPT / DM Clinic", nursing: 1, midwifery: 0 },
      { name: "Isolation",                     nursing: 2, midwifery: 0 },
    ],
  },
  {
    group: "Obstetrics", color: "#FDF4FF", accent: "#A855F7", textColor: "#7E22CE",
    wards: [
      { name: "ANC/PNC Clinic", nursing: 2,  midwifery: 6  },
      { name: "ANC/PNC Ward",   nursing: 2,  midwifery: 4  },
      { name: "Labour Ward",    nursing: 3,  midwifery: 12 },
      { name: "NCU",            nursing: 3,  midwifery: 4  },
    ],
  },
  {
    group: "Public Health", color: "#ECFDF5", accent: "#10B981", textColor: "#065F46",
    wards: [
      { name: "Nutrition",                    nursing: 1, midwifery: 0 },
      { name: "RCH",                          nursing: 2, midwifery: 4 },
      { name: "HIV / ART Clinic",             nursing: 1, midwifery: 0 },
      { name: "HIV / ART",                    nursing: 0, midwifery: 2 },
      { name: "Nutrition & Health Promotion", nursing: 0, midwifery: 2 },
    ],
  },
  {
    group: "Psychiatry", color: "#FFF1F2", accent: "#F43F5E", textColor: "#BE123C",
    wards: [{ name: "Psychiatry", nursing: 8, midwifery: 4 }],
  },
];

const WARD_LOOKUP = {};
WARD_GROUPS.forEach((g) =>
  g.wards.forEach((w) => {
    WARD_LOOKUP[w.name] = { ...w, color: g.color, accent: g.accent, textColor: g.textColor, group: g.group };
  })
);

function weeksFor(group, wardName) { return WARD_LOOKUP[wardName]?.[group] ?? 0; }
function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}
function fmtDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name) { return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
function daysLeft(endDate) { return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)); }

const TOTAL_WEEKS = { nursing: 52, midwifery: 52 };

// Returns latest assignment for a member + computed status
function getLatestPlacement(memberId, assignments) {
  const ma = assignments
    .filter((a) => a.memberId === memberId)
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  if (!ma.length) return null;
  const latest = ma[0];
  const dl = daysLeft(latest.endDate);
  const now = new Date();
  const ds = Math.ceil((new Date(latest.startDate) - now) / (1000 * 60 * 60 * 24));
  let status;
  if (ds > 0) status = "upcoming";
  else if (dl < 0) status = "completed";
  else if (dl === 0) status = "completing_today";
  else if (dl <= 7) status = "ending_soon";
  else status = "active";
  return { ...latest, daysLeft: dl, status };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INP = {
  width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #E2E8F0",
  borderRadius: 8, background: "#F8FAFC", color: "#0F172A", boxSizing: "border-box", fontFamily: "inherit",
};
const LS = { display: "block", fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 6, letterSpacing: "0.05em" };
const CS = { background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: 14 };

// ─── Shared Components ────────────────────────────────────────────────────────

function Avatar({ name, group, size = 36 }) {
  const cfg = { nursing: { bg: "#EEF2FF", c: "#4338CA" }, midwifery: { bg: "#F0FDF4", c: "#166534" } };
  const { bg, c } = cfg[group] || cfg.nursing;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function GroupBadge({ group }) {
  return group === "nursing"
    ? <span style={{ background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>Nursing</span>
    : <span style={{ background: "#F0FDF4", color: "#166534", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>Midwifery</span>;
}

function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <div onClick={onChange} style={{ width: 18, height: 18, borderRadius: 5, border: checked || indeterminate ? "2px solid #6366F1" : "2px solid #CBD5E1", background: checked ? "#6366F1" : indeterminate ? "#6366F1" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all .12s" }}>
      {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {indeterminate && !checked && <div style={{ width: 8, height: 2, background: "#fff", borderRadius: 1 }} />}
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1E293B", color: "#fff", padding: "12px 24px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span style={{ color: "#4ADE80" }}>✓</span>{msg}
    </div>
  );
}

function FilterPills({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(({ val, label, count }) => (
        <button key={val} onClick={() => onChange(val)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 700, borderRadius: 99, cursor: "pointer", border: "1.5px solid", borderColor: value === val ? "#6366F1" : "#E2E8F0", background: value === val ? "#EEF2FF" : "#fff", color: value === val ? "#4338CA" : "#64748B", display: "flex", alignItems: "center", gap: 5 }}>
          {label}
          {count != null && <span style={{ background: value === val ? "#6366F1" : "#E2E8F0", color: value === val ? "#fff" : "#64748B", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:            { bg: "#ECFDF5", color: "#065F46", dot: "#22C55E", label: "Active" },
  ending_soon:       { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ending soon" },
  completing_today:  { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ends today" },
  completed:         { bg: "#FFF1F2", color: "#BE123C", dot: "#F43F5E", label: "Completed — Ready" },
  upcoming:          { bg: "#F8FAFC", color: "#475569", dot: "#94A3B8", label: "Upcoming" },
  unassigned:        { bg: "#F8FAFC", color: "#64748B", dot: "#CBD5E1", label: "Unassigned" },
};

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unassigned;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {cfg.label}
    </span>
  );
}

function DashboardTab({ members, assignments, onGoAssign }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const enriched = useMemo(() => members.map((m) => {
    const placement = getLatestPlacement(m.id, assignments);
    return { ...m, placement };
  }), [members, assignments]);

  const counts = {
    all: enriched.length,
    unassigned: enriched.filter((m) => !m.placement).length,
    active: enriched.filter((m) => m.placement?.status === "active").length,
    ending_soon: enriched.filter((m) => ["ending_soon", "completing_today"].includes(m.placement?.status)).length,
    completed: enriched.filter((m) => m.placement?.status === "completed").length,
  };
  const completedIds = enriched.filter((m) => m.placement?.status === "completed").map((m) => m.id);

  const filtered = enriched.filter((m) => {
    const sm = m.name.toLowerCase().includes(search.toLowerCase()) || m.school.toLowerCase().includes(search.toLowerCase());
    if (!sm) return false;
    if (filter === "all") return true;
    if (filter === "unassigned") return !m.placement;
    if (filter === "active") return m.placement?.status === "active";
    if (filter === "ending_soon") return ["ending_soon", "completing_today"].includes(m.placement?.status);
    if (filter === "completed") return m.placement?.status === "completed";
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Placement dashboard</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Live view of every member's placement status. Completed placements are ready for reassignment.</p>
      </div>

      {/* Metric cards */}
      <div className="dashboard-grid">
        {[
          { label: "Unassigned", val: counts.unassigned, accent: "#94A3B8", bg: "#F8FAFC", tc: "#475569", icon: "👥" },
          { label: "Active now", val: counts.active, accent: "#10B981", bg: "#ECFDF5", tc: "#065F46", icon: "🏥" },
          { label: "Ending soon", val: counts.ending_soon, accent: "#F59E0B", bg: "#FFFBEB", tc: "#92400E", icon: "⏳" },
          { label: "Completed — Ready", val: counts.completed, accent: "#F43F5E", bg: "#FFF1F2", tc: "#BE123C", icon: "✅" },
        ].map((m) => (
          <div key={m.label} className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.accent }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
              <div style={{ fontSize: 20, opacity: 0.8 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: m.tc, lineHeight: 1 }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {counts.completed > 0 && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 16, padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 12px rgba(244,63,94,0.05)" }}>
          <div style={{ width: 44, height: 44, background: "#FFE4E6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#BE123C" }}>{counts.completed} member{counts.completed > 1 ? "s" : ""} have completed their placement and need reassignment</div>
            <div style={{ fontSize: 13, color: "#9F1239", marginTop: 2 }}>Click the button to immediately select all completed members and assign their next ward.</div>
          </div>
          <button onClick={() => onGoAssign(completedIds)} style={{ padding: "10px 18px", background: "#BE123C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s", boxShadow: "0 4px 12px rgba(190,18,60,0.3)" }} onMouseEnter={e => e.currentTarget.style.background = "#9F1239"} onMouseLeave={e => e.currentTarget.style.background = "#BE123C"}>
            Reassign all {counts.completed} →
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...INP, maxWidth: 240, width: "auto" }} placeholder="Search member…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FilterPills value={filter} onChange={setFilter} options={[
          { val: "all", label: "All", count: counts.all },
          { val: "unassigned", label: "Unassigned", count: counts.unassigned },
          { val: "active", label: "Active", count: counts.active },
          { val: "ending_soon", label: "Ending soon", count: counts.ending_soon },
          { val: "completed", label: "Completed", count: counts.completed },
        ]} />
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members found</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
          </div>
        ) : (
          <table className="responsive-table">
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Member", "Group", "Current ward", "Started", "Ends", "Days left", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const p = m.placement;
                const wd = p ? WARD_LOOKUP[p.ward] : null;
                const isCompleted = p?.status === "completed";
                const isEndingSoon = ["ending_soon", "completing_today"].includes(p?.status);
                return (
                  <tr key={m.id} style={{ background: isCompleted ? "#FFF1F2" : isEndingSoon ? "#FFFBEB" : i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} className="hover-row">
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar name={m.name} group={m.group} size={36} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.school}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><GroupBadge group={m.group} /></td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      {p ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: wd?.accent || "#CBD5E1", flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: wd?.textColor || "#334155", fontSize: 13 }}>{p.ward}</span>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>({p.weeks}w)</span>
                        </div>
                      ) : <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle", color: "#64748B", fontSize: 13 }}>{p ? fmtDate(p.startDate) : "—"}</td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle", color: "#64748B", fontSize: 13 }}>{p ? fmtDate(p.endDate) : "—"}</td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      {p ? (
                        p.daysLeft < 0
                          ? <span style={{ fontWeight: 700, color: "#BE123C", fontSize: 13 }}>{Math.abs(p.daysLeft)}d ago</span>
                          : p.daysLeft === 0
                            ? <span style={{ fontWeight: 700, color: "#EA580C", fontSize: 13 }}>Today</span>
                            : <span style={{ fontWeight: 700, color: p.daysLeft <= 7 ? "#EA580C" : "#334155", fontSize: 13 }}>{p.daysLeft}d</span>
                      ) : <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      <StatusChip status={p?.status || "unassigned"} />
                    </td>
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      {(isCompleted || !p) && (
                        <button onClick={() => onGoAssign(m.id)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1.5px solid", borderColor: isCompleted ? "#FECDD3" : "#E2E8F0", background: isCompleted ? "#FFF1F2" : "#F8FAFC", color: isCompleted ? "#BE123C" : "#64748B", whiteSpace: "nowrap" }}>
                          {isCompleted ? "Reassign →" : "Assign →"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { dot: "#CBD5E1", label: "Unassigned — no ward yet" },
          { dot: "#22C55E", label: "Active — currently placed" },
          { dot: "#F97316", label: "Ending within 7 days" },
          { dot: "#F43F5E", label: "Completed — ready to reassign" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748B" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.dot, display: "inline-block" }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

function RegisterTab({ onRegister }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", school: "", group: "nursing" });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.password.trim()) e.password = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.school.trim()) e.school = "Required";
    setErrors(e);
    if (Object.keys(e).length) return;
    onRegister(form);
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Register member</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Add a new nurse or midwife to the 2023/2024 rotation.</p>
      </div>
      <div className="premium-card" style={{ padding: "32px", borderRadius: 16 }}>
        {[
          ["name", "Full name", "text", "e.g. Abena Mensah"],
          ["email", "Email address", "email", "e.g. abena@rota.com"],
          ["password", "Password", "password", "••••••••"],
          ["phone", "Phone number", "tel", "e.g. 0244 000 000"],
          ["school", "Training institution", "text", "e.g. Korle Bu School of Nursing"]
        ].map(([id, label, type, ph]) => (
          <div key={id} style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>
            <input 
              style={{ ...INP, padding: "12px 14px", borderColor: errors[id] ? "#FCA5A5" : "#E2E8F0", background: "#F8FAFC", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)" }} 
              type={type} 
              placeholder={ph} 
              value={form[id]} 
              onChange={set(id)} 
              onFocus={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "#6366F1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
              onBlur={e => { e.target.style.background = "#F8FAFC"; e.target.style.borderColor = errors[id] ? "#FCA5A5" : "#E2E8F0"; e.target.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.02)"; }}
            />
            {errors[id] && <p style={{ fontSize: 12, fontWeight: 600, color: "#EF4444", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><span style={{fontSize: 14}}>⚠️</span> {errors[id]}</p>}
          </div>
        ))}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>GROUP</label>
          <div className="register-grid">
            {[{ val: "nursing", icon: "🏥", title: "General Nursing", desc: "52-week programme" }, { val: "midwifery", icon: "👶", title: "Midwifery", desc: "52-week programme" }].map((g) => (
              <div 
                key={g.val} 
                onClick={() => setForm((f) => ({ ...f, group: g.val }))} 
                style={{ border: form.group === g.val ? "2px solid #6366F1" : "1.5px solid #E2E8F0", background: form.group === g.val ? "#EEF2FF" : "#fff", borderRadius: 12, padding: "16px", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 6, opacity: form.group === g.val ? 1 : 0.7 }}
                onMouseEnter={e => { if(form.group !== g.val) { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.opacity = 1; } }}
                onMouseLeave={e => { if(form.group !== g.val) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.opacity = 0.7; } }}
              >
                <div style={{ fontSize: 26 }}>{g.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: form.group === g.val ? "#4338CA" : "#0F172A" }}>{g.title}</div>
                <div style={{ fontSize: 12, color: form.group === g.val ? "#6366F1" : "#64748B" }}>{g.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <button 
          onClick={submit} 
          style={{ width: "100%", padding: "14px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.2)", transition: "all 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          Complete Registration
        </button>
      </div>
    </div>
  );
}

// ─── Assign (mixed-group aware) ───────────────────────────────────────────────

function AssignTab({ members, assignments, onBulkAssign, initialTargetIds }) {
  const targetMember = initialTargetIds?.length === 1 ? members.find(m => m.id === initialTargetIds[0]) : null;
  const [selectedIds, setSelectedIds] = useState(new Set(initialTargetIds || []));
  const [filterGroup, setFilterGroup] = useState("all");
  const [search, setSearch] = useState(targetMember ? targetMember.name : "");
  const [selectedWardName, setSelectedWardName] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const selectedMembers = members.filter((m) => selectedIds.has(m.id));
  const hasN = selectedMembers.some((m) => m.group === "nursing");
  const hasM = selectedMembers.some((m) => m.group === "midwifery");
  const isMixed = hasN && hasM;

  const visibleWardGroups = useMemo(() => {
    if (!selectedMembers.length) return [];
    return WARD_GROUPS.map((g) => ({
      ...g,
      wards: g.wards.filter((w) => (hasN && w.nursing > 0) || (hasM && w.midwifery > 0)),
    })).filter((g) => g.wards.length > 0);
  }, [selectedMembers.length, hasN, hasM]);

  const visibleMembers = useMemo(() => members.filter((m) => {
    const gm = filterGroup === "all" || m.group === filterGroup;
    const sm = m.name.toLowerCase().includes(search.toLowerCase()) || m.school.toLowerCase().includes(search.toLowerCase());
    return gm && sm;
  }), [members, filterGroup, search]);

  function toggle(id) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); setSelectedWardName(null); }
  function toggleAll() {
    const allSel = visibleMembers.every((m) => selectedIds.has(m.id));
    setSelectedIds(allSel ? new Set() : new Set(visibleMembers.map((m) => m.id)));
    setSelectedWardName(null);
  }

  function wardStatus(wardName) {
    const rel = selectedMembers.filter((m) => weeksFor(m.group, wardName) > 0);
    if (!rel.length) return "none";
    const done = rel.filter((m) => assignments.some((a) => a.memberId === m.id && a.ward === wardName));
    if (done.length === rel.length) return "all";
    if (done.length > 0) return "some";
    return "none";
  }

  const ap = selectedMembers.map((m) => ({
    ...m,
    weeks: weeksFor(m.group, selectedWardName),
    alreadyAssigned: assignments.some((a) => a.memberId === m.id && a.ward === selectedWardName),
  }));
  const assignable = ap.filter((m) => m.weeks > 0 && !m.alreadyAssigned);

  function confirmAssign() {
    if (!selectedWardName || !assignable.length) return;
    const list = assignable.map((m) => ({
      id: Date.now() + Math.random(), memberId: m.id, memberName: m.name, group: m.group,
      ward: selectedWardName, weeks: m.weeks, startDate, endDate: addWeeks(startDate, m.weeks),
    }));
    onBulkAssign(list);
    setSelectedIds(new Set()); setSelectedWardName(null);
  }

  const swd = selectedWardName ? WARD_LOOKUP[selectedWardName] : null;
  const completedIds = new Set(members.filter((m) => getLatestPlacement(m.id, assignments)?.status === "completed").map((m) => m.id));

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Assign ward placement</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Select any mix of members — weeks auto-adjust per each member's programme.</p>
      </div>
      <div className="assign-layout">
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ ...INP, maxWidth: 220, flex: 1, padding: "10px 14px", background: "#fff" }} placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FilterPills value={filterGroup} onChange={setFilterGroup} options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]} />
            {selectedIds.size > 0 && (
              <button onClick={() => { setSelectedIds(new Set()); setSelectedWardName(null); }} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, borderRadius: 99, border: "1.5px solid #FCA5A5", background: "#FFF1F2", color: "#BE123C", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#FFE4E6"} onMouseLeave={e => e.currentTarget.style.background = "#FFF1F2"}>
                Clear ({selectedIds.size})
              </button>
            )}
          </div>
          {members.length === 0
            ? <div className="premium-card" style={{ padding: "60px 40px", textAlign: "center", color: "#94A3B8", borderRadius: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members registered</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>Go to the Register tab to add your first member.</div>
              </div>
            : <div className="table-wrapper">
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14, background: "rgba(248, 250, 252, 0.5)" }}>
                <Checkbox checked={visibleMembers.length > 0 && visibleMembers.every((m) => selectedIds.has(m.id))} indeterminate={visibleMembers.some((m) => selectedIds.has(m.id)) && !visibleMembers.every((m) => selectedIds.has(m.id))} onChange={toggleAll} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}</span>
                {isMixed && <span style={{ fontSize: 11, background: "#EEF2FF", color: "#4338CA", padding: "4px 10px", borderRadius: 99, fontWeight: 700, marginLeft: "auto" }}>Mixed — weeks auto-adjust ✓</span>}
              </div>
              {visibleMembers.map((m) => {
                const isSel = selectedIds.has(m.id);
                const isDone = completedIds.has(m.id);
                const preview = isSel && selectedWardName ? weeksFor(m.group, selectedWardName) : null;
                const alreadyHas = isSel && selectedWardName && assignments.some((a) => a.memberId === m.id && a.ward === selectedWardName);
                const latest = getLatestPlacement(m.id, assignments);
                return (
                  <div key={m.id} onClick={() => toggle(m.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #F1F5F9", cursor: "pointer", background: isSel ? "#EEF2FF" : isDone ? "#FFF1F2" : "#fff", transition: "background 0.2s" }} onMouseEnter={e => { if(!isSel && !isDone) e.currentTarget.style.background = "#F8FAFC" }} onMouseLeave={e => { if(!isSel && !isDone) e.currentTarget.style.background = "#fff" }}>
                    <Checkbox checked={isSel} onChange={() => toggle(m.id)} />
                    <Avatar name={m.name} group={m.group} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#0F172A" }}>
                        {m.name}
                        {isDone && <span style={{ fontSize: 10, background: "#FFF1F2", color: "#BE123C", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>Completed</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {latest ? `${latest.ward} · ends ${fmtDate(latest.endDate)}` : m.school}
                      </div>
                    </div>
                    <GroupBadge group={m.group} />
                    {isSel && selectedWardName
                      ? (preview > 0
                        ? <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: alreadyHas ? "#F1F5F9" : "#ECFDF5", color: alreadyHas ? "#94A3B8" : "#065F46", whiteSpace: "nowrap" }}>{alreadyHas ? "done" : `${preview}w`}</span>
                        : <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: "#F1F5F9", color: "#94A3B8" }}>N/A</span>)
                      : <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>{assignments.filter((a) => a.memberId === m.id).length} wards</span>
                    }
                  </div>
                );
              })}
            </div>
          }
        </div>

        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedIds.size > 0 && (
            <div className="premium-card" style={{ padding: "24px", borderRadius: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>SELECTED ({selectedIds.size})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedMembers.map((m) => (
                  <div key={m.id} onClick={(e) => { e.stopPropagation(); toggle(m.id); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"} onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                    <Avatar name={m.name} group={m.group} size={20} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{m.name.split(" ")[0]}</span>
                    <span style={{ color: "#94A3B8", fontSize: 14, marginLeft: 2 }}>×</span>
                  </div>
                ))}
              </div>
              {isMixed && (
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: "#EEF2FF", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}><div style={{ fontWeight: 700, color: "#4338CA" }}>🏥 Nursing ({selectedMembers.filter((m) => m.group === "nursing").length})</div></div>
                  <div style={{ flex: 1, background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}><div style={{ fontWeight: 700, color: "#166534" }}>👶 Midwifery ({selectedMembers.filter((m) => m.group === "midwifery").length})</div></div>
                </div>
              )}
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="premium-card" style={{ padding: "24px", maxHeight: 400, overflowY: "auto", borderRadius: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>CHOOSE WARD</div>
              {visibleWardGroups.map((grp) => (
                <div key={grp.group} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{grp.group}</span><div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
                  </div>
                  <div className="wards-grid">
                    {grp.wards.map((w) => {
                      const st = wardStatus(w.name); const sel = selectedWardName === w.name;
                      return (
                        <div key={w.name} onClick={() => st !== "all" && setSelectedWardName(sel ? null : w.name)} style={{ border: sel ? `2px solid ${grp.accent}` : "1px solid #E2E8F0", background: sel ? grp.color : st === "all" ? "#F8FAFC" : "#fff", borderRadius: 10, padding: "10px 12px", cursor: st === "all" ? "default" : "pointer", opacity: st === "all" ? 0.45 : 1, transition: "all 0.15s" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: sel ? grp.textColor : "#334155" }}>{w.name}</div>
                          {isMixed ? (
                            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {w.nursing > 0 && <span style={{ fontSize: 10, background: "#EEF2FF", color: "#4338CA", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>N:{w.nursing}w</span>}
                              {w.midwifery > 0 && <span style={{ fontSize: 10, background: "#F0FDF4", color: "#166534", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>M:{w.midwifery}w</span>}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, fontWeight: 600 }}>
                              {selectedMembers[0] ? w[selectedMembers[0].group] : w.nursing} weeks{st === "some" ? " · some done" : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedWardName && assignable.length > 0 && (
            <div className="premium-card" style={{ padding: "24px", borderRadius: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>CONFIRM</div>
              <div style={{ background: swd?.color || "#F8FAFC", borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: `1px solid ${swd?.accent}30` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: swd?.textColor || "#0F172A" }}>{selectedWardName}</div>
                <div style={{ fontSize: 12, color: swd?.textColor || "#64748B", marginTop: 4 }}>{assignable.length} member{assignable.length > 1 ? "s" : ""} to assign</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                {ap.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <Avatar name={m.name} group={m.group} size={28} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: m.alreadyAssigned || m.weeks === 0 ? "#94A3B8" : "#0F172A" }}>{m.name.split(" ")[0]}</span>
                    <GroupBadge group={m.group} />
                    {m.alreadyAssigned ? <span style={{ fontSize: 12, color: "#94A3B8" }}>done</span>
                      : m.weeks === 0 ? <span style={{ fontSize: 12, color: "#94A3B8" }}>N/A</span>
                        : <span style={{ fontSize: 12, fontWeight: 700, background: "#ECFDF5", color: "#065F46", padding: "3px 10px", borderRadius: 99 }}>{m.weeks}w</span>}
                  </div>
                ))}
              </div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>START DATE</label>
              <input type="date" style={{ ...INP, padding: "12px 14px", marginBottom: 20, background: "#F8FAFC", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)" }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <button 
                onClick={confirmAssign} 
                style={{ width: "100%", padding: "14px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.2)", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                Assign {assignable.length} member{assignable.length > 1 ? "s" : ""} →
              </button>
            </div>
          )}

          {selectedIds.size === 0 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #CBD5E1", padding: "60px 30px", textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>Select members first</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Choose members from the left panel to configure their placement.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Members ──────────────────────────────────────────────────────────────────

function MembersTab({ members, assignments }) {
  const [q, setQ] = useState(""); const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => members.filter((m) =>
    (m.name.toLowerCase().includes(q.toLowerCase()) || m.school.toLowerCase().includes(q.toLowerCase())) && (filter === "all" || m.group === filter)
  ), [members, q, filter]);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Members</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>All registered nurses and midwives.</p>
      </div>
      <div className="members-grid">
        {[
          { l: "Total Members", v: members.length, a: "#6366F1", icon: "👥" }, 
          { l: "General Nursing", v: members.filter((m) => m.group === "nursing").length, a: "#3B82F6", icon: "🏥" }, 
          { l: "Midwifery", v: members.filter((m) => m.group === "midwifery").length, a: "#10B981", icon: "👶" }
        ].map((m) => (
          <div key={m.l} className="premium-card" style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.a }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</div>
              <div style={{ fontSize: 20, opacity: 0.8 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input style={{ ...INP, maxWidth: 280, width: "auto", padding: "10px 14px", background: "#fff" }} placeholder="Search name or school…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterPills value={filter} onChange={setFilter} options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]} />
      </div>
      <div className="table-wrapper">
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members found</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
            </div>
          : <table className="responsive-table members-table">
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>{["Member", "Institution", "Phone", "Group", "Assignments"].map((h) => <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map((m, i) => {
              const count = assignments.filter((a) => a.memberId === m.id).length;
              return <tr key={m.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9", transition: "background 0.2s" }} className="hover-row">
                <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar name={m.name} group={m.group} size={36} /><span style={{ fontWeight: 700, color: "#0F172A" }}>{m.name}</span></div></td>
                <td style={{ padding: "16px 18px", color: "#64748B", verticalAlign: "middle", fontSize: 13 }}>{m.school}</td>
                <td style={{ padding: "16px 18px", color: "#64748B", verticalAlign: "middle", fontSize: 13 }}>{m.phone}</td>
                <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><GroupBadge group={m.group} /></td>
                <td style={{ padding: "16px 18px", verticalAlign: "middle" }}><span style={{ background: count > 0 ? "#ECFDF5" : "#FFF7ED", color: count > 0 ? "#065F46" : "#9A3412", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99 }}>{count > 0 ? `${count} wards` : "Unassigned"}</span></td>
              </tr>;
            })}</tbody>
          </table>
        }
      </div>
    </div>
  );
}

// ─── Edit Assignment Modal ──────────────────────────────────────────────────────

function EditAssignmentModal({ assignment, onSave, onCancel }) {
  const [ward, setWard] = useState(assignment.ward);
  const [startDate, setStartDate] = useState(assignment.startDate);
  const [weeks, setWeeks] = useState(assignment.weeks);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="premium-card" style={{ padding: 24, borderRadius: 16, width: "90%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.3) !important" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Edit Assignment</h3>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>Change the ward, start date, or weeks.</p>
        
        <div style={{ marginBottom: 16 }}>
          <label style={LS}>MEMBER</label>
          <div style={{ fontSize: 14, fontWeight: 600, padding: "10px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>{assignment.memberName}</div>
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

        <div className="edit-modal-grid">
          <div>
            <label style={LS}>START DATE</label>
            <input type="date" style={{ ...INP }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={LS}>WEEKS</label>
            <input type="number" min="1" style={{ ...INP }} value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button 
            onClick={() => onSave(assignment.id, { ward, startDate, weeks, endDate: addWeeks(startDate, weeks) })}
            style={{ flex: 1, padding: "10px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── Rotations ────────────────────────────────────────────────────────────────

function RotationsTab({ members, assignments, onEditAssignment }) {
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const [editingAssignment, setEditingAssignment] = useState(null);
  
  const grouped = useMemo(() => members
    .filter((m) => (filter === "all" || m.group === filter) && m.name.toLowerCase().includes(search.toLowerCase()))
    .map((m) => {
      const wards = assignments.filter((a) => a.memberId === m.id);
      const done = wards.reduce((s, a) => s + a.weeks, 0);
      const total = TOTAL_WEEKS[m.group];
      return { ...m, wards, done, total, pct: Math.round((done / total) * 100) };
    }), [members, assignments, filter, search]);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>Rotation tracker</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Each member's cumulative ward progress.</p>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...INP, maxWidth: 280, width: "auto", padding: "10px 14px", background: "#fff" }} placeholder="Search member…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FilterPills value={filter} onChange={setFilter} options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]} />
      </div>
      {grouped.length === 0
        ? <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #CBD5E1", padding: "60px 40px", textAlign: "center", color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No rotation data</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
          </div>
        : grouped.map((m) => (
          <div key={m.id} className="premium-card" style={{ padding: "24px", marginBottom: 16, borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <Avatar name={m.name} group={m.group} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{m.name}</span><GroupBadge group={m.group} /></div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{m.school}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.pct === 100 ? "#10B981" : "#6366F1", letterSpacing: "-0.02em" }}>{m.pct}%</div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500, marginTop: 2 }}>{m.done} / {m.total} weeks</div>
              </div>
            </div>
            <div style={{ height: 8, background: "#F1F5F9", borderRadius: 99, overflow: "hidden", marginBottom: m.wards.length ? 20 : 0 }}>
              <div style={{ height: "100%", width: `${m.pct}%`, background: m.pct === 100 ? "#10B981" : "#6366F1", borderRadius: 99, transition: "width .4s" }} />
            </div>
            {m.wards.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {m.wards.map((a) => {
                  const wd = WARD_LOOKUP[a.ward]; const dl = daysLeft(a.endDate); const isDone = dl < 0;
                  return (
                    <div key={a.id} style={{ background: isDone ? "#F8FAFC" : wd?.color || "#F8FAFC", border: `1px solid ${isDone ? "#E2E8F0" : wd?.accent || "#E2E8F0"}40`, borderRadius: 10, padding: "10px 14px", opacity: isDone ? 0.7 : 1, position: "relative" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? "#94A3B8" : wd?.textColor || "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                        {isDone && <span style={{ fontSize: 12 }}>✓</span>}{a.ward}
                        {!isDone && (
                          <button onClick={() => setEditingAssignment(a)} style={{ background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", color: wd?.textColor || "#64748B", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", marginLeft: 6 }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.1)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.05)"} title="Edit assignment">
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                        {fmtDate(a.startDate)} → {fmtDate(a.endDate)} · <span style={{fontWeight: 600}}>{a.weeks}w</span> · {isDone ? `done ${Math.abs(dl)}d ago` : dl === 0 ? "ends today" : `${dl}d left`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      }
      
      {editingAssignment && (
        <EditAssignmentModal 
          assignment={editingAssignment} 
          onCancel={() => setEditingAssignment(null)} 
          onSave={(id, data) => {
            onEditAssignment(id, data);
            setEditingAssignment(null);
          }} 
        />
      )}
    </div>
  );
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

const NAV_ICONS = {
  dashboard: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  register: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>,
  assign: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 16l2 2 4-4" /></svg>,
  members: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  rotations: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
};

// ─── Login screen ─────────────────────────────────────────────────────────────
// Demo auth only — swap handleLogin for a real API call when wiring up a backend.

function LoginScreen({ onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Enter both email and password."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError("Invalid email or password.");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: "#6366F1", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
            <svg width="26" height="26" fill="none" stroke="white" strokeWidth="2.3" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>RotaManager</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>2023 / 2024 rotation system</div>
        </div>

        <div className="premium-card" style={{ borderRadius: 20, padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Welcome back</div>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Sign in to manage rotations.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={LS}>EMAIL ADDRESS</label>
            <input
              type="email" autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="admin@rota.com"
              style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0" }}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={LS}>PASSWORD</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0", paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                {showPw ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, padding: "9px 12px", background: "#FFF1F2", borderRadius: 8, fontSize: 12, color: "#BE123C", fontWeight: 600 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "12px", marginTop: 20, background: loading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.35)" }}>
            {loading ? "Signing in…" : "Sign in →"}
          </button>

          {onGoRegister && (
            <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#64748B" }}>
              Don't have an account?{" "}
              <button onClick={onGoRegister} style={{ background: "none", border: "none", color: "#6366F1", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                Create one now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Member Dashboard ─────────────────────────────────────────────────────────

function MemberDashboardTab({ user, members, assignments }) {
  const member = members.find(m => m.auth_id === user.id);
  const internalMemberId = member?.id;
  const myAssignments = assignments.filter(a => a.memberId === internalMemberId).sort((a,b) => new Date(b.startDate) - new Date(a.startDate));

  if (!member) return <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading your profile...</div>;

  const enrichedAssignments = myAssignments.map(a => {
    const wd = WARD_LOOKUP[a.ward];
    const now = new Date();
    const ed = new Date(a.endDate);
    const sd = new Date(a.startDate);
    const diffDays = Math.ceil((ed - now) / (1000 * 60 * 60 * 24));
    const startDiff = Math.ceil((sd - now) / (1000 * 60 * 60 * 24));
    let status = "active";
    if (startDiff > 0) status = "upcoming";
    else if (diffDays < 0) status = "completed";
    else if (diffDays === 0) status = "completing_today";
    else if (diffDays <= 7) status = "ending_soon";
    return { ...a, wd, status };
  });

  const active = enrichedAssignments.filter(a => ["active", "ending_soon", "completing_today"].includes(a.status));
  const upcoming = enrichedAssignments.filter(a => a.status === "upcoming");
  const past = enrichedAssignments.filter(a => a.status === "completed");

  const AssignmentCard = ({ a }) => {
    const isActive = ["active", "ending_soon", "completing_today"].includes(a.status);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, background: isActive ? "#F0FDF4" : "#F8FAFC", border: "1px solid", borderColor: isActive ? "#BBF7D0" : "#E2E8F0", borderRadius: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: a.wd?.accent || "#CBD5E1" }} />
            <div style={{ fontWeight: 700, color: a.wd?.textColor || "#334155" }}>{a.ward}</div>
          </div>
          <div style={{ fontSize: 13, color: "#64748B" }}>
            {fmtDate(a.startDate)} – {fmtDate(a.endDate)} ({a.weeks} weeks)
          </div>
        </div>
        <div>
          <StatusChip status={a.status} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Welcome back, {member.name.split(" ")[0]}!</h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Track your rotation schedule and ward placements.</p>
      </div>

      <div className="premium-card" style={{ padding: "28px 32px", marginBottom: 24, borderRadius: 16 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #F1F5F9" }}>
          <Avatar name={member.name} group={member.group} size={56} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{member.name}</div>
            <div style={{ fontSize: 14, color: "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              {member.school} <span style={{ color: "#CBD5E1" }}>•</span> <GroupBadge group={member.group} />
            </div>
          </div>
        </div>
        
        {enrichedAssignments.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: 12, border: "2px dashed #E2E8F0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>No placements yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>You have not been assigned to any wards.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {active.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#10B981", borderRadius: "50%", boxShadow: "0 0 0 3px #D1FAE5" }} /> Current Placement
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {active.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
              </div>
            )}
            
            {upcoming.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Upcoming</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {upcoming.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
              </div>
            )}
            
            {past.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Past History</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {past.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

function MainApp({ user, onLogout }) {
  const [tab, setTab] = useState(user.role === "Member" ? "memberDashboard" : "dashboard");
  const [assignTargetIds, setAssignTargetIds] = useState([]);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    // Initial fetch
    supabase.from('members').select('*').then(({ data }) => data && setMembers(data)).catch(console.error);
    supabase.from('assignments').select('*').then(({ data }) => data && setAssignments(data)).catch(console.error);

    // Setup realtime subscriptions
    const memberSub = supabase.channel('members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        supabase.from('members').select('*').then(({ data }) => data && setMembers(data));
      })
      .subscribe();

    const assignmentSub = supabase.channel('assignments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        supabase.from('assignments').select('*').then(({ data }) => data && setAssignments(data));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(memberSub);
      supabase.removeChannel(assignmentSub);
    };
  }, []);

  function handleRegister(m) {
    const { id, ...memberData } = m;
    supabase.from('members').insert([memberData]).select().single()
      .then(({ data, error }) => {
        if (error) throw error;
        setMembers((p) => [...p, data]);
        showToast(`${data.name} registered`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error registering member");
      });
  }

  function handleBulkAssign(list) {
    const insertList = list.map(({ id, ...rest }) => rest);
    supabase.from('assignments').insert(insertList)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from('assignments').select('*');
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`${list.length} member${list.length > 1 ? "s" : ""} assigned to ${list[0]?.ward}`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error assigning wards");
      });
  }

  function handleEditAssignment(assignmentId, newData) {
    supabase.from('assignments').update(newData).eq('id', assignmentId)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from('assignments').select('*');
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`Assignment updated successfully`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error updating assignment");
      });
  }

  const completedCount = useMemo(() =>
    members.filter((m) => getLatestPlacement(m.id, assignments)?.status === "completed").length,
    [members, assignments]
  );

  const NAV = user.role === "Member" ? [
    { id: "memberDashboard", label: "My Rotations", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg> }
  ] : [
    { id: "dashboard", label: "Dashboard" },
    { id: "register", label: "Register" },
    { id: "assign", label: "Assign wards" },
    { id: "members", label: "Members" },
    { id: "rotations", label: "Rotations" },
  ];

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: "#6366F1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>RotaManager</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>2023 / 2024</div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav-container" style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", padding: "8px 10px 4px", letterSpacing: "0.1em" }}>MANAGEMENT</div>
          {NAV.map(({ id, label, icon }) => (
            <button key={id} className="sidebar-nav-btn" onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, background: tab === id ? "rgba(99,102,241,0.2)" : "transparent", color: tab === id ? "#818CF8" : "rgba(255,255,255,0.5)", border: "none", width: "100%", textAlign: "left", transition: "all .15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{icon || NAV_ICONS[id]}<span>{label}</span></div>
              {id === "dashboard" && completedCount > 0 && (
                <span style={{ background: "#F43F5E", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, minWidth: 18, textAlign: "center" }}>{completedCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", padding: "0 4px 10px" }}>{members.length} members · {assignments.length} assignments</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#6366F1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{user.role}</div>
            </div>
            <button onClick={() => setShowLogoutConfirm(true)} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.background = "rgba(248,113,113,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "none"; }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          </div>
        </div>
      </aside>
      <main className="app-main">
        {tab === "dashboard" && <DashboardTab members={members} assignments={assignments} onGoAssign={(ids) => { 
          if (!ids) setAssignTargetIds([]);
          else if (Array.isArray(ids)) setAssignTargetIds(ids);
          else setAssignTargetIds([ids]);
          setTab("assign"); 
        }} />}
        {tab === "register" && <RegisterTab onRegister={handleRegister} />}
        {tab === "assign" && <AssignTab members={members} assignments={assignments} onBulkAssign={handleBulkAssign} initialTargetIds={assignTargetIds} />}
        {tab === "members" && <MembersTab members={members} assignments={assignments} />}
        {tab === "rotations" && <RotationsTab members={members} assignments={assignments} onEditAssignment={handleEditAssignment} />}
        {tab === "memberDashboard" && <MemberDashboardTab user={user} members={members} assignments={assignments} />}
      </main>
      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div className="premium-card" style={{ padding: "28px 28px", maxWidth: 340, width: "90%", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.25) !important" }}>
            <div style={{ width: 44, height: 44, background: "#FFF1F2", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width="22" height="22" fill="none" stroke="#BE123C" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>Sign out?</div>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 22 }}>You will be returned to the login screen.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: "10px", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={onLogout} style={{ flex: 1, padding: "10px", background: "#BE123C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, name: session.user.user_metadata.name, email: session.user.email, role: session.user.user_metadata.role });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, name: session.user.user_metadata.name, email: session.user.email, role: session.user.user_metadata.role });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Inter', sans-serif" }}>Loading session...</div>;

  if (user) {
    return <MainApp user={user} onLogout={() => supabase.auth.signOut()} />;
  }

  if (view === "register") {
    return (
      <>
        <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="premium-card" style={{ padding: "32px 40px", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important" }}>
            <RegisterTab onRegister={async (form) => {
              const { data, error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: { data: { role: 'Member', name: form.name } }
              });
              if (error) {
                showToast("Error registering: " + error.message);
              } else if (data.user) {
                await supabase.from('members').insert([{
                  auth_id: data.user.id,
                  name: form.name,
                  email: form.email,
                  phone: form.phone,
                  school: form.school,
                  group: form.group
                }]);
                showToast("Successfully registered! Please log in.");
                setView("login");
              }
            }} />
            <button onClick={() => setView("login")} style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 24, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back to sign in
            </button>
          </div>
        </div>
        <Toast msg={toast} />
      </>
    );
  }

  return (
    <>
      <LoginScreen onGoRegister={() => setView("register")} />
      <Toast msg={toast} />
    </>
  );
}
