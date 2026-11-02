import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase";
import { DEFAULT_WARD_ROWS, applyWardRows } from "./constants/wardGroups";
import { getLatestPlacement } from "./utils/rotationRules";

// Layout & Common Components
import MainLayout from "./components/layout/MainLayout";
import Toast from "./components/common/Toast";
import ConfirmModal from "./components/common/ConfirmModal";

// Auth Features
import LoginScreen from "./features/auth/LoginScreen";
import ForgotPasswordScreen from "./features/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "./features/auth/ResetPasswordScreen";
import ChangePasswordModal from "./features/auth/ChangePasswordModal";

// Tab Features
import DashboardTab from "./features/dashboard/DashboardTab";
import WardsTab from "./features/wards/WardsTab";
import RegisterTab from "./features/members/RegisterTab";
import AssignTab from "./features/assignments/AssignTab";
import MembersTab from "./features/members/MembersTab";
import InchargesTab from "./features/incharges/InchargesTab";
import RotationsTab from "./features/rotations/RotationsTab";
import AnalyticsReportTab from "./features/analytics/AnalyticsReportTab";
import MemberDashboardTab from "./features/member-portal/MemberDashboardTab";
import InChargeTab from "./features/member-portal/InChargeTab";

// ─── Main Application Shell ───────────────────────────────────────────────────

