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

export function ForgotPasswordScreen({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleResetPassword() {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    setLoading(false);
    if (err) {
      setError(err.message || "Unable to send reset email. Please try again.");
    } else {
      setSubmitted(true);
    }
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
      <div style={{ width: "100%", maxWidth: 400 }}>
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
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  background: "#ECFDF5",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 18px",
                  color: "#10B981",
                }}
              >
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Check your email
              </div>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>
                We've sent a password reset link to <strong style={{ color: "#0F172A" }}>{email}</strong>. Open
                the link to create your new password.
              </p>
              <button
                onClick={onBackToLogin}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                }}
              >
                Back to sign in
              </button>
              <div style={{ marginTop: 18, fontSize: 13, color: "#94A3B8" }}>
                Didn't receive the email?{" "}
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6366F1",
                    fontWeight: 700,
                    cursor: loading ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  {loading ? "Sending..." : "Click to resend"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                Reset password
              </div>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>
                Enter your account email to receive a password reset link.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={LS}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                  placeholder="name@hospital.com"
                  style={{ ...INP, borderColor: error ? "#FCA5A5" : "#E2E8F0" }}
                />
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
                onClick={handleResetPassword}
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
                {loading ? "Sending link…" : "Send reset link →"}
              </button>

              <button
                onClick={onBackToLogin}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748B",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 22,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordScreen;
