import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

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

const LS = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#94A3B8",
  marginBottom: 6,
  letterSpacing: "0.05em",
};

export function LoginScreen({ onGoRegister, onGoForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Enter both email and password.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) setError("Invalid email or password.");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F172A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: "#6366F1",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
            }}
          >
            <svg width="26" height="26" fill="none" stroke="white" strokeWidth="2.3" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>RotaManager</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
            2023 / 2024 rotation system
          </div>
        </div>

        <div
          className="premium-card"
          style={{
            borderRadius: 20,
            padding: "32px 28px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
            Welcome back
          </div>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Sign in to manage rotations.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={LS}>EMAIL ADDRESS</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="admin@rota.com"
              style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0" }}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ ...LS, marginBottom: 0 }}>PASSWORD</label>
              {onGoForgotPassword && (
                <button
                  type="button"
                  onClick={onGoForgotPassword}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6366F1",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0", paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94A3B8",
                  padding: 4,
                  display: "flex",
                }}
              >
                {showPw ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 12,
                padding: "9px 12px",
                background: "#FFF1F2",
                borderRadius: 8,
                fontSize: 12,
                color: "#BE123C",
                fontWeight: 600,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: 20,
              background: loading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.35)",
            }}
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>

          {onGoRegister && (
            <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#64748B" }}>
              Don't have an account?{" "}
              <button
                onClick={onGoRegister}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366F1",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Create one now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
