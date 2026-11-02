import React, { useState, useMemo } from "react";
import Avatar from "../../components/common/Avatar";
import { GroupBadge, StatusChip } from "../../components/common/Badge";
import Pagination from "../../components/common/Pagination";
import { WARD_LOOKUP } from "../../constants/wardGroups";
import { fmtDate } from "../../utils/dates";

export default function MemberDashboardTab({ user, members, assignments }) {
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

  const [pastPage, setPastPage] = useState(1);
  const [pastPerPage, setPastPerPage] = useState(5);
  const paginatedPast = useMemo(() => {
    const start = (pastPage - 1) * pastPerPage;
    return past.slice(start, start + pastPerPage);
  }, [past, pastPage, pastPerPage]);

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
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                  Past History ({past.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {paginatedPast.map(a => <AssignmentCard key={a.id} a={a} />)}
                </div>
                {past.length > pastPerPage && (
                  <div style={{ marginTop: 14, background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
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
