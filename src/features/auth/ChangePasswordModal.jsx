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

export function ChangePasswordModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({ password: "", confirmPassword: "", show: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit() {
    setError("");
    if (!form.password.trim()) {
      setError("Please enter a new password.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);
    if (err) {
      setError(err.message || "Failed to update password.");
    } else {
      setForm({ password: "", confirmPassword: "", show: false });
      if (onSuccess) onSuccess("Password updated successfully.");
      onClose();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        className="premium-card"
        style={{
          padding: "28px 28px",
          maxWidth: 380,
          width: "100%",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25) !important",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: "#EEF2FF",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6366F1",
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Change Password</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Update your account password</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LS}>NEW PASSWORD</label>
          <div style={{ position: "relative" }}>
            <input
              type={form.show ? "text" : "password"}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ ...INP, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, show: !f.show }))}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94A3B8",
              }}
            >
              {form.show ? (
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={LS}>CONFIRM PASSWORD</label>
          <input
            type={form.show ? "text" : "password"}
            placeholder="Repeat new password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={INP}
          />
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 14,
              padding: "8px 12px",
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

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              background: "#F8FAFC",
              color: "#334155",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 1.3,
              padding: "10px",
              background: loading ? "#A5A5F0" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Saving..." : "Save Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
