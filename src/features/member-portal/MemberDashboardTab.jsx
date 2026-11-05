import React, { useState, useMemo } from "react";
import Avatar from "../../components/common/Avatar";
import { GroupBadge, StatusChip } from "../../components/common/Badge";
import Pagination from "../../components/common/Pagination";
import { WARD_LOOKUP } from "../../constants/wardGroups";
import { TOTAL_WEEKS } from "../../utils/rotationRules";
import { fmtDate } from "../../utils/dates";

export default function MemberDashboardTab({ user, members, assignments }) {
  const member = members.find((m) => m.auth_id === user.id);
  const internalMemberId = member?.id;
  const myAssignments = assignments
    .filter((a) => a.memberId === internalMemberId)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  const [pastPage, setPastPage] = useState(1);
  const [pastPerPage, setPastPerPage] = useState(5);

  if (!member) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>
        Loading your clinical profile...
      </div>
    );
  }

  const enrichedAssignments = myAssignments.map((a) => {
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
    return { ...a, wd, status, diffDays };
  });

  const active = enrichedAssignments.filter((a) =>
    ["active", "ending_soon", "completing_today"].includes(a.status)
  );
  const upcoming = enrichedAssignments.filter((a) => a.status === "upcoming");
  const past = enrichedAssignments.filter((a) => a.status === "completed");

  const targetWeeks = TOTAL_WEEKS[member.group] || 52;
  const completedWeeks = myAssignments.reduce((sum, a) => sum + (a.weeks || 0), 0);
  const progressPct = Math.min(100, Math.round((completedWeeks / targetWeeks) * 100));

  const start = (pastPage - 1) * pastPerPage;
  const paginatedPast = past.slice(start, start + pastPerPage);

  const AssignmentCard = ({ a }) => {
    const isActive = ["active", "ending_soon", "completing_today"].includes(a.status);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 18px",
          background: isActive ? "#F0FDF4" : "#F8FAFC",
          border: "1px solid",
          borderColor: isActive ? "#BBF7D0" : "#E2E8F0",
          borderRadius: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: a.wd?.accent || "#CBD5E1",
                flexShrink: 0,
              }}
            />
            <div style={{ fontWeight: 800, fontSize: 14.5, color: a.wd?.textColor || "#0F172A" }}>
              {a.ward}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748B",
                background: "#fff",
                padding: "1px 7px",
                borderRadius: 99,
                border: "1px solid #E2E8F0",
              }}
            >
              {a.weeks} {a.weeks === 1 ? "week" : "weeks"}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "#64748B", fontWeight: 500 }}>
            {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isActive && a.diffDays >= 0 && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: a.diffDays <= 7 ? "#EA580C" : "#059669",
              }}
            >
              {a.diffDays === 0 ? "Completes today" : `${a.diffDays}d remaining`}
            </span>
          )}
          <StatusChip status={a.status} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }} className="fadeIn">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title-text">
            Welcome back, {member.name.split(" ")[0]}!
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            Track your clinical rotation schedule, active ward placement, and 52-week curriculum progress.
          </p>
        </div>
      </div>

      <div className="premium-card member-portal-card">
        {/* Profile & Curriculum Progress Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
            paddingBottom: 22,
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={member.name} group={member.group} size={56} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#0F172A" }}>{member.name}</div>
              <div
                style={{
                  fontSize: 13.5,
                  color: "#64748B",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span>{member.school}</span>
                <span style={{ color: "#CBD5E1" }}>•</span>
                <GroupBadge group={member.group} />
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              padding: "12px 16px",
              minWidth: 220,
              flex: "1 1 220px",
              maxWidth: 320,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Curriculum Progress
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#4338CA" }}>
                {completedWeeks} / {targetWeeks}w ({progressPct}%)
              </span>
            </div>
            <div style={{ height: 7, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #6366F1, #10B981)",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>

        {enrichedAssignments.length === 0 ? (
          <div
            style={{
              padding: "44px 20px",
              textAlign: "center",
              color: "#94A3B8",
              background: "#F8FAFC",
              borderRadius: 14,
              border: "1.5px dashed #E2E8F0",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>No placements yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              You have not been assigned to any hospital wards yet.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {active.length > 0 && (
              <div>
                <h4
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#065F46",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span className="status-dot-pulse" />
                  Current Ward Placement
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {active.map((a) => (
                    <AssignmentCard key={a.id} a={a} />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h4
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#4338CA",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                  }}
                >
                  Upcoming Scheduled Rotations ({upcoming.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {upcoming.map((a) => (
                    <AssignmentCard key={a.id} a={a} />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h4
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                  }}
                >
                  Completed Rotation History ({past.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {paginatedPast.map((a) => (
                    <AssignmentCard key={a.id} a={a} />
                  ))}
                </div>
                {past.length > pastPerPage && (
                  <div
                    style={{
                      marginTop: 14,
                      background: "#fff",
                      borderRadius: 12,
                      border: "1px solid #E2E8F0",
                      overflow: "hidden",
                    }}
                  >
                    <Pagination
                      currentPage={pastPage}
                      totalItems={past.length}
                      itemsPerPage={pastPerPage}
                      onPageChange={setPastPage}
                      onItemsPerPageChange={setPastPerPage}
                      itemsPerPageOptions={[5, 10, 20]}
                      itemLabel="past rotations"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
