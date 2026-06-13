// VaultScan — Settings modal (Claude.ai style: left nav + content panel, searchable)
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { Switch, Tag, Avatar, ProgressBar, Dropdown } = window;

  const SECTIONS = [
    { id: "general", label: "General", icon: "settings" },
    { id: "profile", label: "Profile", icon: "users" },
    { id: "account", label: "Account", icon: "key" },
    { id: "privacy", label: "Privacy & Data", icon: "eye" },
    { id: "security", label: "Security", icon: "shield" },
    { id: "apikeys", label: "API Keys", icon: "key" },
    { id: "models", label: "Models", icon: "cpu" },
    { id: "usage", label: "Usage", icon: "chart" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "handoff", label: "Handoff links", icon: "terminal" },
    { id: "help", label: "Help & Support", icon: "help" },
  ];

  function Field({ label, children, half }) {
    return h("div", { style: { marginBottom: 14 } }, h("label", { className: "flabel" }, label), children);
  }
  function SRow({ label, desc, children }) {
    return h("div", { style: { display: "flex", alignItems: "center", gap: 14, padding: "11px 0", borderBottom: "1px solid var(--border)" } },
      h("div", { style: { flex: 1 } },
        h("div", { style: { fontSize: 13, fontWeight: 550 } }, label),
        desc && h("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 1 } }, desc)),
      children);
  }
  function H2({ children }) { return h("h3", { style: { fontSize: 15, fontWeight: 650, marginBottom: 14 } }, children); }

  function SettingsModal({ onClose, initial, mode, setMode, toast }) {
    const [sec, setSec] = useState(initial || "general");
    const [q, setQ] = useState("");
    const filtered = SECTIONS.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()));

    return h("div", { className: "overlay-scrim", onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
      h("div", { className: "modal", style: { width: 860, height: "82vh", flexDirection: "row" }, "data-screen-label": "Settings" },
        // Left nav
        h("div", { style: { width: 210, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--bg-sidebar)", display: "flex", flexDirection: "column" } },
          h("div", { style: { padding: "16px 14px 8px" } },
            h("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 10 } }, "Settings"),
            h("div", { style: { position: "relative" } },
              h(Icons.search, { size: 13, style: { position: "absolute", left: 9, top: 8, color: "var(--text-3)" } }),
              h("input", { className: "field", placeholder: "Search…", value: q, onChange: (e) => setQ(e.target.value), style: { paddingLeft: 28, fontSize: 12, padding: "6px 8px 6px 28px" } }))),
          h("div", { style: { flex: 1, overflowY: "auto", padding: "4px 8px" } },
            filtered.map((s) =>
              h("button", { key: s.id, className: "sb-item" + (sec === s.id ? " active" : ""), onClick: () => setSec(s.id) },
                h(Icons[s.icon], { size: 15 }), h("span", { className: "sbi-label" }, s.label))))),
        // Content
        h("div", { style: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 } },
          h("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" } },
            h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 17 }))),
          h("div", { key: sec, className: "fade-slide-enter", style: { flex: 1, overflowY: "auto", padding: "6px 28px 32px" } },
            sec === "general" && h(GeneralSec, { mode, setMode }),
            sec === "profile" && h(ProfileSec, null),
            sec === "account" && h(AccountSec, { toast }),
            sec === "privacy" && h(PrivacySec, { toast }),
            sec === "security" && h(SecuritySec, { toast }),
            sec === "apikeys" && h(ApiKeysSec, { toast }),
            sec === "models" && h(ModelsSec, null),
            sec === "usage" && h(UsageSec, null),
            sec === "notifications" && h(NotifSec, null),
            sec === "handoff" && h(HandoffLinksSec, { toast }),
            sec === "help" && h(HelpSec, null)))));
  }
  window.SettingsModal = SettingsModal;

  function GeneralSec({ mode, setMode }) {
    return h("div", null, h(H2, null, "General"),
      h(SRow, { label: "Appearance" },
        h("div", { style: { display: "flex", gap: 4, background: "var(--bg-inset)", padding: 3, borderRadius: 9 } },
          [["light", "sun", "Light"], ["dark", "moon", "Dark"]].map(([id, icon, label]) =>
            h("button", { key: id, onClick: () => setMode(id),
              style: { display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 7, fontSize: 12.5, fontWeight: 550,
                background: mode === id ? "var(--bg-surface)" : "transparent", color: mode === id ? "var(--text-1)" : "var(--text-2)",
                boxShadow: mode === id ? "var(--shadow-card)" : "none", transition: "all var(--dur-med) var(--ease-spring)" } },
              h(Icons[icon], { size: 14 }), label)))),
      h(SRow, { label: "Language" }, h(Dropdown, { width: 160, options: ["English", "Deutsch", "日本語"] })),
      h(SRow, { label: "Default scan depth" }, h(Dropdown, { width: 160, defaultValue: "Deep", options: ["Fast", "Deep", "Thorough"] })),
      h(SRow, { label: "Default model" }, h(Dropdown, { width: 200, options: ["Auto (recommended)", "Gemini 2.0 Flash", "OpenRouter / Claude Haiku"] })),
      h(SRow, { label: "Timezone" }, h(Dropdown, { width: 220, options: ["(GMT-8) Pacific Time", "(GMT+0) UTC", "(GMT+1) Berlin"] })),
      h(SRow, { label: "Date format" }, h(Dropdown, { width: 160, options: ["Jun 10, 2026", "10/06/2026", "2026-06-10"] })));
  }

  function SearchableSelect({ value, options, onChange, style, triggerStyle, placeholder = "Search..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef();

    useEffect(() => {
      if (!isOpen) return;
      const onDoc = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, [isOpen]);

    const activeOption = options.find((o) => o.value === value);

    const filteredOptions = options.filter((o) => {
      const q = search.toLowerCase();
      return (
        o.label.toLowerCase().includes(q) ||
        (o.searchText && o.searchText.toLowerCase().includes(q))
      );
    });

    return h("div", { ref, style: Object.assign({ position: "relative" }, style) },
      h("button", {
        type: "button",
        className: "field select-trigger",
        onClick: () => {
          setIsOpen(!isOpen);
          setSearch("");
        },
        style: Object.assign({ display: "flex", alignItems: "center", justifyContent: "space-between" }, triggerStyle)
      },
        h("span", { style: { display: "flex", alignItems: "center", gap: 8 } },
          activeOption ? activeOption.label : "Select..."
        ),
        h(Icons.chevD, { size: 14, style: { color: "var(--text-3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform var(--dur-micro) ease" } })
      ),
      isOpen && h("div", { className: "select-popover" },
        h("div", { className: "select-search-container" },
          h("input", {
            className: "field",
            placeholder,
            value: search,
            onChange: (e) => setSearch(e.target.value),
            autoFocus: true,
            style: { padding: "6px 10px", fontSize: 12.5 }
          })
        ),
        h("div", { className: "select-options-list" },
          filteredOptions.length === 0
            ? h("div", { style: { padding: "12px 14px", fontSize: 12.5, color: "var(--text-3)", textAlign: "center" } }, "No results found")
            : filteredOptions.map((o) =>
                h("button", {
                  key: o.value,
                  type: "button",
                  className: "select-option-item" + (o.value === value ? " selected" : ""),
                  onClick: () => {
                    onChange(o.value);
                    setIsOpen(false);
                  }
                }, o.label)
              )
        )
      )
    );
  }

  function ProfileSec() {
    const countriesList = window.COUNTRIES || [];
    const [countryISO, setCountryISO] = useState("US");
    const [phone, setPhone] = useState("555 010 2299");
    const [country, setCountry] = useState("United States");

    function handleISOChange(newISO) {
      setCountryISO(newISO);
      const match = countriesList.find((c) => c.code === newISO);
      if (match) setCountry(match.name);
    }

    function handleCountryChange(newCountry) {
      setCountry(newCountry);
      const match = countriesList.find((c) => c.name === newCountry);
      if (match) setCountryISO(match.code);
    }

    function validatePhone(iso, p) {
      const num = p.replace(/\D/g, "");
      if (!num) return { valid: true };
      
      const activeCountry = countriesList.find(x => x.code === iso);
      if (!activeCountry) return { valid: true };
      
      const len = num.length;
      if (len < activeCountry.min) {
        return { valid: false, msg: `Too short for ${activeCountry.name} (needs ${activeCountry.min} digits)` };
      }
      if (len > activeCountry.max) {
        return { valid: false, msg: `Too long for ${activeCountry.name} (needs ${activeCountry.max} digits)` };
      }
      return { valid: true };
    }

    const validation = validatePhone(countryISO, phone);

    const codeOptions = countriesList.map((c) => ({
      value: c.code,
      label: `${c.flag} ${c.dial_code}`,
      searchText: `${c.dial_code} ${c.name}`
    }));

    const countryOptions = countriesList.map((c) => ({
      value: c.name,
      label: `${c.flag} ${c.name}`,
      searchText: `${c.name} ${c.code}`
    }));

    return h("div", null, h(H2, null, "Profile"),
      h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 } },
        h(Avatar, { initials: "AR", color: "var(--accent)", size: 56 }),
        h("div", null,
          h("button", { className: "btn btn-secondary btn-sm" }, h(Icons.upload, { size: 13 }), "Upload avatar"),
          h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 5 } }, "PNG or JPG, max 2 MB"))),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" } },
        h(Field, { label: "Full name" }, h("input", { className: "field", defaultValue: "Alex Rivera" })),
        h(Field, { label: "Display name" }, h("input", { className: "field", defaultValue: "Alex" })),
        h(Field, { label: "Email" },
          h("div", { style: { position: "relative" } },
            h("input", { className: "field", defaultValue: "alex@acme.dev", style: { paddingRight: 76 } }),
            h("span", { className: "badge", style: { position: "absolute", right: 8, top: 7, background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h(Icons.check, { size: 11 }), "Verified"))),
        h(Field, { label: "Phone number" },
          h("div", { style: { display: "flex", flexDirection: "column" } },
            h("div", { style: { display: "flex", gap: 6 } },
              h(SearchableSelect, {
                value: countryISO,
                options: codeOptions,
                onChange: handleISOChange,
                style: { width: 120, flexShrink: 0 },
                triggerStyle: { borderColor: !validation.valid ? "var(--sev-critical)" : "var(--border)" },
                placeholder: "Search code..."
              }),
              h("input", {
                className: "field",
                style: { borderColor: !validation.valid ? "var(--sev-critical)" : "var(--border)" },
                value: phone,
                onChange: (e) => setPhone(e.target.value)
              })),
            !validation.valid && h("div", { style: { color: "var(--sev-critical)", fontSize: 11.5, marginTop: 4, display: "flex", alignItems: "center", gap: 4 } },
              h(Icons.alert, { size: 12, style: { color: "var(--sev-critical)" } }),
              validation.msg))),
        h(Field, { label: "Country / Region" },
          h(SearchableSelect, {
            value: country,
            options: countryOptions,
            onChange: handleCountryChange,
            placeholder: "Search country..."
          })),
        h(Field, { label: "Organization" }, h("input", { className: "field", defaultValue: "Acme Dev Co." })),
        h(Field, { label: "Job title" }, h("input", { className: "field", defaultValue: "Staff Engineer" })),
        h(Field, { label: "Website / GitHub" }, h("input", { className: "field", defaultValue: "github.com/alexrivera" }))),
      h(Field, { label: "Bio" }, h("textarea", { className: "field", rows: 2, defaultValue: "Building secure-by-default APIs.", style: { resize: "none" } })),
      h(Field, { label: "What best describes your work?" }, h(Dropdown, { width: 300, options: ["Backend engineering", "Security engineering", "Full-stack development", "Engineering leadership"] })),
      h("button", { className: "btn btn-primary", disabled: !validation.valid, style: { marginTop: 6 } }, "Save changes"));
  }

  function AccountSec({ toast }) {
    const sessions = [
      { device: "MacBook Pro · Chrome", loc: "San Francisco, US", created: "Mar 2026", updated: "now", current: true },
      { device: "iPhone 16 · Safari", loc: "San Francisco, US", created: "Apr 2026", updated: "2h ago" },
      { device: "Work PC · Edge", loc: "Oakland, US", created: "May 2026", updated: "3d ago" },
    ];
    return h("div", null, h(H2, null, "Account"),
      h(SRow, { label: "Email", desc: "alex@acme.dev" }, h("button", { className: "btn btn-secondary btn-sm" }, "Change email")),
      h(SRow, { label: "Organization ID", desc: "org_8f21kqx9" }, h("button", { className: "btn btn-secondary btn-sm", onClick: () => toast({ kind: "success", msg: "Copied" }) }, h(Icons.copy, { size: 13 }), "Copy")),
      h("div", { style: { margin: "18px 0 8px", fontSize: 13, fontWeight: 650 } }, "Active sessions"),
      h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 10 } },
        sessions.map((s, i) =>
          h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 } },
            h("div", { style: { flex: 1 } },
              h("div", { style: { fontWeight: 550 } }, s.device, s.current && h("span", { className: "badge", style: { marginLeft: 8, background: "var(--accent-soft)", color: "var(--accent)" } }, "Current")),
              h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, s.loc + " · created " + s.created + " · active " + s.updated)),
            !s.current && h("button", { className: "btn btn-ghost btn-sm", onClick: () => toast({ kind: "info", msg: "Session revoked" }) }, "Revoke")))),
      h("button", { className: "btn btn-secondary btn-sm", onClick: () => toast({ kind: "info", msg: "All other devices logged out" }) }, "Log out all other devices"),
      h("div", { style: { marginTop: 26, padding: 16, borderRadius: "var(--r-md)", border: "1px solid var(--sev-critical)", background: "var(--sev-critical-bg)" } },
        h("div", { style: { fontSize: 13, fontWeight: 650, color: "var(--sev-critical)", marginBottom: 4 } }, "Danger zone"),
        h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 10 } }, "Permanently delete your account, scans, and all associated data."),
        h("button", { className: "btn btn-danger btn-sm" }, "Delete account")));
  }

  function PrivacySec({ toast }) {
    const [improve, setImprove] = useState(false);
    const [history, setHistory] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const explainers = [
      ["What we store", "Scan metadata, findings, and snippets of flagged code (max 40 lines per finding). We never store your full repository."],
      ["Where code goes", "Code segments are sent to the model providers you configure (Gemini/OpenRouter) under your own API keys, then discarded."],
      ["Retention", "Scan history is kept until you delete it. Deleted scans are purged from backups within 30 days."]];
    return h("div", null, h(H2, null, "Privacy & Data"),
      explainers.map(([title, body], i) =>
        h("div", { key: i, style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", marginBottom: 8, overflow: "hidden" } },
          h("button", { onClick: () => setExpanded(expanded === i ? null : i), style: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", fontSize: 13, fontWeight: 550 } },
            h(Icons.chevD, { size: 13, style: { transform: expanded === i ? "none" : "rotate(-90deg)", transition: "transform var(--dur-micro) ease", color: "var(--text-3)" } }), title),
          expanded === i && h("div", { className: "fade-slide-enter", style: { padding: "0 14px 12px 35px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 } }, body))),
      h("div", { style: { marginTop: 14 } },
        h(SRow, { label: "Help improve Akira AI", desc: "Share anonymized finding feedback" }, h(Switch, { on: improve, onChange: setImprove })),
        h(SRow, { label: "Store scan history", desc: "Required for trends and scan diffs" }, h(Switch, { on: history, onChange: setHistory }))),
      h("div", { style: { display: "flex", gap: 8, marginTop: 16 } },
        h("button", { className: "btn btn-secondary btn-sm", onClick: () => toast({ kind: "success", msg: "Export started — we'll email you a link" }) }, h(Icons.download, { size: 13 }), "Export all data"),
        h("button", { className: "btn btn-danger btn-sm", onClick: () => toast({ kind: "info", msg: "Scan history deleted" }) }, "Delete all scan history")));
  }

  // Handoff links management: list, status, revoke (Claude Code MCP handoffs).
  function HandoffLinksSec({ toast }) {
    const [links, setLinks] = useState([
      { id: "h1", scope: "Critical + High", audit: "user/ecommerce-api", status: "active", expires: "in 21h", created: "3h ago", findings: 13 },
      { id: "h2", scope: "Everything", audit: "user/ecommerce-api", status: "used", expires: "expired", created: "yesterday", findings: 45 },
      { id: "h3", scope: "Security only", audit: "user/payments-gateway", status: "revoked", expires: "—", created: "2d ago", findings: 19 },
    ]);
    const statusStyle = {
      active: { bg: "var(--sev-clean-bg)", c: "var(--sev-clean)" },
      used: { bg: "var(--bg-active)", c: "var(--text-2)" },
      expired: { bg: "var(--bg-active)", c: "var(--text-3)" },
      revoked: { bg: "var(--sev-critical-bg)", c: "var(--sev-critical)" },
    };
    function revoke(id) {
      setLinks((ls) => ls.map((l) => l.id === id ? Object.assign({}, l, { status: "revoked", expires: "—" }) : l));
      toast({ kind: "info", msg: "Handoff link revoked" });
    }
    return h("div", null, h(H2, null, "Handoff links"),
      h("p", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 16, maxWidth: 560 } },
        "Single-use links you've generated for Claude Code. Each is created from a scan report (“Hand off to Claude Code”), expires after 24 hours, and can be revoked here."),
      links.length === 0
        ? h("div", { className: "empty-state" }, h(Icons.terminal, { size: 24, style: { color: "var(--text-3)", margin: "0 auto 8px" } }), h("h3", null, "No handoff links yet"), h("p", null, "Open a scan report and choose “Hand off to Claude Code”."))
        : h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
            links.map((l, i) => {
              const st = statusStyle[l.status] || statusStyle.expired;
              return h("div", { key: l.id, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--border)" : "none" } },
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 } }, l.scope,
                    h("span", { className: "badge", style: { background: st.bg, color: st.c } }, l.status)),
                  h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" } },
                    h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 } }, h(Icons.github, { size: 11 }), l.audit),
                    h("span", null, l.findings + " findings"),
                    h("span", null, "created " + l.created),
                    l.status === "active" && h("span", null, "expires " + l.expires))),
                l.status === "active"
                  ? h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, onClick: () => revoke(l.id) }, "Revoke")
                  : h("span", { style: { fontSize: 11.5, color: "var(--text-3)", width: 56, textAlign: "right" } }, ""));
            })));
  }

  // Two-factor block: choose method (Authenticator app / Email), enable + manage.
  function TwoFactorBlock({ toast }) {
    const [totpOn, setTotpOn] = useState(false);
    const [emailOn, setEmailOn] = useState(false);
    const [method, setMethod] = useState(null);         // active factor
    const [flow, setFlow] = useState(null);             // "totp" | "email" enroll flow
    const [code, setCode] = useState("");
    const [backup, setBackup] = useState(null);
    const userEmail = (window.VS_REPO_META && window.VS_REPO_META.email) || "you@example.com";

    function startTotp() { setFlow("totp"); setCode(""); }
    function startEmail() { setFlow("email"); setCode(""); toast({ kind: "info", msg: "Code sent to " + userEmail }); }

    function confirm() {
      if (code.trim().length < 4) { toast({ kind: "error", msg: "Enter the code" }); return; }
      if (flow === "totp") {
        setTotpOn(true); setMethod("totp");
        setBackup(["a1b2c3d4", "e5f6g7h8", "i9j0k1l2", "m3n4o5p6", "q7r8s9t0", "u1v2w3x4"]);
        toast({ kind: "success", msg: "Authenticator 2FA enabled" });
      } else {
        setEmailOn(true); if (!totpOn) setMethod("email");
        toast({ kind: "success", msg: "Email 2FA enabled" });
      }
      setFlow(null); setCode("");
    }

    const card = { border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 16, marginBottom: 12 };
    const methodChip = (id, label, on, desc, onEnable, onDisable) =>
      h("div", { key: id, style: { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: "var(--r-md)", border: "1.5px solid " + (on ? "var(--accent)" : "var(--border)"), background: on ? "var(--accent-soft)" : "var(--bg-surface)", marginBottom: 8 } },
        h("span", { style: { display: "flex", color: on ? "var(--accent)" : "var(--text-3)", marginTop: 1 } }, h(Icons[id === "totp" ? "cpu" : "bell"], { size: 18 })),
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 } }, label,
            on && h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h("span", { className: "dot" }), "On"),
            on && method === id && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-2)" } }, "Active")),
          h("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 2 } }, desc)),
        on
          ? h("div", { style: { display: "flex", gap: 6 } },
              (totpOn && emailOn && method !== id) && h("button", { className: "btn btn-ghost btn-sm", onClick: () => { setMethod(id); toast({ kind: "success", msg: "Active factor set to " + label }); } }, "Make active"),
              h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, onClick: onDisable }, "Disable"))
          : h("button", { className: "btn btn-secondary btn-sm", onClick: onEnable }, "Enable"));

    return h("div", { style: { maxWidth: 520, marginBottom: 22 } },
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 8 } }, "Two-factor authentication"),
      methodChip("totp", "Authenticator app", totpOn,
        "TOTP codes from an app like Google Authenticator. Strongest option.",
        startTotp, () => { setTotpOn(false); if (method === "totp") setMethod(emailOn ? "email" : null); toast({ kind: "info", msg: "Authenticator 2FA disabled" }); }),
      methodChip("email", "Email code", emailOn,
        "A 6-digit code sent to " + userEmail + " at login. Convenient.",
        startEmail, () => { setEmailOn(false); if (method === "email") setMethod(totpOn ? "totp" : null); toast({ kind: "info", msg: "Email 2FA disabled" }); }),

      // Enroll flow (shared)
      flow && h("div", { style: card },
        flow === "totp"
          ? h("div", null,
              h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 10 } }, "Scan this QR in your authenticator app, then enter the 6-digit code."),
              h("div", { style: { width: 120, height: 120, borderRadius: 8, background: "var(--bg-inset)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 12px", color: "var(--text-3)", fontSize: 11 } }, "QR"))
          : h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 10 } }, "We emailed a 6-digit code to ", h("strong", null, userEmail), ". Enter it below."),
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { className: "field mono", placeholder: "000000", maxLength: 8, value: code, onChange: (e) => setCode(e.target.value.replace(/[^0-9a-zA-Z]/g, "")), style: { width: 140, letterSpacing: 2 } }),
          h("button", { className: "btn btn-primary btn-sm", onClick: confirm }, "Verify"),
          flow === "email" && h("button", { className: "btn btn-ghost btn-sm", onClick: () => toast({ kind: "info", msg: "New code sent" }) }, "Resend"),
          h("button", { className: "btn btn-ghost btn-sm", onClick: () => setFlow(null) }, "Cancel"))),

      // Backup codes (after TOTP enable)
      backup && h("div", { style: card },
        h("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 6 } }, "Backup codes"),
        h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 } }, "Save these somewhere safe — each works once if you lose access to your factor."),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 } },
          backup.map((c) => h("code", { key: c, style: { fontSize: 12, fontFamily: "var(--font-mono)", padding: "5px 8px", background: "var(--bg-inset)", borderRadius: 5, textAlign: "center" } }, c)))));
  }

  function SecuritySec({ toast }) {
    const logins = [
      { when: "Jun 10, 09:02", device: "Chrome · macOS", loc: "San Francisco", ok: true },
      { when: "Jun 9, 22:14", device: "Safari · iOS", loc: "San Francisco", ok: true },
      { when: "Jun 7, 03:41", device: "Firefox · Linux", loc: "Lagos", ok: false }];
    return h("div", null, h(H2, null, "Security"),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", maxWidth: 460 } },
        h(Field, { label: "Current password" }, h("input", { className: "field", type: "password", placeholder: "••••••••" })),
        h("div", null),
        h(Field, { label: "New password" }, h("input", { className: "field", type: "password" })),
        h(Field, { label: "Confirm new password" }, h("input", { className: "field", type: "password" }))),
      h("button", { className: "btn btn-secondary btn-sm", style: { marginBottom: 22 } }, "Update password"),
      h(TwoFactorBlock, { toast }),
      h(SRow, { label: "Session timeout" }, h(Dropdown, { width: 140, defaultValue: "8 hours", options: ["1 hour", "8 hours", "24 hours", "7 days"] })),
      h("div", { style: { margin: "18px 0 8px", fontSize: 13, fontWeight: 650 } }, "Login history"),
      h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
        logins.map((l, i) =>
          h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 } },
            h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: l.ok ? "var(--sev-clean)" : "var(--sev-critical)", flexShrink: 0 } }),
            h("span", { style: { width: 110, color: "var(--text-2)" } }, l.when),
            h("span", { style: { flex: 1, fontWeight: 550 } }, l.device),
            h("span", { style: { color: "var(--text-3)" } }, l.loc),
            !l.ok && h("span", { className: "badge", style: { background: "var(--sev-critical-bg)", color: "var(--sev-critical)" } }, "Blocked")))));
  }

  function ApiKeysSec({ toast }) {
    const [shown, setShown] = useState({});
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState({});
    const keys = [
      { id: "gemini", name: "Gemini API key", value: "AIzaSyD-demo-key-redacted", status: "valid", verified: "2h ago" },
      { id: "openrouter", name: "OpenRouter API key", value: "sk-or-demo-key-redacted", status: "expiring", verified: "6d ago" }];
    function testAll() {
      setTesting(true); setResults({});
      keys.forEach((k, i) => setTimeout(() => setResults((r) => Object.assign({}, r, { [k.id]: "ok" })), 800 + i * 700));
      setTimeout(() => { setTesting(false); toast({ kind: "success", msg: "All keys valid" }); }, 800 + keys.length * 700);
    }
    return h("div", null, h(H2, null, "API Keys"),
      h("p", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 } },
        h(Icons.shieldCheck, { size: 14, style: { color: "var(--sev-clean)" } }), "Keys are encrypted at rest and only used for your scans."),
      keys.map((k) =>
        h("div", { key: k.id, style: { marginBottom: 14 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 } },
            h("label", { className: "flabel", style: { margin: 0 } }, k.name),
            h("span", { className: "badge", style: {
              background: k.status === "valid" ? "var(--sev-clean-bg)" : "var(--sev-high-bg)",
              color: k.status === "valid" ? "var(--sev-clean)" : "var(--sev-high)" } },
              k.status === "valid" ? "Valid" : "Expiring soon"),
            h("span", { style: { fontSize: 11, color: "var(--text-3)" } }, "verified " + k.verified),
            results[k.id] && h("span", { className: "fade-slide-enter", style: { display: "flex", color: "var(--sev-clean)" } }, h(Icons.check, { size: 15, sw: 2.5 }))),
          h("div", { style: { display: "flex", gap: 6 } },
            h("input", { className: "field mono", type: shown[k.id] ? "text" : "password", readOnly: true, value: k.value, style: { fontSize: 12 } }),
            h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, onClick: () => setShown((s) => Object.assign({}, s, { [k.id]: !s[k.id] })) },
              h(shown[k.id] ? Icons.eyeOff : Icons.eye, { size: 13 }))))),
      h("button", { className: "btn btn-primary btn-sm", onClick: testAll, disabled: testing },
        testing ? h("div", { className: "spinner", style: { width: 13, height: 13, borderTopColor: "var(--accent-text)" } }) : h(Icons.zap, { size: 13 }),
        testing ? "Testing…" : "Test All Keys"),
      h("div", { style: { marginTop: 22 } },
        h("label", { className: "flabel" }, "GitHub token (for private repos)"),
        h("div", { style: { display: "flex", gap: 6, maxWidth: 420 } },
          h("input", { className: "field mono", type: "password", readOnly: true, value: "ghp_demo_token", style: { fontSize: 12 } }),
          h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 } }, "Replace"))));
  }

  function ModelsSec() {
    const [order, setOrder] = useState(["Gemini 2.0 Flash", "OpenRouter / Claude Haiku"]);
    const [dragIdx, setDragIdx] = useState(null);
    const budgets = { "Gemini 2.0 Flash": 60, "OpenRouter / Claude Haiku": 40 };
    return h("div", null, h(H2, null, "Models"),
      h(SRow, { label: "Default model" }, h(Dropdown, { width: 200, options: ["Auto (recommended)"].concat(order) })),
      h("div", { style: { padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", border: "1px solid var(--border)", margin: "14px 0", fontSize: 12.5, color: "var(--text-2)", display: "flex", gap: 8 } },
        h(Icons.sparkle, { size: 15, style: { color: "var(--accent)", flexShrink: 0 } }),
        "Auto mode routes each segment to the fastest model with available quota, falls back down your chain on rate limits, and reserves your strongest model for cross-verifying Criticals."),
      h("div", { style: { fontSize: 13, fontWeight: 650, margin: "16px 0 8px" } }, "Fallback chain", h("span", { style: { fontWeight: 400, fontSize: 12, color: "var(--text-3)", marginLeft: 8 } }, "drag to reorder")),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 } },
        order.map((m, i) =>
          h("div", { key: m, draggable: true,
            onDragStart: () => setDragIdx(i),
            onDragOver: (e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) { setOrder((o) => { const n = [...o]; const [x] = n.splice(dragIdx, 1); n.splice(i, 0, x); return n; }); setDragIdx(i); } },
            onDragEnd: () => setDragIdx(null),
            style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: "var(--r-md)", background: dragIdx === i ? "var(--accent-soft)" : "var(--bg-surface)", border: "1px solid " + (dragIdx === i ? "var(--accent)" : "var(--border)"), cursor: "grab", transition: "background var(--dur-micro) ease, transform var(--dur-micro) var(--ease-spring)", transform: dragIdx === i ? "scale(1.01)" : "none" } },
            h("span", { className: "mono", style: { fontSize: 11, color: "var(--text-3)", width: 16 } }, i + 1),
            h(Icons.menu, { size: 13, style: { color: "var(--text-3)" } }),
            h("span", { style: { fontSize: 13, fontWeight: 550, flex: 1 } }, m),
            h("div", { style: { width: 160, display: "flex", alignItems: "center", gap: 8 } },
              h("input", { type: "range", min: 10, max: 100, defaultValue: budgets[m], style: { flex: 1, accentColor: "var(--accent)" } }),
              h("span", { className: "mono", style: { fontSize: 11, color: "var(--text-3)", width: 34 } }, budgets[m] + "k"))))),
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 8 } }, "Performance (last 30 days)"),
      h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
        [["Gemini 2.0 Flash", "1,204 segments", "1.8% FP rate", "640ms avg"],
         ["OpenRouter / Claude Haiku", "411 segments", "1.2% FP rate", "890ms avg"]].map(([name, segs, fp, ms], i) =>
          h("div", { key: name, style: { display: "flex", gap: 10, padding: "9px 14px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 } },
            h("span", { style: { flex: 1, fontWeight: 550 } }, name),
            h("span", { style: { color: "var(--text-2)" } }, segs),
            h("span", { style: { color: "var(--text-2)" } }, fp),
            h("span", { style: { color: "var(--text-3)" } }, ms)))));
  }

  function UsageSec() {
    return h("div", null, h(H2, null, "Usage"),
      h("div", { style: { marginBottom: 18 } },
        h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 } },
          h("span", { style: { fontWeight: 550 } }, "Current session"), h("span", { style: { color: "var(--text-3)" } }, "64% of daily quota")),
        h(ProgressBar, { value: 64 })),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 } },
        [["Scans this month", "12"], ["Lifetime segments", "48,211"], ["API calls (Gemini)", "9,402"], ["API calls (OpenRouter)", "7,156"]].map(([label, val]) =>
          h("div", { key: label, className: "card", style: { padding: "12px 16px" } },
            h("div", { style: { fontSize: 12, color: "var(--text-2)" } }, label),
            h("div", { style: { fontSize: 20, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" } }, val)))),
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 8 } }, "Daily tokens by model"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 } },
        [["Gemini 2.0 Flash", 72, "#7aa2f7"], ["OpenRouter", 28, "#c792ea"]].map(([name, pct, color]) =>
          h("div", { key: name },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 } },
              h("span", null, name), h("span", { className: "mono", style: { color: "var(--text-3)" } }, pct + "k / 100k")),
            h(ProgressBar, { value: pct, color })))),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-3)" } },
        "Last updated just now", h("button", { className: "btn btn-ghost btn-sm" }, h(Icons.refresh, { size: 12 }), "Refresh")));
  }

  function NotifSec() {
    const [email, setEmail] = useState({ complete: true, critical: true, watchlist: true, digest: true });
    const [inApp, setInApp] = useState(true);
    const rows = [["complete", "Scan complete"], ["critical", "Critical finding discovered"], ["watchlist", "Watchlist repo changed"], ["digest", "Weekly digest"]];
    return h("div", null, h(H2, null, "Notifications"),
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, "Email"),
      rows.map(([id, label]) =>
        h(window.SettingsRowHelper || SRow, { key: id, label },
          h(Switch, { on: email[id], onChange: (v) => setEmail((e) => Object.assign({}, e, { [id]: v })) }))),
      h("div", { style: { fontSize: 13, fontWeight: 650, margin: "18px 0 4px" } }, "In-app"),
      h(SRow, { label: "Show in-app notifications" }, h(Switch, { on: inApp, onChange: setInApp })));
  }

  function HelpSec() {
    const items = [["Documentation", "book"], ["Security glossary", "globe"], ["Keyboard shortcuts", "cmd"], ["Report a bug", "bug"], ["Contact support", "help"], ["Changelog", "sparkle"]];
    return h("div", null, h(H2, null, "Help & Support"),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
        items.map(([label, icon]) =>
          h("button", { key: label, className: "card card-hover", style: { padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" } },
            h(Icons[icon], { size: 16, style: { color: "var(--accent)" } }),
            h("span", { style: { fontSize: 13, fontWeight: 550 } }, label)))),
      h("div", { style: { marginTop: 20, fontSize: 12, color: "var(--text-3)" } }, "Akira AI v2.4.1 · © 2026 Akira AI Inc."));
  }
})();
