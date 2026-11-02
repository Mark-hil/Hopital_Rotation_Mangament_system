import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { WARD_GROUPS, WARD_LOOKUP, ALL_WARD_NAMES } from "../../constants/wardGroups";
import { fmtDate } from "../../utils/formatters";
import FilterPills from "../../components/common/FilterPills";
import Pagination from "../../components/common/Pagination";
import ConfirmModal from "../../components/common/ConfirmModal";
import EditInchargeModal from "./EditInchargeModal";

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

export default function InchargesTab({ showToast, onGoRegister }) {
  const [incharges, setIncharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [wardFilter, setWardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("recent");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [editingIncharge, setEditingIncharge] = useState(null);
  const [deletingIncharge, setDeletingIncharge] = useState(null);
  const [removingWard, setRemovingWard] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedEmailId, setCopiedEmailId] = useState(null);

  async function fetchIncharges() {
    const { data, error: err } = await supabase.from("incharges").select("*").order("created_at", { ascending: false });
    if (err) {
      console.error("incharges fetch error:", err);
      setError(err.message);
    } else {
      setIncharges(data || []);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchIncharges();
    const sub = supabase.channel("incharges-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "incharges" }, fetchIncharges)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  async function handleSaveIncharge(id, updatedFields) {
    const { error: err } = await supabase.from("incharges").update(updatedFields).eq("id", id);
    if (err) {
      console.error("Error updating incharge:", err);
      if (showToast) showToast("Error updating in-charge: " + err.message);
      else alert("Error updating in-charge: " + err.message);
      throw err;
    }
    setIncharges(prev => prev.map(inc => inc.id === id ? { ...inc, ...updatedFields } : inc));
    if (showToast) showToast("In-charge updated successfully");
    setEditingIncharge(null);
  }

  async function handleDeleteIncharge(id) {
    setActionLoading(true);
    const { error: err } = await supabase.from("incharges").delete().eq("id", id);
    setActionLoading(false);
    if (err) {
      console.error("Error deleting incharge:", err);
      if (showToast) showToast("Error deleting in-charge: " + err.message);
      else alert("Error deleting in-charge: " + err.message);
      return;
    }
    setIncharges(prev => prev.filter(inc => inc.id !== id));
    if (showToast) showToast("In-charge deleted successfully");
    setDeletingIncharge(null);
  }

  async function handleConfirmRemoveWard() {
    if (!removingWard) return;
    const { incharge, ward } = removingWard;
    const newWards = (incharge.wards || []).filter(w => w !== ward);
    setActionLoading(true);
    const { error: err } = await supabase.from("incharges").update({ wards: newWards }).eq("id", incharge.id);
    setActionLoading(false);
    if (err) {
      console.error("Error removing ward from incharge:", err);
      if (showToast) showToast("Error removing ward: " + err.message);
      else alert("Error removing ward: " + err.message);
      return;
    }
    setIncharges(prev => prev.map(inc => inc.id === incharge.id ? { ...inc, wards: newWards } : inc));
    if (showToast) showToast(`Ward "${ward}" removed from ${incharge.name}`);
    setRemovingWard(null);
  }

  function handleCopyEmail(email, id) {
    if (!email) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email).then(() => {
        setCopiedEmailId(id);
        setTimeout(() => setCopiedEmailId(null), 2000);
        if (showToast) showToast(`Email copied to clipboard`);
      }).catch(() => {});
    }
  }

  function handleHeaderSort(field) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "name" || field === "email");
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const list = incharges.filter(u => {
      const uWards = u.wards || [];
      const matchesQ = !q.trim() ||
        u.name?.toLowerCase().includes(q.toLowerCase()) ||
        u.email?.toLowerCase().includes(q.toLowerCase()) ||
        (u.phone && u.phone.includes(q)) ||
        uWards.some(w => w.toLowerCase().includes(q.toLowerCase()));

      let matchesWard = true;
      if (wardFilter === "unassigned") {
        matchesWard = uWards.length === 0;
      } else if (wardFilter !== "all") {
        matchesWard = uWards.includes(wardFilter);
      }

      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = uWards.length > 0;
      } else if (statusFilter === "unassigned") {
        matchesStatus = uWards.length === 0;
      }

      return matchesQ && matchesWard && matchesStatus;
    });

    list.sort((a, b) => {
      if (sortField === "name") {
        const res = (a.name || "").localeCompare(b.name || "");
        return sortAsc ? res : -res;
      }
      if (sortField === "email") {
        const res = (a.email || "").localeCompare(b.email || "");
        return sortAsc ? res : -res;
      }
      if (sortField === "wards") {
        const aLen = (a.wards || []).length;
        const bLen = (b.wards || []).length;
        return sortAsc ? aLen - bLen : bLen - aLen;
      }
      if (sortField === "status") {
        const aActive = (a.wards || []).length > 0 ? 1 : 0;
        const bActive = (b.wards || []).length > 0 ? 1 : 0;
        return sortAsc ? aActive - bActive : bActive - aActive;
      }
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    return list;
  }, [incharges, q, wardFilter, statusFilter, sortField, sortAsc]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  // Metrics
  const coveredWardsCount = useMemo(() => [...new Set(incharges.flatMap(u => u.wards || []))].length, [incharges]);
  const activeCount = useMemo(() => incharges.filter(u => (u.wards || []).length > 0).length, [incharges]);
  const unassignedCount = useMemo(() => incharges.filter(u => (u.wards || []).length === 0).length, [incharges]);

  return (
    <div>
      {/* Title & Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A", display: "flex", alignItems: "center", gap: 10 }}>
            Ward In-charges
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 10px", borderRadius: 99 }}>
              {incharges.length} registered
            </span>
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>Manage ward supervisors, clinical contacts, and department assignments.</p>
        </div>
        {onGoRegister && (
          <button
            type="button"
            onClick={onGoRegister}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
              color: "#FFFFFF",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.28)",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Register In-charge
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#BE123C", fontWeight: 600, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <div>Could not load in-charges: {error}</div>
            <div style={{ fontWeight: 400, marginTop: 4, fontSize: 12 }}>Make sure the <code>incharges</code> table exists and RLS policies allow reads, updates, and deletes.</div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: "Total In-charges", v: incharges.length, a: "#6366F1", icon: "🔑", sub: "Registered supervisors", onClick: null },
          { l: "Wards Covered", v: `${coveredWardsCount} / ${ALL_WARD_NAMES.length}`, a: "#F97316", icon: "🏥", sub: "Hospital clinical wards", onClick: null },
          { l: "Active Supervisors", v: activeCount, a: "#10B981", icon: "🛡️", sub: "Supervising clinical wards", onClick: () => { setStatusFilter(statusFilter === "active" ? "all" : "active"); setPage(1); } },
          { l: "Unassigned", v: unassignedCount, a: unassignedCount > 0 ? "#F43F5E" : "#64748B", icon: "⚠️", sub: unassignedCount > 0 ? "Requires ward allocation" : "All assigned ✓", onClick: () => { setStatusFilter(statusFilter === "unassigned" ? "all" : "unassigned"); setPage(1); } },
        ].map(m => (
          <div
            key={m.l}
            className="stat-metric-card"
            onClick={m.onClick}
            style={{ cursor: m.onClick ? "pointer" : "default" }}
            title={m.onClick ? "Click to filter" : undefined}
          >
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

      {/* Search and Filters Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          <div style={{ position: "relative", minWidth: 260, maxWidth: 360, flex: 1 }}>
            <svg width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={{ ...INP, paddingLeft: 36, paddingRight: q ? 32 : 12, padding: "10px 14px 10px 36px", background: "#fff", borderRadius: 10 }}
              placeholder="Search name, email, phone, or ward…"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
            />
            {q && (
              <button
                type="button"
                onClick={() => { setQ(""); setPage(1); }}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94A3B8", fontSize: 16, cursor: "pointer", padding: 2, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            )}
          </div>

          <FilterPills
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            options={[
              { val: "all", label: "All", count: incharges.length },
              { val: "active", label: "Active", count: activeCount },
              { val: "unassigned", label: "Unassigned", count: unassignedCount },
            ]}
          />

          <div style={{ position: "relative" }}>
            <select
              value={wardFilter}
              onChange={e => { setWardFilter(e.target.value); setPage(1); }}
              style={{
                ...INP,
                padding: "10px 32px 10px 14px",
                background: "#fff",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
                appearance: "none",
                width: "auto"
              }}
            >
              <option value="all">All Wards</option>
              <option value="unassigned">⚠️ Unassigned Only</option>
              {WARD_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.wards.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <div style={{ position: "relative" }}>
            <select
              value={sortField === "recent" ? "recent" : `${sortField}_${sortAsc ? "asc" : "desc"}`}
              onChange={e => {
                const val = e.target.value;
                if (val === "recent") {
                  setSortField("recent");
                  setSortAsc(false);
                } else {
                  const [f, d] = val.split("_");
                  setSortField(f);
                  setSortAsc(d === "asc");
                }
                setPage(1);
              }}
              style={{
                ...INP,
                padding: "10px 32px 10px 14px",
                background: "#fff",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
                appearance: "none",
                width: "auto"
              }}
            >
              <option value="recent">Sort: Recently added</option>
              <option value="name_asc">Sort: Name (A–Z)</option>
              <option value="name_desc">Sort: Name (Z–A)</option>
              <option value="wards_desc">Sort: Most wards</option>
              <option value="wards_asc">Sort: Fewest wards</option>
            </select>
            <svg width="12" height="12" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {(q || wardFilter !== "all" || statusFilter !== "all" || sortField !== "recent") && (
            <button
              type="button"
              onClick={() => { setQ(""); setWardFilter("all"); setStatusFilter("all"); setSortField("recent"); setSortAsc(false); setPage(1); }}
              style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#64748B", background: "#F1F5F9", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span>✕</span> Reset filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
            {filtered.length} {filtered.length === 1 ? "in-charge" : "in-charges"}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
          <div className="spin" style={{ width: 28, height: 28, border: "3px solid #E2E8F0", borderTopColor: "#6366F1", borderRadius: "50%", margin: "0 auto 12px" }} />
          Loading in-charges...
        </div>
      ) : (
        <div className="table-wrapper" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", background: "#fff" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>{incharges.length === 0 ? "No in-charges registered yet" : "No matching in-charges found"}</div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
                {incharges.length === 0 ? "Use the Register tab to add your first in-charge." : "Try adjusting your search query, status, or ward filter."}
              </div>
              {(q || wardFilter !== "all" || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => { setQ(""); setWardFilter("all"); setStatusFilter("all"); setPage(1); }}
                  style={{ marginTop: 16, padding: "8px 16px", background: "#EEF2FF", color: "#4338CA", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-scroll-wrapper">
              <table className="responsive-table incharges-table">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("name")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "name" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>In-charge</span>
                      <span style={{ fontSize: 12 }}>{sortField === "name" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("email")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "email" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Contact Info</span>
                      <span style={{ fontSize: 12 }}>{sortField === "email" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("wards")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "wards" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Assigned Wards</span>
                      <span style={{ fontSize: 12 }}>{sortField === "wards" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => handleHeaderSort("status")}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: sortField === "status" ? "#4338CA" : "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Status</span>
                      <span style={{ fontSize: 12 }}>{sortField === "status" ? (sortAsc ? "▲" : "▼") : "↕"}</span>
                    </div>
                  </th>
                  <th style={{ textAlign: "right", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u, i) => {
                  const uWards = u.wards || [];
                  const isAssigned = uWards.length > 0;
                  const isCopied = copiedEmailId === u.id;
                  return (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFC", borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" }} className="hover-row">
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ position: "relative" }}>
                            <div style={{
                              width: 42,
                              height: 42,
                              borderRadius: 12,
                              background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                              border: "1.5px solid #C7D2FE",
                              color: "#4338CA",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 800,
                              flexShrink: 0,
                              boxShadow: "0 2px 6px rgba(99,102,241,0.12)"
                            }}>
                              {(u.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span
                              style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                border: "2px solid #FFFFFF",
                                background: isAssigned ? "#10B981" : "#F59E0B"
                              }}
                              title={isAssigned ? "Assigned & Active" : "Unassigned"}
                            />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 14, letterSpacing: "-0.01em" }}>{u.name || "—"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.02em" }}>
                                Ward In-charge
                              </span>
                              {u.created_at && (
                                <span style={{ fontSize: 11, color: "#94A3B8" }}>
                                  · Added {fmtDate(u.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <a
                              href={`mailto:${u.email}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#334155", fontSize: 13, textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#6366F1"}
                              onMouseLeave={e => e.currentTarget.style.color = "#334155"}
                              title="Click to send email"
                            >
                              <svg width="13" height="13" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                              <span>{u.email}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(u.email, u.id)}
                              title="Copy email to clipboard"
                              style={{
                                background: isCopied ? "#ECFDF5" : "transparent",
                                border: isCopied ? "1px solid #A7F3D0" : "none",
                                borderRadius: 5,
                                padding: "2px 5px",
                                cursor: "pointer",
                                color: isCopied ? "#059669" : "#94A3B8",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: 11,
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { if (!isCopied) e.currentTarget.style.color = "#6366F1"; }}
                              onMouseLeave={e => { if (!isCopied) e.currentTarget.style.color = "#94A3B8"; }}
                            >
                              {isCopied ? (
                                <>
                                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                                  <span>Copied</span>
                                </>
                              ) : (
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              )}
                            </button>
                          </div>
                          {u.phone ? (
                            <a
                              href={`tel:${u.phone}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 12, textDecoration: "none", transition: "color 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#6366F1"}
                              onMouseLeave={e => e.currentTarget.style.color = "#64748B"}
                              title="Click to call phone"
                            >
                              <svg width="12" height="12" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                              <span>{u.phone}</span>
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: "#CBD5E1", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span>•</span> No phone registered
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {!isAssigned ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#B45309", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              No wards assigned
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingIncharge(u)}
                              style={{
                                background: "#EEF2FF",
                                border: "1px solid #C7D2FE",
                                color: "#4338CA",
                                padding: "3px 9px",
                                borderRadius: 7,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#6366F1"; e.currentTarget.style.color = "#fff"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#EEF2FF"; e.currentTarget.style.color = "#4338CA"; }}
                            >
                              + Assign ward
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 420, alignItems: "center" }}>
                            {uWards.map(w => {
                              const info = WARD_LOOKUP[w];
                              return (
                                <span
                                  key={w}
                                  className="ward-badge-pill"
                                  style={{
                                    background: info?.color || "#F1F5F9",
                                    color: info?.textColor || "#334155",
                                    border: "1px solid " + (info?.accent || "#CBD5E1") + "40"
                                  }}
                                >
                                  {w}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRemovingWard({ incharge: u, ward: w });
                                    }}
                                    title={`Remove ${w} from ${u.name}`}
                                    style={{
                                      background: "rgba(0,0,0,0.06)",
                                      border: "none",
                                      borderRadius: "50%",
                                      width: 16,
                                      height: 16,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      color: "inherit",
                                      fontSize: 11,
                                      lineHeight: 1,
                                      padding: 0,
                                      transition: "background 0.15s"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.18)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.06)"}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setEditingIncharge(u)}
                              title="Add another ward"
                              style={{
                                background: "#F8FAFC",
                                border: "1px dashed #CBD5E1",
                                borderRadius: 99,
                                padding: "3px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#64748B",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366F1"; e.currentTarget.style.color = "#4338CA"; e.currentTarget.style.background = "#EEF2FF"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.color = "#64748B"; e.currentTarget.style.background = "#F8FAFC"; }}
                            >
                              + Add
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {isAssigned ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 99 }}>
                            <span className="status-dot-pulse" />
                            Active · {uWards.length} {uWards.length === 1 ? "ward" : "wards"}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECDD3", fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 99 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444" }} />
                            Needs Ward
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px 18px", verticalAlign: "middle", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            className="action-btn-secondary"
                            onClick={() => setEditingIncharge(u)}
                            title="Edit in-charge & wards"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn-danger"
                            onClick={() => setDeletingIncharge(u)}
                            title="Delete in-charge profile"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={setPerPage}
            itemsPerPageOptions={[5, 8, 15, 25]}
            itemLabel="in-charges"
          />
        </div>
      )}

      {/* Edit In-charge Modal */}
      {editingIncharge && (
        <EditInchargeModal
          incharge={editingIncharge}
          onSave={handleSaveIncharge}
          onDelete={(u) => {
            setEditingIncharge(null);
            setDeletingIncharge(u);
          }}
          onCancel={() => setEditingIncharge(null)}
        />
      )}

      {/* Delete In-charge Confirm Modal */}
      {deletingIncharge && (
        <ConfirmModal
          isOpen={true}
          title="Delete In-charge"
          message={`Are you sure you want to delete in-charge "${deletingIncharge.name}" (${deletingIncharge.email})? This will permanently remove their supervisor profile and unassign their ward supervision.`}
          confirmText="Delete In-charge"
          loading={actionLoading}
          onConfirm={() => handleDeleteIncharge(deletingIncharge.id)}
          onCancel={() => setDeletingIncharge(null)}
        />
      )}

      {/* Quick remove ward Confirm Modal */}
      {removingWard && (
        <ConfirmModal
          isOpen={true}
          title="Remove Assigned Ward"
          message={`Are you sure you want to remove ward "${removingWard.ward}" from in-charge ${removingWard.incharge.name}?`}
          confirmText="Remove Ward"
          loading={actionLoading}
          onConfirm={handleConfirmRemoveWard}
          onCancel={() => setRemovingWard(null)}
        />
      )}
    </div>
  );
}
