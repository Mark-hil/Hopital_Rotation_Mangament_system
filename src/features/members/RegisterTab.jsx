import React, { useState, useEffect } from "react";
import { WARD_GROUPS, WARD_LOOKUP } from "../../constants/wardGroups";

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

export function RegFormField({ id, label, type, placeholder, value, onChange, error }) {
  return (
    <div style={{ marginBottom: 18 }}>
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
        {label}
      </label>
      <input
        id={id}
        style={{
          ...INP,
          padding: "11px 14px",
          borderColor: error ? "#FCA5A5" : "#E2E8F0",
          background: "#F8FAFC",
        }}
        type={type || "text"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={(e) => {
          e.target.style.background = "#fff";
          e.target.style.borderColor = "#6366F1";
          e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)";
        }}
        onBlur={(e) => {
          e.target.style.background = "#F8FAFC";
          e.target.style.borderColor = error ? "#FCA5A5" : "#E2E8F0";
          e.target.style.boxShadow = "none";
        }}
      />
      {error && (
        <p
          style={{
            fontSize: 12,
            color: "#EF4444",
            fontWeight: 600,
            marginTop: 5,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{"⚠️"}</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ value, onChange, showPw, onToggle, error }) {
  const inputStyle = {
    ...INP,
    padding: "11px 14px",
    paddingRight: 44,
    borderColor: error ? "#FCA5A5" : "#E2E8F0",
    background: "#F8FAFC",
  };
  return (
    <div style={{ marginBottom: 18 }}>
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
        Password
      </label>
      <div style={{ position: "relative" }}>
        <input
          style={inputStyle}
          type={showPw ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={onChange}
          onFocus={(e) => {
            e.target.style.background = "#fff";
            e.target.style.borderColor = "#6366F1";
            e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)";
          }}
          onBlur={(e) => {
            e.target.style.background = "#F8FAFC";
            e.target.style.borderColor = error ? "#FCA5A5" : "#E2E8F0";
            e.target.style.boxShadow = "none";
          }}
        />
        <button
          type="button"
          onClick={onToggle}
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
      {error && (
        <p
          style={{
            fontSize: 12,
            color: "#EF4444",
            fontWeight: 600,
            marginTop: 5,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{"⚠️"}</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function RegisterTab({ onRegister, adminMode = false, initialRole = "Member" }) {
  const [role, setRole] = useState(initialRole || "Member");
  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    school: "",
    group: "nursing",
    wards: [],
  });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isIncharge = adminMode && role === "In-charge";
  const allWardNames = WARD_GROUPS.flatMap((g) => g.wards.map((w) => w.name));
  const allSelected = allWardNames.length > 0 && allWardNames.every((n) => form.wards.includes(n));

  function submit() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.password.trim()) e.password = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!isIncharge && !form.school.trim()) e.school = "Required";
    if (isIncharge && form.wards.length === 0) e.wards = "Select at least one ward";
    setErrors(e);
    if (Object.keys(e).length) return;
    onRegister({ ...form, role });
  }

  function toggleWard(name) {
    setForm((f) => ({
      ...f,
      wards: f.wards.includes(name) ? f.wards.filter((x) => x !== name) : [...f.wards, name],
    }));
  }

  function toggleAll() {
    setForm((f) => ({ ...f, wards: allSelected ? [] : allWardNames }));
  }

  return (
    <div style={{ maxWidth: isIncharge ? 860 : 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#0F172A" }}>
          {isIncharge ? "Register ward in-charge" : "Register member"}
        </h2>
        <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
          {isIncharge
            ? "Create a login account for a ward in-charge and assign their ward(s)."
            : "Add a new nurse or midwife to the 2023/2024 rotation."}
        </p>
      </div>

      {adminMode && (
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { val: "Member", icon: "🏥", title: "Member", sub: "Nurse or Midwife" },
            { val: "In-charge", icon: "🔑", title: "In-charge", sub: "Ward supervisor" },
          ].map((r) => (
            <button
              key={r.val}
              type="button"
              onClick={() => {
                setRole(r.val);
                setErrors({});
              }}
              style={{
                flex: 1,
                minWidth: 160,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                border: role === r.val ? "2px solid #6366F1" : "1.5px solid #E2E8F0",
                background: role === r.val ? "#EEF2FF" : "#fff",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: role === r.val ? "#6366F1" : "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {r.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: role === r.val ? "#4338CA" : "#0F172A",
                  }}
                >
                  {r.title}
                </div>
                <div style={{ fontSize: 12, color: role === r.val ? "#6366F1" : "#64748B", marginTop: 2 }}>
                  {r.sub}
                </div>
              </div>
              {role === r.val && (
                <div
                  style={{
                    marginLeft: "auto",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#6366F1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5l2.5 2.5 4.5-4.5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {isIncharge ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
          <div className="premium-card" style={{ padding: "28px", borderRadius: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
                paddingBottom: 16,
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#EEF2FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="15" height="15" fill="none" stroke="#6366F1" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Personal details</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Account credentials</div>
              </div>
            </div>
            <RegFormField
              id="name"
              label="Full name"
              placeholder="e.g. Abena Mensah"
              value={form.name}
              onChange={set("name")}
              error={errors.name}
            />
            <RegFormField
              id="email"
              label="Email address"
              type="email"
              placeholder="e.g. abena@hospital.com"
              value={form.email}
              onChange={set("email")}
              error={errors.email}
            />
            <RegFormField
              id="phone"
              label="Phone number"
              type="tel"
              placeholder="e.g. 0244 000 000"
              value={form.phone}
              onChange={set("phone")}
              error={errors.phone}
            />
            <PasswordField
              value={form.password}
              onChange={set("password")}
              showPw={showPw}
              onToggle={() => setShowPw((s) => !s)}
              error={errors.password}
            />
            <button
              onClick={submit}
              style={{
                width: "100%",
                padding: "13px",
                background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                marginTop: 8,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Create in-charge account →
            </button>
          </div>

          <div className="premium-card" style={{ padding: "28px", borderRadius: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#FFF7ED",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="15" height="15" fill="none" stroke="#F97316" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Assign wards</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Select one or more</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {form.wards.length > 0 && (
                  <span
                    style={{
                      background: "#6366F1",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 99,
                    }}
                  >
                    {form.wards.length} selected
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleAll}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "5px 12px",
                    borderRadius: 8,
                    border: "1.5px solid #E2E8F0",
                    background: allSelected ? "#FFF1F2" : "#F8FAFC",
                    color: allSelected ? "#BE123C" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
            </div>

            {errors.wards && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 12px",
                  background: "#FFF1F2",
                  borderRadius: 8,
                  marginBottom: 14,
                  fontSize: 12,
                  color: "#BE123C",
                  fontWeight: 600,
                }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errors.wards}
              </div>
            )}

            {form.wards.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                  padding: "10px 12px",
                  background: "#F8FAFC",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                }}
              >
                {form.wards.map((w) => {
                  const info = WARD_LOOKUP[w];
                  return (
                    <span
                      key={w}
                      onClick={() => toggleWard(w)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: info?.color || "#EEF2FF",
                        color: info?.textColor || "#4338CA",
                        border: "1px solid " + (info?.accent || "#6366F1") + "40",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 99,
                        cursor: "pointer",
                      }}
                    >
                      {w}
                      <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </span>
                  );
                })}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                maxHeight: 360,
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {WARD_GROUPS.map((g) => (
                <div key={g.group}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: g.accent }} />
                    {g.group}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {g.wards.map((w) => {
                      const checked = form.wards.includes(w.name);
                      return (
                        <div
                          key={w.name}
                          onClick={() => toggleWard(w.name)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "9px 12px",
                            borderRadius: 9,
                            cursor: "pointer",
                            background: checked ? g.color : "#F8FAFC",
                            border: "1.5px solid " + (checked ? g.accent + "60" : "transparent"),
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            if (!checked) e.currentTarget.style.background = "#F1F5F9";
                          }}
                          onMouseLeave={(e) => {
                            if (!checked) e.currentTarget.style.background = "#F8FAFC";
                          }}
                        >
                          <div
                            style={{
                              width: 17,
                              height: 17,
                              borderRadius: 5,
                              flexShrink: 0,
                              border: "2px solid " + (checked ? g.accent : "#CBD5E1"),
                              background: checked ? g.accent : "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.12s",
                            }}
                          >
                            {checked && (
                              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                <path
                                  d="M1.5 5l2.5 2.5 4.5-4.5"
                                  stroke="white"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: checked ? 700 : 500,
                              color: checked ? g.textColor : "#334155",
                              flex: 1,
                            }}
                          >
                            {w.name}
                          </span>
                          {checked && (
                            <div
                              style={{ width: 6, height: 6, borderRadius: "50%", background: g.accent, flexShrink: 0 }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="premium-card" style={{ padding: "32px", borderRadius: 16 }}>
          <RegFormField
            id="name"
            label="Full name"
            placeholder="e.g. Abena Mensah"
            value={form.name}
            onChange={set("name")}
            error={errors.name}
          />
          <RegFormField
            id="email"
            label="Email address"
            type="email"
            placeholder="e.g. abena@rota.com"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <RegFormField
            id="phone"
            label="Phone number"
            type="tel"
            placeholder="e.g. 0244 000 000"
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
          />
          <PasswordField
            value={form.password}
            onChange={set("password")}
            showPw={showPw}
            onToggle={() => setShowPw((s) => !s)}
            error={errors.password}
          />
          <RegFormField
            id="school"
            label="Training institution"
            placeholder="e.g. Korle Bu School of Nursing"
            value={form.school}
            onChange={set("school")}
            error={errors.school}
          />
          <div style={{ marginBottom: 28 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#64748B",
                marginBottom: 10,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              GROUP
            </label>
            <div className="register-grid">
              {[
                { val: "nursing", icon: "🏥", title: "General Nursing", desc: "52-week programme" },
                { val: "midwifery", icon: "👶", title: "Midwifery", desc: "52-week programme" },
              ].map((g) => (
                <div
                  key={g.val}
                  onClick={() => setForm((f) => ({ ...f, group: g.val }))}
                  style={{
                    border: form.group === g.val ? "2px solid #6366F1" : "1.5px solid #E2E8F0",
                    background: form.group === g.val ? "#EEF2FF" : "#fff",
                    borderRadius: 12,
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    opacity: form.group === g.val ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    if (form.group !== g.val) {
                      e.currentTarget.style.borderColor = "#CBD5E1";
                      e.currentTarget.style.opacity = 1;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (form.group !== g.val) {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.opacity = 0.7;
                    }
                  }}
                >
                  <div style={{ fontSize: 26 }}>{g.icon}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: form.group === g.val ? "#4338CA" : "#0F172A",
                    }}
                  >
                    {g.title}
                  </div>
                  <div style={{ fontSize: 12, color: form.group === g.val ? "#6366F1" : "#64748B" }}>
                    {g.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={submit}
            style={{
              width: "100%",
              padding: "14px",
              background: "#6366F1",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(99,102,241,0.2)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            Complete Registration
          </button>
        </div>
      )}
    </div>
  );
}

export default RegisterTab;