function MainApp({ user, onLogout }) {
  const [tab, setTab] = useState(
    user.role === "Member"
      ? "memberDashboard"
      : user.role === "In-charge"
      ? "inCharge"
      : "dashboard"
  );
  const [assignTargetIds, setAssignTargetIds] = useState([]);
  const [registerInitialRole, setRegisterInitialRole] = useState("Member");
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [wardRows, setWardRows] = useState(DEFAULT_WARD_ROWS);
  const [tableMissing, setTableMissing] = useState(false);
  const [toast, setToast] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function fetchWards() {
    supabase
      .from("wards")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (
            error.code === "42P01" ||
            error.code === "PGRST205" ||
            error.message?.includes("does not exist") ||
            error.message?.includes("schema cache") ||
            error.message?.includes('relation "public.wards" does not exist')
          ) {
            setTableMissing(true);
            applyWardRows(DEFAULT_WARD_ROWS);
          } else {
            console.error("wards fetch error:", error);
          }
          return;
        }
        setTableMissing(false);
        if (data && data.length > 0) {
          setWardRows(data);
          applyWardRows(data);
        } else {
          applyWardRows(DEFAULT_WARD_ROWS);
        }
      })
      .catch(console.error);
  }

  useEffect(() => {
    // Initial fetch
    supabase.from("members").select("*").then(({ data }) => data && setMembers(data)).catch(console.error);
    supabase.from("assignments").select("*").then(({ data }) => data && setAssignments(data)).catch(console.error);
    fetchWards();

    // Setup realtime subscriptions
    const memberSub = supabase
      .channel("members-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => {
        supabase.from("members").select("*").then(({ data }) => data && setMembers(data));
      })
      .subscribe();

    const assignmentSub = supabase
      .channel("assignments-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => {
        supabase.from("assignments").select("*").then(({ data }) => data && setAssignments(data));
      })
      .subscribe();

    const wardSub = supabase
      .channel("wards-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "wards" }, () => {
        fetchWards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(memberSub);
      supabase.removeChannel(assignmentSub);
      supabase.removeChannel(wardSub);
    };
  }, []);

  async function handleRegister(form) {
    if (form.role === "In-charge") {
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { role: "In-charge", name: form.name, wards: form.wards } }
      });
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        });
      }
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
          showToast("Email already exists in Auth — delete the user from Supabase Auth first");
        } else {
          showToast("Error: " + error.message);
        }
        return;
      }
      if (!data.user?.identities || data.user.identities.length === 0) {
        showToast("Email already exists in Auth — delete the user from Supabase Auth first");
        return;
      }
      await supabase.from("incharges").insert([
        { name: form.name, email: form.email, phone: form.phone, wards: form.wards, auth_id: data.user?.id }
      ]);
      showToast(`In-charge ${form.name} registered successfully`);
    } else {
      const { id, role, ward, ...memberData } = form;
      supabase
        .from("members")
        .insert([memberData])
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          setMembers((p) => [...p, data]);
          showToast(`${data.name} registered`);
        })
        .catch(err => {
          console.error(err);
          showToast("Error registering member");
        });
    }
  }

  function handleBulkAssign(list) {
    const insertList = list.map(({ id, ...rest }) => rest);
    supabase
      .from("assignments")
      .insert(insertList)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from("assignments").select("*");
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`${list.length} member${list.length > 1 ? "s" : ""} assigned to ${list[0]?.ward}`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error assigning wards");
      });
  }

  function handleEditAssignment(assignmentId, newData) {
    supabase
      .from("assignments")
      .update(newData)
      .eq("id", assignmentId)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from("assignments").select("*");
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`Assignment updated successfully`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error updating assignment: " + (err.message || ""));
      });
  }

  function handleDeleteAssignment(assignmentId) {
    supabase
      .from("assignments")
      .delete()
      .eq("id", assignmentId)
      .then(({ error }) => {
        if (error) throw error;
        return supabase.from("assignments").select("*");
      })
      .then(({ data }) => {
        if (data) setAssignments(data);
        showToast(`Assignment deleted successfully`);
      })
      .catch(err => {
        console.error(err);
        showToast("Error deleting assignment: " + (err.message || ""));
      });
  }

  const completedCount = useMemo(() =>
    members.filter((m) => getLatestPlacement(m.id, assignments)?.status === "completed").length,
    [members, assignments]
  );

  return (
    <MainLayout
      user={user}
      tab={tab}
      onTabChange={(newTab) => {
        if (newTab === "register") setRegisterInitialRole("Member");
        setTab(newTab);
      }}
      completedCount={completedCount}
      membersCount={members.length}
      assignmentsCount={assignments.length}
      onChangePassword={() => setShowChangePassword(true)}
      onLogout={() => setShowLogoutConfirm(true)}
    >
      {tab === "dashboard" && (
        <DashboardTab
          members={members}
          assignments={assignments}
          wardRows={wardRows}
          onNavigateTab={setTab}
          onGoAssign={(ids) => {
            if (!ids) setAssignTargetIds([]);
            else if (Array.isArray(ids)) setAssignTargetIds(ids);
            else setAssignTargetIds([ids]);
            setTab("assign");
          }}
        />
      )}

      {tab === "wards" && (
        <WardsTab
          members={members}
          assignments={assignments}
          wardRows={wardRows}
          tableMissing={tableMissing}
          onWardsChanged={fetchWards}
          onBulkAssign={handleBulkAssign}
          onEditAssignment={handleEditAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          showToast={showToast}
        />
      )}

      {tab === "register" && (
        <RegisterTab
          onRegister={handleRegister}
          adminMode={true}
          initialRole={registerInitialRole}
        />
      )}

      {tab === "assign" && (
        <AssignTab
          members={members}
          assignments={assignments}
          onBulkAssign={handleBulkAssign}
          initialTargetIds={assignTargetIds}
        />
      )}

      {tab === "members" && (
        <MembersTab members={members} assignments={assignments} />
      )}

      {tab === "incharges" && (
        <InchargesTab
          showToast={showToast}
          onGoRegister={() => {
            setRegisterInitialRole("In-charge");
            setTab("register");
          }}
        />
      )}

      {tab === "rotations" && (
        <RotationsTab
          members={members}
          assignments={assignments}
          wardRows={wardRows}
          onNavigateTab={setTab}
          onEditAssignment={handleEditAssignment}
          onDeleteAssignment={handleDeleteAssignment}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsReportTab
          members={members}
          assignments={assignments}
          wardRows={wardRows}
          onNavigateTab={setTab}
        />
      )}

      {tab === "memberDashboard" && (
        <MemberDashboardTab user={user} members={members} assignments={assignments} />
      )}

      {tab === "inCharge" && (
        <InChargeTab user={user} members={members} assignments={assignments} />
      )}

      {/* Logout confirm modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sign out?"
        message="You will be returned to the login screen."
        confirmText="Sign out"
        confirmVariant="danger"
        onConfirm={onLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* In-App Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSuccess={(msg) => showToast(msg)}
      />

      <Toast msg={toast} />
    </MainLayout>
  );
}

// ─── App Root & Session Router ────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [isRecovery, setIsRecovery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    // Check if arriving via a recovery URL hash or search parameter
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (hash.includes("type=recovery") || search.includes("type=recovery")) {
        setIsRecovery(true);
      }
      if (hash.includes("error_description=")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const desc = params.get("error_description");
        if (desc) {
          showToast(decodeURIComponent(desc.replace(/\+/g, " ")));
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    }

    async function syncUserSession(session) {
      if (!session?.user) {
        setUser(null);
        return;
      }
      const role = session.user.user_metadata?.role || "Member";
      let name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User";
      let wards = session.user.user_metadata?.wards || [];

      if (role === "In-charge") {
        try {
          const { data: inc } = await supabase
            .from("incharges")
            .select("wards, name")
            .or(`auth_id.eq.${session.user.id},email.eq.${session.user.email}`)
            .maybeSingle();
          if (inc) {
            if (Array.isArray(inc.wards)) wards = inc.wards;
            if (inc.name) name = inc.name;
          }
        } catch (e) {
          console.warn("Could not sync incharge wards from table:", e);
        }
      }

      setUser({
        id: session.user.id,
        name,
        email: session.user.email,
        role,
        wards,
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isRecoveryHash =
        typeof window !== "undefined" &&
        window.location.hash &&
        window.location.hash.includes("type=recovery");
      if (session?.user && !isRecovery && !isRecoveryHash) {
        syncUserSession(session);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      } else if (session?.user && !isRecovery && !window.location.hash?.includes("type=recovery")) {
        syncUserSession(session);
      } else if (!session?.user) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isRecovery]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F172A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Loading session...
      </div>
    );
  }

  // If in password recovery mode, render the reset password view
  if (isRecovery || view === "resetPassword") {
    return (
      <>
        <ResetPasswordScreen
          onSuccess={async () => {
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            setIsRecovery(false);
            setView("login");
            showToast("Password updated successfully! Please sign in with your new password.");
            await supabase.auth.signOut();
          }}
          onCancel={() => {
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            setIsRecovery(false);
            setView("login");
          }}
        />
        <Toast msg={toast} />
      </>
    );
  }

  if (user) {
    return <MainApp user={user} onLogout={() => supabase.auth.signOut()} />;
  }

  if (view === "forgotPassword") {
    return (
      <>
        <ForgotPasswordScreen onBackToLogin={() => setView("login")} />
        <Toast msg={toast} />
      </>
    );
  }

  if (view === "register") {
    return (
      <>
        <div
          style={{
            minHeight: "100vh",
            background: "#0F172A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="premium-card"
            style={{
              padding: "32px 40px",
              borderRadius: 20,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            }}
          >
            <RegisterTab
              onRegister={async (form) => {
                const { data, error } = await supabase.auth.signUp({
                  email: form.email,
                  password: form.password,
                  options: { data: { role: "Member", name: form.name } },
                });
                if (error) {
                  showToast("Error registering: " + error.message);
                } else if (data.user) {
                  await supabase.from("members").insert([
                    {
                      auth_id: data.user.id,
                      name: form.name,
                      email: form.email,
                      phone: form.phone,
                      school: form.school,
                      group: form.group,
                    },
                  ]);
                  showToast("Successfully registered! Please log in.");
                  setView("login");
                }
              }}
            />
            <button
              onClick={() => setView("login")}
              style={{
                background: "none",
                border: "none",
                color: "#64748B",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 24,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to sign in
            </button>
          </div>
        </div>
        <Toast msg={toast} />
      </>
    );
  }

  return (
    <>
      <LoginScreen
        onGoRegister={() => setView("register")}
        onGoForgotPassword={() => setView("forgotPassword")}
      />
      <Toast msg={toast} />
    </>
  );
}
