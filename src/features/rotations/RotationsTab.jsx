import React, { useState, useMemo } from "react";
import Avatar from "../../components/common/Avatar";
import { GroupBadge } from "../../components/common/Badge";
import FilterPills from "../../components/common/FilterPills";
import Pagination from "../../components/common/Pagination";
import ConfirmModal from "../../components/common/ConfirmModal";
import CohortCompletionTierChart from "../../components/charts/CohortCompletionTierChart";
import DisciplineComparisonWidget from "../../components/charts/DisciplineComparisonWidget";
import EditAssignmentModal from "../assignments/EditAssignmentModal";
import { WARD_LOOKUP } from "../../constants/wardGroups";
import { TOTAL_WEEKS } from "../../utils/rotationRules";
import { fmtDate, daysLeft } from "../../utils/dates";

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

export default function RotationsTab({ members, assignments, wardRows, onNavigateTab, onEditAssignment, onDeleteAssignment }) {
  const [viewMode, setViewMode] = useState("roster"); // "roster", "analytics"
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deletingAssignment, setDeletingAssignment] = useState(null);

  const filteredMembers = useMemo(() => {
    if (filter === "all") return members;
    return members.filter((m) => m.group === filter);
  }, [members, filter]);
  
  const grouped = useMemo(() => members
    .filter((m) => (filter === "all" || m.group === filter) && m.name.toLowerCase().includes(search.toLowerCase()))
    .map((m) => {
      const wards = assignments.filter((a) => a.memberId === m.id);
      const done = wards.reduce((s, a) => s + a.weeks, 0);
      const total = TOTAL_WEEKS[m.group] || 52;
      return { ...m, wards, done, total, pct: Math.round((done / total) * 100) };
    }), [members, assignments, filter, search]);

  const paginatedGrouped = useMemo(() => {
    const start = (page - 1) * perPage;
    return grouped.slice(start, start + perPage);
  }, [grouped, page, perPage]);

  const cohortStats = useMemo(() => {
    let completed = 0;
    let totalPct = 0;
    let totalWeeks = 0;
    members.forEach((m) => {
      const wards = assignments.filter((a) => a.memberId === m.id);
      const done = wards.reduce((s, a) => s + a.weeks, 0);
      totalWeeks += done;
      const total = TOTAL_WEEKS[m.group] || 52;
      const pct = Math.min(100, Math.round((done / total) * 100));
      totalPct += pct;
      if (pct >= 100) completed++;
    });
    return {
      avgPct: members.length ? Math.round(totalPct / members.length) : 0,
      completed,
      active: members.length - completed,
      totalWeeks,
    };
  }, [members, assignments]);

  return (
    <div>
      {/* Header & View Mode Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A", margin: 0 }}>Rotation Tracker</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#4338CA", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 9px", borderRadius: 99 }}>
              52-Week Curriculum
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 5 }}>
            Each member's cumulative ward progress, competency completion milestones, and cohort analytics.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", padding: 3, background: "#F1F5F9", borderRadius: 10, border: "1px solid #E2E8F0" }}>
            <button
              type="button"
              onClick={() => setViewMode("roster")}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: viewMode === "roster" ? "#fff" : "transparent",
                color: viewMode === "roster" ? "#1E293B" : "#64748B",
                boxShadow: viewMode === "roster" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📋 Member Rosters
            </button>
            <button
              type="button"
              onClick={() => setViewMode("analytics")}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: viewMode === "analytics" ? "#fff" : "transparent",
                color: viewMode === "analytics" ? "#4338CA" : "#64748B",
                boxShadow: viewMode === "analytics" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📊 Visual Analytics & Funnel
            </button>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab("analytics")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#4338CA", cursor: "pointer", transition: "all 0.15s ease" }}
            >
              <span>Full Analytics Report</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === "analytics" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Quick Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Cohort Completion</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#4338CA", marginTop: 4 }}>{cohortStats.avgPct}%</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Cumulative progression across all {members.length} trainees</div>
            </div>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Fully Graduated (52w)</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#059669", marginTop: 4 }}>{cohortStats.completed}</div>
              <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>{members.length > 0 ? Math.round((cohortStats.completed / members.length) * 100) : 0}% of registered cohort</div>
            </div>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Active In-Rotation</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#D97706", marginTop: 4 }}>{cohortStats.active}</div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>Currently completing ward rotations</div>
            </div>
            <div className="premium-card" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Delivered Weeks</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", marginTop: 4 }}>{cohortStats.totalWeeks}w</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Cumulative hospital clinical training weeks</div>
            </div>
          </div>

          {/* Filter Pills for the analytics view */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <FilterPills
              value={filter}
              onChange={setFilter}
              options={[
                { val: "all", label: "All Disciplines", count: members.length },
                { val: "nursing", label: "Nursing", count: members.filter((m) => m.group === "nursing").length },
                { val: "midwifery", label: "Midwifery", count: members.filter((m) => m.group === "midwifery").length },
              ]}
            />
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("analytics")}
                style={{ fontSize: 12.5, fontWeight: 700, color: "#4338CA", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <span>View Full Executive Analytics & Reports</span>
                <span>→</span>
              </button>
            )}
          </div>

          {/* Visual Charts Grid */}
          <div className="analytics-grid">
            <CohortCompletionTierChart members={filteredMembers} assignments={assignments} />
            <DisciplineComparisonWidget members={members} assignments={assignments} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                style={{ ...INP, maxWidth: 280, width: "auto", padding: "10px 14px", background: "#fff" }}
                placeholder="Search member…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              <FilterPills
                value={filter}
                onChange={(f) => { setFilter(f); setPage(1); }}
                options={[{ val: "all", label: "All" }, { val: "nursing", label: "Nursing" }, { val: "midwifery", label: "Midwifery" }]}
              />
            </div>
            <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
              {grouped.length} {grouped.length === 1 ? "member" : "members"}
            </div>
          </div>
          {grouped.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #CBD5E1", padding: "60px 40px", textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No rotation data</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{members.length === 0 ? "You haven't registered any members yet." : "No members match your current filter and search."}</div>
            </div>
          ) : (
            <>
              {paginatedGrouped.map((m) => (
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
                        const item = { ...a, memberName: a.memberName || m.name };
                        return (
                          <div key={a.id} style={{ background: isDone ? "#F8FAFC" : wd?.color || "#F8FAFC", border: `1px solid ${isDone ? "#E2E8F0" : wd?.accent || "#E2E8F0"}40`, borderRadius: 10, padding: "10px 14px", opacity: isDone ? 0.75 : 1, position: "relative" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? "#94A3B8" : wd?.textColor || "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                              {isDone && <span style={{ fontSize: 12 }}>✓</span>}
                              <span>{a.ward}</span>
                              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingAssignment(item)}
                                  style={{ background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", color: isDone ? "#64748B" : (wd?.textColor || "#64748B"), padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.14)"}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
                                  title="Edit assignment"
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                                {onDeleteAssignment && (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingAssignment(item)}
                                    style={{ background: "rgba(225,29,72,0.08)", border: "none", cursor: "pointer", color: "#E11D48", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(225,29,72,0.18)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(225,29,72,0.08)"}
                                    title="Delete assignment"
                                  >
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                  </button>
                                )}
                              </div>
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
              ))}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", marginTop: 8 }}>
                <Pagination
                  currentPage={page}
                  totalItems={grouped.length}
                  itemsPerPage={perPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={setPerPage}
                  itemsPerPageOptions={[4, 8, 16, 24]}
                />
              </div>
            </>
          )}
        </>
      )}
      
      {editingAssignment && (
        <EditAssignmentModal 
          assignment={editingAssignment} 
          onCancel={() => setEditingAssignment(null)} 
          onSave={(id, data) => {
            onEditAssignment(id, data);
            setEditingAssignment(null);
          }}
          onDelete={(a) => {
            setEditingAssignment(null);
            setDeletingAssignment(a);
          }}
        />
      )}

      {deletingAssignment && (
        <ConfirmModal
          isOpen={true}
          title="Delete Rotation Assignment"
          message={`Are you sure you want to delete the ${deletingAssignment.ward} placement for ${deletingAssignment.memberName} (${deletingAssignment.weeks}w: ${fmtDate(deletingAssignment.startDate)} – ${fmtDate(deletingAssignment.endDate)})? This action cannot be undone.`}
          confirmText="Delete Assignment"
          onConfirm={() => {
            onDeleteAssignment(deletingAssignment.id);
            setDeletingAssignment(null);
          }}
          onCancel={() => setDeletingAssignment(null)}
        />
      )}
    </div>
  );
}
