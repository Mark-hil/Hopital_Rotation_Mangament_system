import React, { useState, useMemo } from "react";
import Avatar from "../../components/common/Avatar";
import { GroupBadge, StatusChip } from "../../components/common/Badge";
import FilterPills from "../../components/common/FilterPills";
import Pagination from "../../components/common/Pagination";
import StatCard from "../dashboard/StatCard";
import { WARD_LOOKUP } from "../../constants/wardGroups";
import { fmtDate, daysLeft } from "../../utils/dates";

const INP = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13.5,
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  background: "#FFFFFF",
  color: "#0F172A",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export function InChargeMemberRow({ a, i, cols }) {
  return (
    <tr style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={a.member.name} group={a.member.group} size={34} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{a.member.name}</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>{a.member.school}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
        <GroupBadge group={a.member.group} />
      </td>
      <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 13, verticalAlign: "middle" }}>
        {fmtDate(a.startDate)}
      </td>
      <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 13, verticalAlign: "middle" }}>
        {fmtDate(a.endDate)}
      </td>
      {cols === "full" && (
        <>
          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
            <span style={{ fontWeight: 700, color: a.daysLeft <= 7 ? "#EA580C" : "#334155", fontSize: 13 }}>
              {a.daysLeft === 0 ? "Today" : a.daysLeft + "d"}
            </span>
          </td>
          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
            <StatusChip status={a.status} />
          </td>
        </>
      )}
    </tr>
  );
}

