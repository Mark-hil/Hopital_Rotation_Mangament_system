import React from "react";
import { getNavForRole } from "../../constants/navigation";

export function Sidebar({
  user,
  tab,
  onTabChange,
  completedCount = 0,
  membersCount = 0,
  assignmentsCount = 0,
  onChangePassword,
  onLogout,
}) {
  const navItems = getNavForRole(user?.role);
  const initials = (user?.name || user?.email || "User")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: "#6366F1",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>RotaManager</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>2023 / 2024</div>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav
        className="sidebar-nav-container"
        style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.25)",
            padding: "8px 10px 4px",
            letterSpacing: "0.1em",
          }}
        >
          MANAGEMENT
        </div>
        {navItems.map(({ id, label, icon }) => (
          <button
            key={id}
            className="sidebar-nav-btn"
            onClick={() => onTabChange(id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 10px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              background: tab === id ? "rgba(99,102,241,0.2)" : "transparent",
              color: tab === id ? "#818CF8" : "rgba(255,255,255,0.5)",
              border: "none",
              width: "100%",
              textAlign: "left",
              transition: "all .15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {icon}
              <span>{label}</span>
            </div>
            {id === "dashboard" && completedCount > 0 && (
              <span
                style={{
                  background: "#F43F5E",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 99,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {completedCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User Footer */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", padding: "0 4px 10px" }}>
          {membersCount} members · {assignmentsCount} assignments
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "8px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#6366F1",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.name || user?.email || "User"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{user?.role || "Member"}</div>
          </div>
          {onChangePassword && (
            <button
              onClick={onChangePassword}
              title="Change password"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.35)",
                padding: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                flexShrink: 0,
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#818CF8";
                e.currentTarget.style.background = "rgba(99,102,241,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                e.currentTarget.style.background = "none";
              }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.35)",
                padding: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                flexShrink: 0,
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#F87171";
                e.currentTarget.style.background = "rgba(248,113,113,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                e.currentTarget.style.background = "none";
              }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
