import React from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

export function MainLayout({
  user,
  tab,
  onTabChange,
  completedCount = 0,
  membersCount = 0,
  assignmentsCount = 0,
  onChangePassword,
  onLogout,
  children,
}) {
  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <Sidebar
        user={user}
        tab={tab}
        onTabChange={onTabChange}
        completedCount={completedCount}
        membersCount={membersCount}
        assignmentsCount={assignmentsCount}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
      />

      {/* Mobile Top Bar & Drawer Navigation */}
      <MobileNav
        user={user}
        tab={tab}
        onTabChange={onTabChange}
        completedCount={completedCount}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <main className="app-main">{children}</main>
    </div>
  );
}

export default MainLayout;