export default function InChargeTab({ user, members, assignments }) {
  const wards = user.wards || [];
  const [activeWard, setActiveWard] = useState("all");

  function enrichForWard(wardName) {
    const now = new Date();
    return assignments
      .filter((a) => a.ward === wardName)
      .map((a) => {
        const member = members.find((m) => m.id === a.memberId);
        if (!member) return null;
        const dl = daysLeft(a.endDate);
        const ds = Math.ceil((new Date(a.startDate) - now) / (1000 * 60 * 60 * 24));
        let status;
        if (ds > 0) status = "upcoming";
        else if (dl < 0) status = "completed";
        else if (dl === 0) status = "completing_today";
        else if (dl <= 7) status = "ending_soon";
        else status = "active";
        return { ...a, member, status, daysLeft: dl };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }

  const wardData = useMemo(
    () => wards.map((w) => ({ ward: w, wd: WARD_LOOKUP[w], rows: enrichForWard(w) })),
    [assignments, members, wards]
  );

  const singleData = useMemo(() => {
    if (activeWard === "all") return null;
    return wardData.find((d) => d.ward === activeWard) || null;
  }, [activeWard, wardData]);

  if (wards.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>No wards assigned</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Contact your hospital administrator to assign wards to your supervisor account.
        </div>
      </div>
    );
  }

  const WardTable = ({ rows, showWardCol }) => {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(8);

    const activeCount = useMemo(
      () => rows.filter((a) => ["active", "ending_soon", "completing_today"].includes(a.status)).length,
      [rows]
    );
    const upcomingCount = useMemo(() => rows.filter((a) => a.status === "upcoming").length, [rows]);

    const filtered = useMemo(() => {
      return rows.filter((a) => {
        const matchesSearch =
          !search.trim() ||
          a.member.name?.toLowerCase().includes(search.toLowerCase()) ||
          a.member.school?.toLowerCase().includes(search.toLowerCase()) ||
          (showWardCol && a.ward?.toLowerCase().includes(search.toLowerCase()));

        let matchesStatus = true;
        if (statusFilter === "current") {
          matchesStatus = ["active", "ending_soon", "completing_today"].includes(a.status);
        } else if (statusFilter === "upcoming") {
          matchesStatus = a.status === "upcoming";
        }

        return matchesSearch && matchesStatus;
      });
    }, [rows, search, statusFilter, showWardCol]);

    const paginated = useMemo(() => {
      const start = (page - 1) * perPage;
      return filtered.slice(start, start + perPage);
    }, [filtered, page, perPage]);

    if (rows.length === 0) {
      return (
        <div
          style={{
            padding: "36px 20px",
            textAlign: "center",
            color: "#94A3B8",
            background: "#F8FAFC",
            borderRadius: 12,
            border: "1px dashed #E2E8F0",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>No trainees assigned yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>No members are currently scheduled for this ward.</div>
        </div>
      );
    }

    const headers = showWardCol
      ? ["Member", "Ward", "Group", "Started", "Ends", "Days left", "Status"]
      : ["Member", "Group", "Started", "Ends", "Days left", "Status"];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.length > 2 && (
          <div className="dashboard-toolbar" style={{ marginBottom: 0 }}>
            <div className="dashboard-toolbar-left">
              <div className="dashboard-search-box">
                <input
                  style={{ ...INP, padding: "8px 12px 8px 32px", fontSize: 12.5 }}
                  placeholder="Search member or school…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <svg
                  width="13"
                  height="13"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <FilterPills
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={[
                  { val: "all", label: "All", count: rows.length },
                  { val: "current", label: "Current", count: activeCount },
                  { val: "upcoming", label: "Upcoming", count: upcomingCount },
                ]}
              />
            </div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              {filtered.length} {filtered.length === 1 ? "member" : "members"}
            </div>
          </div>
        )}

        <div
          className="table-wrapper"
          style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #E2E8F0", background: "#fff" }}
        >
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 20px", color: "#94A3B8" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No matching members</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing your search query or status filter.</div>
            </div>
          ) : (
            <>
              <div className="desktop-table-view">
                <div className="table-scroll-wrapper">
                  <table className="responsive-table">
                    <thead>
                      <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                        {headers.map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#64748B",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((a, i) => (
                        <tr
                          key={a.id}
                          style={{
                            background: i % 2 === 0 ? "#fff" : "#FAFAFA",
                            borderBottom: "1px solid #F1F5F9",
                          }}
                          className="hover-row"
                        >
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={a.member.name} group={a.member.group} size={34} />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>
                                  {a.member.name}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                                  {a.member.school}
                                </div>
                              </div>
                            </div>
                          </td>
                          {showWardCol && (
                            <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: WARD_LOOKUP[a.ward]?.textColor || "#334155",
                                  background: WARD_LOOKUP[a.ward]?.color || "#F8FAFC",
                                  padding: "3px 10px",
                                  borderRadius: 99,
                                }}
                              >
                                {a.ward}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <GroupBadge group={a.member.group} />
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              color: "#64748B",
                              fontSize: 13,
                              verticalAlign: "middle",
                            }}
                          >
                            {fmtDate(a.startDate)}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              color: "#64748B",
                              fontSize: 13,
                              verticalAlign: "middle",
                            }}
                          >
                            {fmtDate(a.endDate)}
                          </td>
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: a.daysLeft <= 7 ? "#EA580C" : "#334155",
                                fontSize: 13,
                              }}
                            >
                              {a.daysLeft === 0 ? "Today" : a.daysLeft + "d"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <StatusChip status={a.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mobile-cards-view">
                {paginated.map((a) => (
                  <div key={a.id} className="mobile-roster-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <Avatar name={a.member.name} group={a.member.group} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: "#0F172A" }}>
                            {a.member.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748B" }}>{a.member.school}</div>
                        </div>
                      </div>
                      <StatusChip status={a.status} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                        fontSize: 12,
                        color: "#475569",
                        paddingTop: 6,
                        borderTop: "1px solid #F1F5F9",
                      }}
                    >
                      <GroupBadge group={a.member.group} />
                      <span>
                        {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                      </span>
                      <span style={{ fontWeight: 700, color: a.daysLeft <= 7 ? "#EA580C" : "#334155" }}>
                        {a.daysLeft === 0 ? "Today" : `${a.daysLeft}d`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={setPerPage}
            itemsPerPageOptions={[5, 8, 15, 25]}
            itemLabel="members"
          />
        </div>
      </div>
    );
  };

  const totalActive = wardData.reduce(
    (s, d) => s + d.rows.filter((a) => ["active", "ending_soon", "completing_today"].includes(a.status)).length,
    0
  );
  const totalEndingSoon = wardData.reduce(
    (s, d) => s + d.rows.filter((a) => ["ending_soon", "completing_today"].includes(a.status)).length,
    0
  );
  const totalUpcoming = wardData.reduce(
    (s, d) => s + d.rows.filter((a) => a.status === "upcoming").length,
    0
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }} className="fadeIn">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title-text">Supervisor Ward Command</h2>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            Monitor trainees currently placed or scheduled across your assigned hospital units.
          </p>
        </div>
      </div>

      {/* Supervisor KPI Strip */}
      <div className="incharge-kpi-grid">
        <StatCard
          title="Current Trainees"
          value={totalActive}
          badge={`Across ${wards.length} ${wards.length === 1 ? "Ward" : "Wards"}`}
          subtitle="Active clinical placements"
          accentColor="#10B981"
          iconBg="#ECFDF5"
          textColor="#065F46"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          }
        />
        <StatCard
          title="Ending Within 7 Days"
          value={totalEndingSoon}
          badge={totalEndingSoon > 0 ? "Handover Soon" : "None Due"}
          subtitle="Completing rotation shortly"
          accentColor="#F59E0B"
          iconBg="#FFFBEB"
          textColor="#92400E"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          title="Upcoming Arrivals"
          value={totalUpcoming}
          badge="Scheduled"
          subtitle="Future ward placements"
          accentColor="#6366F1"
          iconBg="#EEF2FF"
          textColor="#3730A3"
          icon={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
      </div>

      {/* Ward Filter Tabs */}
      <div className="dept-filter-strip" style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setActiveWard("all")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 99,
            cursor: "pointer",
            border: activeWard === "all" ? "2px solid #6366F1" : "1.5px solid #E2E8F0",
            background: activeWard === "all" ? "#EEF2FF" : "#fff",
            color: activeWard === "all" ? "#4338CA" : "#64748B",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          All Assigned Wards
          <span
            style={{
              background: activeWard === "all" ? "#6366F1" : "#E2E8F0",
              color: activeWard === "all" ? "#fff" : "#64748B",
              fontSize: 10.5,
              fontWeight: 700,
              padding: "1px 7px",
              borderRadius: 99,
            }}
          >
            {totalActive}
          </span>
        </button>
        {wardData.map(({ ward, wd, rows }) => {
          const isSel = activeWard === ward;
          const cnt = rows.filter((a) =>
            ["active", "ending_soon", "completing_today"].includes(a.status)
          ).length;
          return (
            <button
              key={ward}
              type="button"
              onClick={() => setActiveWard(ward)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 99,
                cursor: "pointer",
                border: isSel ? "2px solid " + (wd?.accent || "#6366F1") : "1.5px solid #E2E8F0",
                background: isSel ? wd?.color || "#EEF2FF" : "#fff",
                color: isSel ? wd?.textColor || "#4338CA" : "#64748B",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              {ward}
              <span
                style={{
                  background: isSel ? wd?.accent || "#6366F1" : "#E2E8F0",
                  color: isSel ? "#fff" : "#64748B",
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 99,
                }}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {activeWard === "all" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {wardData.map(({ ward, wd, rows }) => (
            <div key={ward} className="dashboard-section-card" style={{ marginBottom: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: "2px solid " + (wd?.accent || "#E2E8F0") + "30",
                }}
              >
                {wd && <div style={{ width: 10, height: 10, borderRadius: 3, background: wd.accent }} />}
                <span style={{ fontSize: 16, fontWeight: 800, color: wd?.textColor || "#0F172A" }}>
                  {ward}
                </span>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                  ·{" "}
                  {
                    rows.filter((a) =>
                      ["active", "ending_soon", "completing_today"].includes(a.status)
                    ).length
                  }{" "}
                  active
                </span>
              </div>
              <WardTable rows={rows} showWardCol={false} />
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-section-card" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            {singleData?.wd && (
              <div style={{ width: 12, height: 12, borderRadius: 3, background: singleData.wd.accent }} />
            )}
            <span style={{ fontSize: 18, fontWeight: 800, color: singleData?.wd?.textColor || "#0F172A" }}>
              {activeWard}
            </span>
            <span style={{ fontSize: 12.5, color: "#64748B", fontWeight: 600 }}>
              ·{" "}
              {singleData?.rows.filter((a) =>
                ["active", "ending_soon", "completing_today"].includes(a.status)
              ).length || 0}{" "}
              current, {singleData?.rows.filter((a) => a.status === "upcoming").length || 0} upcoming
            </span>
          </div>
          <WardTable rows={singleData?.rows || []} showWardCol={false} />
        </div>
      )}
    </div>
  );
}
