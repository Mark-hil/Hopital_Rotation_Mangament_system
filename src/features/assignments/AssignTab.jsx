import React, { useState, useMemo } from "react";
import { WARD_GROUPS, WARD_LOOKUP } from "../../constants/wardGroups";
import { weeksFor, getLatestPlacement } from "../../utils/rotationRules";
import { fmtDate, addWeeks } from "../../utils/dates";
import Avatar from "../../components/common/Avatar";
import { GroupBadge } from "../../components/common/Badge";
import Checkbox from "../../components/common/Checkbox";
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

export function AssignTab({ members, assignments, onBulkAssign, initialTargetIds }) {
  const targetMember =
    initialTargetIds?.length === 1 ? members.find((m) => m.id === initialTargetIds[0]) : null;
  const [selectedIds, setSelectedIds] = useState(new Set(initialTargetIds || []));
  const [filterGroup, setFilterGroup] = useState("all");
  const [search, setSearch] = useState(targetMember ? targetMember.name : "");
  const [selectedWardName, setSelectedWardName] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);

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

  const visibleMembers = useMemo(
    () =>
      members.filter((m) => {
        const gm = filterGroup === "all" || m.group === filterGroup;
        const sm =
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.school.toLowerCase().includes(search.toLowerCase());
        return gm && sm;
      }),
    [members, filterGroup, search]
  );

  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * perPage;
    return visibleMembers.slice(start, start + perPage);
  }, [visibleMembers, page, perPage]);

  function toggle(id) {
    setSelectedIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setSelectedWardName(null);
  }

  function toggleAll() {
    const allSel = visibleMembers.every((m) => selectedIds.has(m.id));
    setSelectedIds(allSel ? new Set() : new Set(visibleMembers.map((m) => m.id)));
    setSelectedWardName(null);
  }

  function wardStatus(wardName) {
    const rel = selectedMembers.filter((m) => weeksFor(m.group, wardName) > 0);
    if (!rel.length) return "none";
    const done = rel.filter((m) =>
      assignments.some((a) => a.memberId === m.id && a.ward === wardName)
    );
    if (done.length === rel.length) return "all";
    if (done.length > 0) return "some";
    return "none";
  }

  const ap = selectedMembers.map((m) => ({
    ...m,
    weeks: weeksFor(m.group, selectedWardName),
    alreadyAssigned: assignments.some(
      (a) => a.memberId === m.id && a.ward === selectedWardName
    ),
  }));
  const assignable = ap.filter((m) => m.weeks > 0 && !m.alreadyAssigned);

  function confirmAssign() {
    if (!selectedWardName || !assignable.length) return;
    const list = assignable.map((m) => ({
      id: Date.now() + Math.random(),
      memberId: m.id,
      memberName: m.name,
      group: m.group,
      ward: selectedWardName,
      weeks: m.weeks,
      startDate,
      endDate: addWeeks(startDate, m.weeks),
    }));
    onBulkAssign(list);
    setSelectedIds(new Set());
    setSelectedWardName(null);
  }

  const swd = selectedWardName ? WARD_LOOKUP[selectedWardName] : null;
  const completedIds = new Set(
    members
      .filter((m) => getLatestPlacement(m.id, assignments)?.status === "completed")
      .map((m) => m.id)
  );

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>
          Assign ward placement
        </h2>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>
          Select any mix of members — weeks auto-adjust per each member's programme.
        </p>
      </div>
      <div className="assign-layout">
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input
              style={{ ...INP, maxWidth: 220, flex: 1, padding: "10px 14px", background: "#fff" }}
              placeholder="Search members…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <FilterPills
              value={filterGroup}
              onChange={(v) => {
                setFilterGroup(v);
                setPage(1);
              }}
              options={[
                { val: "all", label: "All" },
                { val: "nursing", label: "Nursing" },
                { val: "midwifery", label: "Midwifery" },
              ]}
            />
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectedWardName(null);
                }}
                style={{
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 99,
                  border: "1.5px solid #FCA5A5",
                  background: "#FFF1F2",
                  color: "#BE123C",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FFE4E6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#FFF1F2")}
              >
                Clear ({selectedIds.size})
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <div
              className="premium-card"
              style={{ padding: "60px 40px", textAlign: "center", color: "#94A3B8", borderRadius: 16 }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No members registered</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Go to the Register tab to add your first member.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  background: "rgba(248, 250, 252, 0.5)",
                }}
              >
                <Checkbox
                  checked={
                    visibleMembers.length > 0 &&
                    visibleMembers.every((m) => selectedIds.has(m.id))
                  }
                  indeterminate={
                    visibleMembers.some((m) => selectedIds.has(m.id)) &&
                    !visibleMembers.every((m) => selectedIds.has(m.id))
                  }
                  onChange={toggleAll}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </span>
                {isMixed && (
                  <span
                    style={{
                      fontSize: 11,
                      background: "#EEF2FF",
                      color: "#4338CA",
                      padding: "4px 10px",
                      borderRadius: 99,
                      fontWeight: 700,
                      marginLeft: "auto",
                    }}
                  >
                    Mixed — weeks auto-adjust ✓
                  </span>
                )}
              </div>
              {visibleMembers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94A3B8" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No matching members</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your search query or group filter.</div>
                </div>
              ) : (
                paginatedMembers.map((m) => {
                  const isSel = selectedIds.has(m.id);
                  const isDone = completedIds.has(m.id);
                  const preview = isSel && selectedWardName ? weeksFor(m.group, selectedWardName) : null;
                  const alreadyHas =
                    isSel &&
                    selectedWardName &&
                    assignments.some((a) => a.memberId === m.id && a.ward === selectedWardName);
                  const latest = getLatestPlacement(m.id, assignments);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 20px",
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        background: isSel ? "#EEF2FF" : isDone ? "#FFF1F2" : "#fff",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel && !isDone) e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel && !isDone) e.currentTarget.style.background = "#fff";
                      }}
                    >
                      <Checkbox checked={isSel} onChange={() => toggle(m.id)} />
                      <Avatar name={m.name} group={m.group} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#0F172A",
                          }}
                        >
                          {m.name}
                          {isDone && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "#FFF1F2",
                                color: "#BE123C",
                                padding: "2px 8px",
                                borderRadius: 99,
                                fontWeight: 700,
                              }}
                            >
                              Completed
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748B",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {latest ? `${latest.ward} · ends ${fmtDate(latest.endDate)}` : m.school}
                        </div>
                      </div>
                      <GroupBadge group={m.group} />
                      {isSel && selectedWardName ? (
                        preview > 0 ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 99,
                              background: alreadyHas ? "#F1F5F9" : "#ECFDF5",
                              color: alreadyHas ? "#94A3B8" : "#065F46",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {alreadyHas ? "done" : `${preview}w`}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              padding: "4px 12px",
                              borderRadius: 99,
                              background: "#F1F5F9",
                              color: "#94A3B8",
                            }}
                          >
                            N/A
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>
                          {assignments.filter((a) => a.memberId === m.id).length} wards
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              <Pagination
                currentPage={page}
                totalItems={visibleMembers.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
                itemsPerPageOptions={[5, 8, 15, 25]}
                itemLabel="members"
              />
            </div>
          )}
        </div>

        <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedIds.size > 0 && (
            <div className="premium-card" style={{ padding: "24px", borderRadius: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: 12,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                SELECTED ({selectedIds.size})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedMembers.map((m) => (
                  <div
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(m.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "6px 12px",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                  >
                    <Avatar name={m.name} group={m.group} size={20} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                      {m.name.split(" ")[0]}
                    </span>
                    <span style={{ color: "#94A3B8", fontSize: 14, marginLeft: 2 }}>×</span>
                  </div>
                ))}
              </div>
              {isMixed && (
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      background: "#EEF2FF",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#4338CA" }}>
                      🏥 Nursing ({selectedMembers.filter((m) => m.group === "nursing").length})
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#F0FDF4",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#166534" }}>
                      👶 Midwifery ({selectedMembers.filter((m) => m.group === "midwifery").length})
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedIds.size > 0 && (
            <div
              className="premium-card"
              style={{ padding: "24px", maxHeight: 400, overflowY: "auto", borderRadius: 16 }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: 16,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                CHOOSE WARD
              </div>
              {visibleWardGroups.map((grp) => (
                <div key={grp.group} style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{grp.group}</span>
                    <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
                  </div>
                  <div className="wards-grid">
                    {grp.wards.map((w) => {
                      const st = wardStatus(w.name);
                      const sel = selectedWardName === w.name;
                      return (
                        <div
                          key={w.name}
                          onClick={() => st !== "all" && setSelectedWardName(sel ? null : w.name)}
                          style={{
                            border: sel ? `2px solid ${grp.accent}` : "1px solid #E2E8F0",
                            background: sel ? grp.color : st === "all" ? "#F8FAFC" : "#fff",
                            borderRadius: 10,
                            padding: "10px 12px",
                            cursor: st === "all" ? "default" : "pointer",
                            opacity: st === "all" ? 0.45 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: sel ? grp.textColor : "#334155",
                            }}
                          >
                            {w.name}
                          </div>
                          {isMixed ? (
                            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {w.nursing > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    background: "#EEF2FF",
                                    color: "#4338CA",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                  }}
                                >
                                  N:{w.nursing}w
                                </span>
                              )}
                              {w.midwifery > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    background: "#F0FDF4",
                                    color: "#166534",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                  }}
                                >
                                  M:{w.midwifery}w
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, fontWeight: 600 }}>
                              {selectedMembers[0] ? w[selectedMembers[0].group] : w.nursing} weeks
                              {st === "some" ? " · some done" : ""}
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
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: 12,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                CONFIRM
              </div>
              <div
                style={{
                  background: swd?.color || "#F8FAFC",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 16,
                  border: `1px solid ${swd?.accent}30`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: swd?.textColor || "#0F172A" }}>
                  {selectedWardName}
                </div>
                <div style={{ fontSize: 12, color: swd?.textColor || "#64748B", marginTop: 4 }}>
                  {assignable.length} member{assignable.length > 1 ? "s" : ""} to assign
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                {ap.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    <Avatar name={m.name} group={m.group} size={28} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        flex: 1,
                        color: m.alreadyAssigned || m.weeks === 0 ? "#94A3B8" : "#0F172A",
                      }}
                    >
                      {m.name.split(" ")[0]}
                    </span>
                    <GroupBadge group={m.group} />
                    {m.alreadyAssigned ? (
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>done</span>
                    ) : m.weeks === 0 ? (
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>N/A</span>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          background: "#ECFDF5",
                          color: "#065F46",
                          padding: "3px 10px",
                          borderRadius: 99,
                        }}
                      >
                        {m.weeks}w
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: 6,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                START DATE
              </label>
              <input
                type="date"
                style={{
                  ...INP,
                  padding: "12px 14px",
                  marginBottom: 20,
                  background: "#F8FAFC",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
                }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <button
                type="button"
                onClick={confirmAssign}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#6366F1",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.2)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                Assign {assignable.length} member{assignable.length > 1 ? "s" : ""} →
              </button>
            </div>
          )}

          {selectedIds.size === 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px dashed #CBD5E1",
                padding: "60px 30px",
                textAlign: "center",
                color: "#94A3B8",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#475569" }}>Select members first</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Choose members from the left panel to configure their placement.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssignTab;
