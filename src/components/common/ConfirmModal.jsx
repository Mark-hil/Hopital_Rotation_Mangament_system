import React from "react";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!isOpen) return null;
  const isDanger = confirmVariant === "danger";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
        padding: 16,
      }}
    >
      <div
        className="premium-card"
        style={{
          padding: 24,
          borderRadius: 16,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35) !important",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: isDanger ? "#FFF1F2" : "#EEF2FF",
              color: isDanger ? "#E11D48" : "#6366F1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isDanger ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</h3>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, marginTop: 6 }}>
              {message}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "9px 16px",
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
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "9px 16px",
              background: isDanger ? "#E11D48" : "#6366F1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Processing…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
