import React, { useState, useMemo } from "react";
import Avatar from "../../components/common/Avatar";
import { GroupBadge } from "../../components/common/Badge";
import FilterPills from "../../components/common/FilterPills";
import Pagination from "../../components/common/Pagination";

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

export function MembersTab({ members, assignments }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(
    () =>
      members.filter(
        (m) =>
          (m.name.toLowerCase().includes(q.toLowerCase()) ||
            m.school.toLowerCase().includes(q.toLowerCase())) &&
          (filter === "all" || m.group === filter)
      ),
    [members, q, filter]
  );

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>
          Members
        </h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>
          All registered nurses and midwives.
        </p>
      </div>

      <div className="members-grid">
        {[
          { l: "Total Members", v: members.length, a: "#6366F1", icon: "👥" },
          {
            l: "General Nursing",
            v: members.filter((m) => m.group === "nursing").length,
            a: "#3B82F6",
            icon: "🏥",
          },
          {
            l: "Midwifery",
            v: members.filter((m) => m.group === "midwifery").length,
            a: "#10B981",
            icon: "👶",
          },
        ].map((m) => (
          <div
            key={m.l}
            className="premium-card"
            style={{ padding: "20px", position: "relative", overflow: "hidden", borderRadius: 16 }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: m.a }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {m.l}
              </div>
              <div style={{ fontSize: 20, opacity: 0.8 }}>{m.icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{m.v}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...INP, maxWidth: 280, width: "auto", padding: "10px 14px", background: "#fff" }}
            placeholder="Search name or school…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <FilterPills
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setPage(1);
            }}
            options={[
              { val: "all", label: "All" },
              { val: "nursing", label: "Nursing" },
              { val: "midwifery", label: "Midwifery" },
            ]}
          />
        </div>
        <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </div>
      </div>

      <div
        className="table-wrapper"
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          background: "#fff",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members found</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              {members.length === 0
                ? "You haven't registered any members yet."
                : "No members match your current filter and search."}
            </div>
          </div>
        ) : (
          <>
            <div className="table-scroll-wrapper">
              <table className="responsive-table members-table">
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                    {["Member", "Institution", "Phone", "Group", "Assignments"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "14px 18px",
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
                  {paginated.map((m, i) => {
                    const count = assignments.filter((a) => a.memberId === m.id).length;
                    return (
                      <tr
                        key={m.id}
                        style={{
                          background: i % 2 === 0 ? "#fff" : "#FAFAFC",
                          borderBottom: "1px solid #F1F5F9",
                          transition: "background 0.2s",
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar name={m.name} group={m.group} size={36} />
                            <span style={{ fontWeight: 700, color: "#0F172A" }}>{m.name}</span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "16px 18px",
                            color: "#64748B",
                            verticalAlign: "middle",
                            fontSize: 13,
                          }}
                        >
                          {m.school}
                        </td>
                        <td
                          style={{
                            padding: "16px 18px",
                            color: "#64748B",
                            verticalAlign: "middle",
                            fontSize: 13,
                          }}
                        >
                          {m.phone}
                        </td>
                        <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                          <GroupBadge group={m.group} />
                        </td>
                        <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                          <span
                            style={{
                              background: count > 0 ? "#ECFDF5" : "#FFF7ED",
                              color: count > 0 ? "#065F46" : "#9A3412",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 99,
                            }}
                          >
                            {count > 0 ? `${count} wards` : "Unassigned"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={setPerPage}
              itemsPerPageOptions={[5, 10, 20, 50]}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default MembersTab;
