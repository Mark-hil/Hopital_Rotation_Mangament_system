import React, { useState, useMemo } from "react";
import { themeForDept } from "../../constants/wardGroups";
import Avatar from "../../components/common/Avatar";
import { GroupBadge, StatusChip } from "../../components/common/Badge";
import FilterPills from "../../components/common/FilterPills";
import Pagination from "../../components/common/Pagination";
import ConfirmModal from "../../components/common/ConfirmModal";
import EditAssignmentModal from "../assignments/EditAssignmentModal";
import { fmtDate, daysLeft, addWeeks } from "../../utils/dates";
import { initials } from "../../utils/formatters";
import { assignmentStatus, ACTIVE_STATUSES } from "../../utils/rotationRules";

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

export default function WardDetailModal({ ward, members, assignments, supervisors, onAdd, onEditAssignment, onDeleteAssignment, onEditWard, onClose }) {
  const theme = themeForDept(ward.department);
  const [filter, setFilter] = useState("current");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(6);
  const [showAdd, setShowAdd] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");
  const [addStart, setAddStart] = useState(new Date().toISOString().split("T")[0]);
  const [addWeeksVal, setAddWeeksVal] = useState("");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const rows = useMemo(() => assignments
    .filter(a => a.ward === ward.name)
    .map(a => {
      const m = members.find(x => x.id === a.memberId);
      return { ...a, member: m, memberName: a.memberName || m?.name || "Unknown", status: assignmentStatus(a) };
    })
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)), [assignments, members, ward.name]);

  const counts = {
    current: rows.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
    upcoming: rows.filter(r => r.status === "upcoming").length,
    completed: rows.filter(r => r.status === "completed").length,
    all: rows.length,
  };

  const filtered = rows.filter(r => {
    const fm = filter === "all" || (filter === "current" ? ACTIVE_STATUSES.includes(r.status) : r.status === filter);
    const qm = !q.trim() || r.memberName.toLowerCase().includes(q.toLowerCase()) || (r.member?.school || "").toLowerCase().includes(q.toLowerCase());
    return fm && qm;
  });
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // People who can be added: eligible group, not already current/upcoming here.
  const busyIds = new Set(rows.filter(r => r.status !== "completed").map(r => r.memberId));
  const eligible = members
    .filter(m => (m.group === "nursing" ? ward.nursing_weeks : ward.midwifery_weeks) > 0 && !busyIds.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const addMember = members.find(m => String(m.id) === String(addMemberId));
  const defaultWeeks = addMember ? (addMember.group === "nursing" ? ward.nursing_weeks : ward.midwifery_weeks) : 0;
  const effectiveWeeks = addWeeksVal === "" ? defaultWeeks : Number(addWeeksVal);

  function submitAdd() {
    if (!addMember || !addStart || !(effectiveWeeks > 0)) return;
    onAdd([{ id: Date.now(), memberId: addMember.id, memberName: addMember.name, group: addMember.group, ward: ward.name, weeks: effectiveWeeks, startDate: addStart, endDate: addWeeks(addStart, effectiveWeeks) }]);
    setAddMemberId(""); setAddWeeksVal(""); setShowAdd(false); setFilter(new Date(addStart) > new Date() ? "upcoming" : "current"); setPage(1);
  }

  const cap = ward.capacity;
  const pct = cap ? Math.min(100, Math.round((counts.current / cap) * 100)) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 90 }} onClick={onClose}>
      <div className="ward-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "22px 26px 18px", background: `linear-gradient(135deg, ${theme.color} 0%, #fff 100%)`, borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.textColor, background: "#fff", border: `1px solid ${theme.accent}44`, padding: "3px 10px", borderRadius: 99 }}>{ward.department}</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "10px 0 4px", letterSpacing: "-0.02em" }}>{ward.name}</h2>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Nursing {ward.nursing_weeks ? `${ward.nursing_weeks}w` : "—"} · Midwifery {ward.midwifery_weeks ? `${ward.midwifery_weeks}w` : "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {onEditWard && <button type="button" className="action-btn-secondary" onClick={onEditWard}>Edit ward</button>}
              <button type="button" onClick={onClose} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#64748B", fontSize: 17 }}>×</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
            {[
              { l: "Currently placed", v: cap ? `${counts.current} / ${cap}` : counts.current, c: "#059669" },
              { l: "Upcoming", v: counts.upcoming, c: "#6366F1" },
              { l: "Completed", v: counts.completed, c: "#64748B" },
            ].map(s => (
              <div key={s.l} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          {pct !== null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 6, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: counts.current > cap ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981", transition: "width .4s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: counts.current > cap ? "#E11D48" : "#64748B", marginTop: 4, fontWeight: 600 }}>
                {counts.current > cap ? `Over capacity by ${counts.current - cap}` : `${cap - counts.current} spot${cap - counts.current === 1 ? "" : "s"} free`}
              </div>
            </div>
          )}

          {/* Supervised by / Clinical Supervision section */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>🩺</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Supervised by
                </span>
                {supervisors.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", padding: "1px 8px", borderRadius: 99, border: "1px solid #C7D2FE" }}>
                    {supervisors.length} {supervisors.length === 1 ? "In-charge" : "In-charges"}
                  </span>
                )}
              </div>
            </div>

            {supervisors.length === 0 ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#FFFBEB",
                border: "1px dashed #FCD34D",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 12,
                color: "#92400E"
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, color: "#92400E" }}>No in-charge assigned yet</div>
                  <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
                    Assign a supervisor to this ward in the In-charges tab to enable clinical oversight.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: supervisors.length > 1 ? "repeat(auto-fit, minmax(240px, 1fr))" : "1fr",
                gap: 8
              }}>
                {supervisors.map(s => (
                  <div
                    key={s.id}
                    className="supervisor-card"
                    style={{
                      background: "#fff",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      boxShadow: "0 1px 3px rgba(15,23,42,0.03)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 800,
                          boxShadow: "0 2px 6px rgba(79,70,229,0.22)"
                        }}>
                          {initials(s.name || "In Charge")}
                        </div>
                        <span
                          style={{
                            position: "absolute",
                            bottom: -1,
                            right: -1,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#10B981",
                            border: "2px solid #fff"
                          }}
                          title="Active Supervisor"
                        />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.name}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#166534", background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "1px 6px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0 }}>
                            In-Charge
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap", fontSize: 11, color: "#64748B" }}>
                          {s.phone && (
                            <a
                              href={`tel:${s.phone}`}
                              className="supervisor-link"
                              title={`Call ${s.phone}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#475569", textDecoration: "none", fontWeight: 500 }}
                            >
                              <span>📞</span> {s.phone}
                            </a>
                          )}
                          {s.email && (
                            <a
                              href={`mailto:${s.email}`}
                              className="supervisor-link"
                              title={`Email ${s.email}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#4F46E5", textDecoration: "none", fontWeight: 500 }}
                            >
                              <span>✉️</span> {s.email}
                            </a>
                          )}
                          {!s.phone && !s.email && (
                            <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Ward supervisor</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(s.email || s.phone) && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {s.email && (
                          <a
                            href={`mailto:${s.email}`}
                            className="icon-btn"
                            title={`Email ${s.name}`}
                            style={{ textDecoration: "none" }}
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                          </a>
                        )}
                        {s.phone && (
                          <a
                            href={`tel:${s.phone}`}
                            className="icon-btn"
                            title={`Call ${s.name}`}
                            style={{ textDecoration: "none" }}
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 26px", flex: 1, overflowY: "auto" }}>
          {/* Add person */}
          {showAdd ? (
            <div style={{ border: "1.5px dashed #A5B4FC", background: "#F5F7FF", borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3730A3", marginBottom: 12 }}>Add a person to {ward.name}</div>
              <div style={{ marginBottom: 12, position: "relative" }}>
                <label style={LS}>MEMBER</label>
                <select id="ward-add-member" style={{ ...INP, background: "#fff" }} value={addMemberId} onChange={e => { setAddMemberId(e.target.value); setAddWeeksVal(""); }}>
                  <option value="">{eligible.length ? `Select from ${eligible.length} eligible member${eligible.length === 1 ? "" : "s"}…` : "No eligible members available"}</option>
                  {["nursing", "midwifery"].map(g => {
                    const list = eligible.filter(m => m.group === g);
                    if (!list.length) return null;
                    return <optgroup key={g} label={g === "nursing" ? "Nursing" : "Midwifery"}>{list.map(m => <option key={m.id} value={m.id}>{m.name} — {m.school}</option>)}</optgroup>;
                  })}
                </select>
              </div>
              <div className="edit-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LS}>START DATE</label>
                  <input id="ward-add-start" type="date" style={{ ...INP, background: "#fff" }} value={addStart} onChange={e => setAddStart(e.target.value)} />
                </div>
                <div>
                  <label style={LS}>WEEKS</label>
                  <input id="ward-add-weeks" type="number" min="1" style={{ ...INP, background: "#fff" }} value={addWeeksVal === "" ? (defaultWeeks || "") : addWeeksVal} onChange={e => setAddWeeksVal(e.target.value)} placeholder="—" />
                </div>
              </div>
              {addMember && effectiveWeeks > 0 && (
                <div style={{ fontSize: 12, color: "#4338CA", marginTop: 10 }}>Ends {fmtDate(addWeeks(addStart, effectiveWeeks))}</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={() => setShowAdd(false)} style={{ padding: "8px 14px", background: "#fff", color: "#334155", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button id="ward-add-submit" type="button" onClick={submitAdd} disabled={!addMember || !(effectiveWeeks > 0)} style={{ padding: "8px 16px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: addMember ? "pointer" : "not-allowed", opacity: addMember && effectiveWeeks > 0 ? 1 : 0.5 }}>Assign to ward</button>
              </div>
            </div>
          ) : (
            <button id="ward-add-open" type="button" onClick={() => setShowAdd(true)} className="ward-add-btn">
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add person to this ward
            </button>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <FilterPills value={filter} onChange={v => { setFilter(v); setPage(1); }} options={[
              { val: "current", label: "Current", count: counts.current },
              { val: "upcoming", label: "Upcoming", count: counts.upcoming },
              { val: "completed", label: "Completed", count: counts.completed },
              { val: "all", label: "All", count: counts.all },
            ]} />
            <input style={{ ...INP, width: "auto", flex: 1, minWidth: 160, background: "#fff", padding: "8px 12px", fontSize: 13 }} placeholder="Search people…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
          </div>

          {/* People list */}
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🛏️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No {filter === "all" ? "" : filter} placements{q ? " match your search" : ""}</div>
              </div>
            ) : paginated.map((r, i) => {
              const dl = daysLeft(r.endDate);
              return (
                <div key={r.id} className="hover-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #F1F5F9" : "none" }}>
                  <Avatar name={r.memberName} group={r.group} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#0F172A", fontSize: 14 }}>{r.memberName}</span>
                      <GroupBadge group={r.group} />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                      {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · {r.weeks}w
                      {r.status !== "completed" && r.status !== "upcoming" && <> · <b style={{ color: dl <= 7 ? "#EA580C" : "#334155" }}>{dl === 0 ? "ends today" : `${dl}d left`}</b></>}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" title="Edit / move" className="icon-btn" onClick={() => setEditing(r)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button type="button" title="Remove from ward" className="icon-btn icon-btn-danger" onClick={() => setRemoving(r)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length > 0 && (
              <Pagination currentPage={page} totalItems={filtered.length} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemsPerPageOptions={[6, 12, 24]} itemLabel="people" />
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div onClick={e => e.stopPropagation()}>
          <EditAssignmentModal
            assignment={editing}
            onSave={(id, data) => { onEditAssignment(id, data); setEditing(null); }}
            onDelete={(a) => { setEditing(null); setRemoving(a); }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      {removing && (
        <div onClick={e => e.stopPropagation()}>
          <ConfirmModal
            isOpen
            title="Remove from ward"
            message={`Remove ${removing.memberName} from ${ward.name} (${fmtDate(removing.startDate)} → ${fmtDate(removing.endDate)})? This deletes the assignment.`}
            confirmText="Remove"
            onConfirm={() => { onDeleteAssignment(removing.id); setRemoving(null); }}
            onCancel={() => setRemoving(null)}
          />
        </div>
      )}
    </div>
  );
}
