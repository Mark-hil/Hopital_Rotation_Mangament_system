import React, { useState } from "react";
import { getNavForRole } from "../../constants/navigation";

export function MobileNav({
  user,
  tab,
  onTabChange,
  completedCount = 0,
  onChangePassword,
  onLogout,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navItems = getNavForRole(user?.role);
  const currentNav = navItems.find((n) => n.id === tab) || navItems[0];
  const initials = (user?.name || user?.email || "User")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSelectTab = (id) => {
    onTabChange(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Sticky Mobile Top App Bar */}
      <header className="mobile-top-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "none",
              color: "#fff",
              width: 38,
              height: 38,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                background: "#6366F1",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
                {currentNav?.label || "RotaManager"}
              </div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)" }}>Hospital Rotation System</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              fontSize: 11,
              fontWeight: 700,
            }}
            title={user?.name || user?.email}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Slide-out Drawer */}
      {drawerOpen && (
        <>
          <div
            className="mobile-drawer-overlay"
            style={{ display: "block" }}
            onClick={() => setDrawerOpen(false)}
          />
          <div className="mobile-drawer-content">
            {/* Drawer Header */}
            <div
              style={{
                padding: "20px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: "#6366F1",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>RotaManager</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>2023 / 2024</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Drawer Nav Items */}
            <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.3)",
                  padding: "4px 12px 8px",
                  letterSpacing: "0.08em",
                }}
              >
                NAVIGATION
              </div>
              {navItems.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => handleSelectTab(id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: tab === id ? 700 : 500,
                    background: tab === id ? "rgba(99,102,241,0.22)" : "transparent",
                    color: tab === id ? "#A5B4FC" : "rgba(255,255,255,0.7)",
                    border: "none",
                    width: "100%",
                    textAlign: "left",
                    transition: "all .15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                        padding: "2px 8px",
                        borderRadius: 99,
                      }}
                    >
                      {completedCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Drawer Footer with User Info */}
            <div
              style={{
                padding: "16px 14px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#6366F1",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.name || user?.email || "User"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                    {user?.role || "Member"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {onChangePassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onChangePassword();
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#A5B4FC",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Password
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onLogout();
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 10px",
                      background: "rgba(244,63,94,0.12)",
                      border: "1px solid rgba(244,63,94,0.25)",
                      borderRadius: 8,
                      color: "#FDA4AF",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sign out
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MobileNav;
