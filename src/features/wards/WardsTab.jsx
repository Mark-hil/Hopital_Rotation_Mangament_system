import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { themeForDept, DEFAULT_WARD_ROWS } from "../../constants/wardGroups";
import { assignmentStatus, ACTIVE_STATUSES } from "../../utils/rotationRules";
import FilterPills from "../../components/common/FilterPills";
import Pagination from "../../components/common/Pagination";
import ConfirmModal from "../../components/common/ConfirmModal";
import WardFormModal from "./WardFormModal";
import WardDetailModal from "./WardDetailModal";

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

const SELECT_STYLE = {
  ...INP,
  padding: "10px 32px 10px 14px",
  background: "#fff",
  borderRadius: 10,
  fontSize: 13,
  cursor: "pointer",
  appearance: "none",
  width: "auto"
};

function SelectChevron() {
  return (
    <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function WardsTab({ members, assignments, wardRows, tableMissing, onWardsChanged, onBulkAssign, onEditAssignment, onDeleteAssignment, showToast }) {
  const rows = wardRows || DEFAULT_WARD_ROWS;
  const canEditWards = !tableMissing;
  const [incharges, setIncharges] = useState([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [occ, setOcc] = useState("all");
  const [sort, setSort] = useState("order");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [formWard, setFormWard] = useState(undefined); // undefined = closed, null = new, row = edit
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [detailName, setDetailName] = useState(null);

  async function fetchIncharges() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const cached = localStorage.getItem("rotamanager_cache_incharges");
        if (cached) setIncharges(JSON.parse(cached));
      } catch {}
      return;
    }
    try {
      const { data, error } = await supabase.from("incharges").select("id, name, email, phone, wards");
      if (!error && data) {
        setIncharges(data);
        try { localStorage.setItem("rotamanager_cache_incharges", JSON.stringify(data)); } catch {}
      }
    } catch (e) {
      console.warn("Offline or network issue fetching incharges in WardsTab:", e);
    }
  }
  useEffect(() => {
    fetchIncharges();
    const handleOnline = () => fetchIncharges();
    window.addEventListener("online", handleOnline);
    const ch = supabase.channel("incharges_wards_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, () => fetchIncharges())
      .subscribe();
    return () => {
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(ch);
    };
  }, []);

  const departments = useMemo(() => [...new Set(rows.map(r => r.department))], [rows]);

  const stats = useMemo(() => {
    const s = {};
    rows.forEach(r => { s[r.name] = { current: 0, upcoming: 0, completed: 0, nursing: 0, midwifery: 0 }; });
    assignments.forEach(a => {
      const st = s[a.ward];
      if (!st) return;
      const status = assignmentStatus(a);
      if (ACTIVE_STATUSES.includes(status)) {
        st.current++;
        if (a.group === "midwifery") st.midwifery++; else st.nursing++;
      } else if (status === "upcoming") st.upcoming++;
      else st.completed++;
    });
    return s;
  }, [rows, assignments]);

  const supervisorsFor = (name) => incharges.filter(i => (i.wards || []).includes(name));

  const totals = useMemo(() => {
    const vals = Object.values(stats);
    return {
      current: vals.reduce((n, v) => n + v.current, 0),
      upcoming: vals.reduce((n, v) => n + v.upcoming, 0),
      empty: rows.filter(r => stats[r.name]?.current === 0).length,
      over: rows.filter(r => r.capacity && stats[r.name]?.current > r.capacity).length,
    };
  }, [stats, rows]);

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      const st = stats[r.name];
      const qm = !q.trim() || r.name.toLowerCase().includes(q.toLowerCase()) || r.department.toLowerCase().includes(q.toLowerCase());
      const dm = dept === "all" || r.department === dept;
      const om = occ === "all" || (occ === "occupied" ? st.current > 0 : occ === "empty" ? st.current === 0 : r.capacity && st.current > r.capacity);
      return qm && dm && om;
    });
    const sorters = {
      order: (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      most: (a, b) => stats[b.name].current - stats[a.name].current || a.name.localeCompare(b.name),
      least: (a, b) => stats[a.name].current - stats[b.name].current || a.name.localeCompare(b.name),
    };
    return list.sort(sorters[sort]);
  }, [rows, stats, q, dept, occ, sort]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  async function handleSaveWard(fields) {
    setSaving(true);
    try {
      if (formWard) {
        const oldName = formWard.name;
        const { error } = await supabase.from("wards").update(fields).eq("id", formWard.id);
        if (error) throw error;
        if (fields.name !== oldName) {
          const { error: aErr } = await supabase.from("assignments").update({ ward: fields.name }).eq("ward", oldName);
          if (aErr) throw aErr;
          const affected = incharges.filter(i => (i.wards || []).includes(oldName));
          for (const inc of affected) {
            await supabase.from("incharges").update({ wards: inc.wards.map(w => w === oldName ? fields.name : w) }).eq("id", inc.id);
          }
          if (detailName === oldName) setDetailName(fields.name);
          fetchIncharges();
        }
        showToast(`Ward "${fields.name}" updated`);
      } else {
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
        const { error } = await supabase.from("wards").insert([{ ...fields, sort_order: maxOrder + 10 }]);
        if (error) throw error;
        showToast(`Ward "${fields.name}" created`);
      }
      setFormWard(undefined);
      onWardsChanged();
    } catch (err) {
      console.error(err);
      showToast("Error saving ward: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWard() {
    const w = deleting;
    setSaving(true);
    const { error } = await supabase.from("wards").delete().eq("id", w.id);
    if (!error) {
      const affected = incharges.filter(i => (i.wards || []).includes(w.name));
      for (const inc of affected) {
        await supabase.from("incharges").update({ wards: inc.wards.filter(x => x !== w.name) }).eq("id", inc.id);
      }
      fetchIncharges();
    }
    setSaving(false);
    if (error) { showToast("Error deleting ward: " + error.message); return; }
    showToast(`Ward "${w.name}" deleted`);
    setDeleting(null);
    onWardsChanged();
  }

  const detailWard = detailName ? rows.find(r => r.name === detailName) : null;
  const deleteBlocked = deleting && (stats[deleting.name]?.current + stats[deleting.name]?.upcoming) > 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A", display: "flex", alignItems: "center", gap: 10 }}>
            Wards
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 10px", borderRadius: 99 }}>{rows.length} wards · {departments.length} departments</span>
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>See who is placed in every ward and manage wards and their people.</p>
        </div>
        <button id="ward-create" type="button" disabled={!canEditWards} onClick={() => setFormWard(null)} title={canEditWards ? "" : "Run supabase/wards.sql first"}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: canEditWards ? "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)" : "#CBD5E1", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: canEditWards ? "pointer" : "not-allowed", boxShadow: canEditWards ? "0 4px 12px rgba(99,102,241,0.28)" : "none" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New ward
        </button>
      </div>

      {tableMissing && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#92400E" }}>
          <b>Ward editing is turned off.</b> The <code>wards</code> table doesn't exist in Supabase yet. Run <code>supabase/wards.sql</code> in the Supabase SQL editor to turn on creating, renaming and deleting wards. Until then you can still view headcounts and manage the people in each ward.
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: "Currently placed", v: totals.current, a: "#10B981", icon: "🩺", sub: "People on a ward today", onClick: () => { setOcc(occ === "occupied" ? "all" : "occupied"); setPage(1); } },
          { l: "Upcoming", v: totals.upcoming, a: "#6366F1", icon: "📅", sub: "Scheduled to start", onClick: null },
          { l: "Empty wards", v: totals.empty, a: totals.empty ? "#F59E0B" : "#64748B", icon: "🛏️", sub: totals.empty ? "Nobody placed today" : "Every ward staffed ✓", onClick: () => { setOcc(occ === "empty" ? "all" : "empty"); setPage(1); } },
          { l: "Over capacity", v: totals.over, a: totals.over ? "#F43F5E" : "#64748B", icon: "⚠️", sub: totals.over ? "Above their limit" : "Within limits ✓", onClick: () => { setOcc(occ === "over" ? "all" : "over"); setPage(1); } },
        ].map(m => (
          <div key={m.l} className="stat-metric-card" onClick={m.onClick || undefined} style={{ cursor: m.onClick ? "pointer" : "default" }} title={m.onClick ? "Click to filter" : undefined}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.a }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</div>
              <div style={{ fontSize: 20 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 240, maxWidth: 340, flex: 1 }}>
          <svg width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input id="ward-search" style={{ ...INP, padding: "10px 14px 10px 36px", background: "#fff", borderRadius: 10 }} placeholder="Search ward or department…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        </div>
        <FilterPills value={occ} onChange={v => { setOcc(v); setPage(1); }} options={[
          { val: "all", label: "All", count: rows.length },
          { val: "occupied", label: "Occupied", count: rows.length - totals.empty },
          { val: "empty", label: "Empty", count: totals.empty },
        ]} />
        <div style={{ position: "relative" }}>
          <select id="ward-dept-filter" value={dept} onChange={e => { setDept(e.target.value); setPage(1); }} style={SELECT_STYLE}>
            <option value="all">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <SelectChevron />
        </div>
        <div style={{ position: "relative" }}>
          <select id="ward-sort" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={SELECT_STYLE}>
            <option value="order">Sort: Department order</option>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="most">Sort: Most people</option>
            <option value="least">Sort: Fewest people</option>
          </select>
          <SelectChevron />
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", background: "#fff" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>{rows.length ? "No wards match your filters" : "No wards yet"}</div>
          </div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="responsive-table wards-table">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  {["Ward", "Rotation length", "People assigned", "Upcoming", "In-charge", ""].map(h => (
                    <th key={h} style={{ textAlign: h ? "left" : "right", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => {
                  const st = stats[r.name];
                  const theme = themeForDept(r.department);
                  const sup = supervisorsFor(r.name);
                  const over = r.capacity && st.current > r.capacity;
                  const pct = r.capacity ? Math.min(100, (st.current / r.capacity) * 100) : null;
                  return (
                    <tr key={r.id ?? r.name} className="hover-row" style={{ background: i % 2 ? "#FAFAFC" : "#fff", borderBottom: "1px solid #F1F5F9", cursor: "pointer" }} onClick={() => setDetailName(r.name)}>
                      <td data-label="Ward" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.color, border: `1px solid ${theme.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: theme.accent }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 14 }}>{r.name}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: theme.textColor, marginTop: 2 }}>{r.department}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Rotation length" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: r.nursing_weeks ? "#EEF2FF" : "#F1F5F9", color: r.nursing_weeks ? "#4338CA" : "#94A3B8" }}>N {r.nursing_weeks ? `${r.nursing_weeks}w` : "—"}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: r.midwifery_weeks ? "#F0FDF4" : "#F1F5F9", color: r.midwifery_weeks ? "#166534" : "#94A3B8" }}>M {r.midwifery_weeks ? `${r.midwifery_weeks}w` : "—"}</span>
                        </div>
                      </td>
                      <td data-label="People assigned" style={{ padding: "14px 18px", verticalAlign: "middle", minWidth: 170 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: over ? "#E11D48" : st.current ? "#0F172A" : "#CBD5E1" }}>{st.current}</span>
                          {r.capacity && <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>/ {r.capacity}</span>}
                          {st.current > 0 && <span style={{ fontSize: 11, color: "#64748B" }}>{st.nursing}N · {st.midwifery}M</span>}
                        </div>
                        {pct !== null && (
                          <div style={{ height: 4, background: "#EEF2F6", borderRadius: 99, marginTop: 6, overflow: "hidden", maxWidth: 140 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: over ? "#E11D48" : pct >= 80 ? "#F59E0B" : "#10B981" }} />
                          </div>
                        )}
                      </td>
                      <td data-label="Upcoming" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        {st.upcoming ? <span style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", padding: "3px 10px", borderRadius: 99 }}>+{st.upcoming}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td data-label="In-charge" style={{ padding: "14px 18px", verticalAlign: "middle", fontSize: 13, minWidth: 160 }}>
                        {sup.length > 0 ? (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                            {sup.map(s => (
                              <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: "#F1F5F9", color: "#1E293B", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid #E2E8F0" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1" }} />
                                {s.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "3px 9px", borderRadius: 99 }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button type="button" className="action-btn-secondary" onClick={() => setDetailName(r.name)}>People</button>
                          <button type="button" className="action-btn-secondary" disabled={!canEditWards} style={{ opacity: canEditWards ? 1 : 0.45 }} onClick={() => setFormWard(r)}>Edit</button>
                          <button type="button" className="action-btn-danger" disabled={!canEditWards} style={{ opacity: canEditWards ? 1 : 0.45 }} onClick={() => setDeleting(r)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <Pagination currentPage={page} totalItems={filtered.length} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemsPerPageOptions={[5, 10, 20, 50]} itemLabel="wards" />
        )}
      </div>

      {detailWard && (
        <WardDetailModal
          ward={detailWard}
          members={members}
          assignments={assignments}
          supervisors={supervisorsFor(detailWard.name)}
          onAdd={onBulkAssign}
          onEditAssignment={onEditAssignment}
          onDeleteAssignment={onDeleteAssignment}
          onEditWard={canEditWards ? () => setFormWard(detailWard) : null}
          onClose={() => setDetailName(null)}
        />
      )}

      {formWard !== undefined && (
        <WardFormModal
          ward={formWard}
          departments={departments}
          existingNames={rows.map(r => r.name)}
          saving={saving}
          onSave={handleSaveWard}
          onCancel={() => setFormWard(undefined)}
        />
      )}

      {deleting && (deleteBlocked ? (
        <ConfirmModal
          isOpen
          title="Can't delete this ward yet"
          message={`${deleting.name} still has ${stats[deleting.name].current} current and ${stats[deleting.name].upcoming} upcoming placement(s). Move or remove those people first.`}
          confirmText="Open ward"
          confirmVariant="info"
          onConfirm={() => { setDetailName(deleting.name); setDeleting(null); }}
          onCancel={() => setDeleting(null)}
        />
      ) : (
        <ConfirmModal
          isOpen
          title="Delete ward"
          message={`Delete "${deleting.name}"? It will be removed from any in-charge's ward list. Past placements (${stats[deleting.name]?.completed || 0}) stay in history.`}
          confirmText="Delete ward"
          loading={saving}
          onConfirm={handleDeleteWard}
          onCancel={() => setDeleting(null)}
        />
      ))}
    </div>
  );
}
