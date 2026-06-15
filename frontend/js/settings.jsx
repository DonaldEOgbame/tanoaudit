// VaultScan — Settings modal (Claude.ai style: left nav + content panel, searchable)
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useCallback } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { Switch, Tag, Avatar, ProgressBar, Dropdown } = window;
  const API = window.AkiraAPI;

  // Surface an AkiraAPI failure as a toast. Returns the message.
  function errMsg(e) {
    if (e && e.message) return e.message;
    if (e && e.code) return e.code;
    return "Something went wrong";
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function relTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    const diff = Date.now() - d.getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return m + "m ago";
    const hr = Math.round(m / 60);
    if (hr < 24) return hr + "h ago";
    const day = Math.round(hr / 24);
    if (day < 30) return day + "d ago";
    return d.toLocaleDateString();
  }

  // Small shared async-state helper: { loading, error, data, reload }.
  function useLoader(fn, deps) {
    const [state, setState] = useState({ loading: true, error: null, data: null });
    const ref = useRef(fn);
    ref.current = fn;
    const reload = useCallback(() => {
      let alive = true;
      setState((s) => ({ loading: true, error: null, data: s.data }));
      Promise.resolve()
        .then(() => ref.current())
        .then((data) => { if (alive) setState({ loading: false, error: null, data }); })
        .catch((e) => { if (alive) setState({ loading: false, error: errMsg(e), data: null }); });
      return () => { alive = false; };
    }, []); // eslint-disable-line
    useEffect(() => { return reload(); }, deps || []); // eslint-disable-line
    return [state, reload, setState];
  }

  function Spinner({ size = 16 }) {
    return h("div", { className: "spinner", style: { width: size, height: size } });
  }
  function LoadingBlock({ label }) {
    return h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "var(--text-3)", fontSize: 13 } },
      h(Spinner, null), label || "Loading…");
  }
  function ErrorBlock({ msg, onRetry }) {
    return h("div", { style: { padding: 16, borderRadius: "var(--r-md)", border: "1px solid var(--sev-high)", background: "var(--sev-high-bg)", fontSize: 12.5, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 10 } },
      h(Icons.alert, { size: 15, style: { color: "var(--sev-high)", flexShrink: 0 } }),
      h("span", { style: { flex: 1 } }, msg || "Failed to load"),
      onRetry && h("button", { className: "btn btn-secondary btn-sm", onClick: onRetry }, "Retry"));
  }

  const SECTIONS = [
    { id: "general", label: "General", icon: "settings" },
    { id: "profile", label: "Profile", icon: "users" },
    { id: "account", label: "Account", icon: "key" },
    { id: "privacy", label: "Privacy & Data", icon: "eye" },
    { id: "security", label: "Security", icon: "shield" },
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
    const safeToast = toast || function () {};

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
            sec === "general" && h(GeneralSec, { mode, setMode, toast: safeToast }),
            sec === "profile" && h(ProfileSec, { toast: safeToast }),
            sec === "account" && h(AccountSec, { toast: safeToast }),
            sec === "privacy" && h(PrivacySec, { toast: safeToast }),
            sec === "security" && h(SecuritySec, { toast: safeToast }),
            sec === "usage" && h(UsageSec, { toast: safeToast }),
            sec === "notifications" && h(NotifSec, { toast: safeToast }),
            sec === "handoff" && h(HandoffLinksSec, { toast: safeToast }),
            sec === "help" && h(HelpSec, null)))));
  }
  window.SettingsModal = SettingsModal;

  // Client-side preference persisted to localStorage. These are display-only
  // settings with no backend endpoint; persisting locally keeps the user's
  // choice across reloads instead of silently discarding it.
  function usePref(key, fallback) {
    const k = "akira.pref." + key;
    const [val, setVal] = useState(() => {
      try { return localStorage.getItem(k) || fallback; } catch (e) { return fallback; }
    });
    const set = (v) => { setVal(v); try { localStorage.setItem(k, v); } catch (e) {} };
    return [val, set];
  }

  function GeneralSec({ mode, setMode }) {
    const [lang, setLang] = usePref("language", "English");
    const [scanDepth, setScanDepth] = usePref("scanDepth", "Deep");
    const [tz, setTz] = usePref("timezone", "(GMT+0) UTC");
    const [dateFmt, setDateFmt] = usePref("dateFormat", "Jun 10, 2026");
    return h("div", null, h(H2, null, "General"),
      h(SRow, { label: "Appearance" },
        h("div", { style: { display: "flex", gap: 4, background: "var(--bg-inset)", padding: 3, borderRadius: 9 } },
          [["light", "sun", "Light"], ["dark", "moon", "Dark"]].map(([id, icon, label]) =>
            h("button", { key: id, onClick: () => setMode(id),
              style: { display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 7, fontSize: 12.5, fontWeight: 550,
                background: mode === id ? "var(--bg-surface)" : "transparent", color: mode === id ? "var(--text-1)" : "var(--text-2)",
                boxShadow: mode === id ? "var(--shadow-card)" : "none", transition: "all var(--dur-med) var(--ease-spring)" } },
              h(Icons[icon], { size: 14 }), label)))),
      h(SRow, { label: "Language" }, h(Dropdown, { width: 160, value: lang, onChange: setLang, options: ["English", "Deutsch", "日本語"] })),
      h(SRow, { label: "Default scan depth" }, h(Dropdown, { width: 160, value: scanDepth, onChange: setScanDepth, options: ["Fast", "Deep", "Thorough"] })),
      h(SRow, { label: "Timezone" }, h(Dropdown, { width: 220, value: tz, onChange: setTz, options: ["(GMT-8) Pacific Time", "(GMT+0) UTC", "(GMT+1) Berlin"] })),
      h(SRow, { label: "Date format" }, h(Dropdown, { width: 160, value: dateFmt, onChange: setDateFmt, options: ["Jun 10, 2026", "10/06/2026", "2026-06-10"] })));
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

  // Profile: load GET /profile, save via PATCH /profile.
  function ProfileSec({ toast }) {
    const countriesList = window.COUNTRIES || [];
    const [loaded, reload] = useLoader(() => API.profile.get(), []);
    const [form, setForm] = useState(null);
    const [countryISO, setCountryISO] = useState("US");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (!loaded.data) return;
      const p = loaded.data;
      setForm({
        full_name: p.full_name || "",
        display_name: p.display_name || "",
        phone: p.phone || "",
        country: p.country || "",
        organization: p.organization || "",
        job_title: p.job_title || "",
        website: p.website || "",
        bio: p.bio || "",
        work_type: p.work_type || "",
      });
      if (p.phone_country_code) {
        const m = countriesList.find((c) => c.dial_code === p.phone_country_code);
        if (m) setCountryISO(m.code);
      } else if (p.country) {
        const m = countriesList.find((c) => c.name === p.country);
        if (m) setCountryISO(m.code);
      }
    }, [loaded.data]); // eslint-disable-line

    if (loaded.loading && !form) return h("div", null, h(H2, null, "Profile"), h(LoadingBlock, { label: "Loading profile…" }));
    if (loaded.error && !form) return h("div", null, h(H2, null, "Profile"), h(ErrorBlock, { msg: loaded.error, onRetry: reload }));
    if (!form) return h("div", null, h(H2, null, "Profile"), h(LoadingBlock, null));

    const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));

    function handleISOChange(newISO) {
      setCountryISO(newISO);
      const match = countriesList.find((c) => c.code === newISO);
      if (match) set("country", match.name);
    }
    function handleCountryChange(newCountry) {
      set("country", newCountry);
      const match = countriesList.find((c) => c.name === newCountry);
      if (match) setCountryISO(match.code);
    }
    function validatePhone(iso, p) {
      const num = (p || "").replace(/\D/g, "");
      if (!num) return { valid: true };
      const activeCountry = countriesList.find((x) => x.code === iso);
      if (!activeCountry) return { valid: true };
      const len = num.length;
      if (len < activeCountry.min) return { valid: false, msg: `Too short for ${activeCountry.name} (needs ${activeCountry.min} digits)` };
      if (len > activeCountry.max) return { valid: false, msg: `Too long for ${activeCountry.name} (needs ${activeCountry.max} digits)` };
      return { valid: true };
    }
    const validation = validatePhone(countryISO, form.phone);
    const isoMatch = countriesList.find((c) => c.code === countryISO);

    const codeOptions = countriesList.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial_code}`, searchText: `${c.dial_code} ${c.name}` }));
    const countryOptions = countriesList.map((c) => ({ value: c.name, label: `${c.flag} ${c.name}`, searchText: `${c.name} ${c.code}` }));
    const initials = (form.full_name || loaded.data.email || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

    async function save() {
      if (!validation.valid) return;
      setSaving(true);
      try {
        const patch = {
          full_name: form.full_name || null,
          display_name: form.display_name || null,
          phone: form.phone || null,
          phone_country_code: isoMatch ? isoMatch.dial_code : null,
          country: form.country || null,
          organization: form.organization || null,
          job_title: form.job_title || null,
          website: form.website || null,
          bio: form.bio || null,
          work_type: form.work_type || null,
        };
        await API.profile.update(patch);
        toast({ kind: "success", msg: "Profile saved" });
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally {
        setSaving(false);
      }
    }

    const verified = loaded.data.email_verified;
    return h("div", null, h(H2, null, "Profile"),
      h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 } },
        h(Avatar, { initials: initials || "?", color: "var(--accent)", size: 56 }),
        h("div", null,
          h("button", { className: "btn btn-secondary btn-sm", disabled: true, title: "Avatar upload coming soon" }, h(Icons.upload, { size: 13 }), "Upload avatar"),
          h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 5 } }, "PNG or JPG, max 2 MB"))),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" } },
        h(Field, { label: "Full name" }, h("input", { className: "field", value: form.full_name, onChange: (e) => set("full_name", e.target.value) })),
        h(Field, { label: "Display name" }, h("input", { className: "field", value: form.display_name, onChange: (e) => set("display_name", e.target.value) })),
        h(Field, { label: "Email" },
          h("div", { style: { position: "relative" } },
            h("input", { className: "field", value: loaded.data.email, readOnly: true, style: { paddingRight: verified ? 76 : 8, color: "var(--text-2)" } }),
            verified && h("span", { className: "badge", style: { position: "absolute", right: 8, top: 7, background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h(Icons.check, { size: 11 }), "Verified"))),
        h(Field, { label: "Phone number" },
          h("div", { style: { display: "flex", flexDirection: "column" } },
            h("div", { style: { display: "flex", gap: 6 } },
              h(SearchableSelect, {
                value: countryISO, options: codeOptions, onChange: handleISOChange,
                style: { width: 120, flexShrink: 0 },
                triggerStyle: { borderColor: !validation.valid ? "var(--sev-critical)" : "var(--border)" },
                placeholder: "Search code..."
              }),
              h("input", {
                className: "field",
                style: { borderColor: !validation.valid ? "var(--sev-critical)" : "var(--border)" },
                value: form.phone, onChange: (e) => set("phone", e.target.value)
              })),
            !validation.valid && h("div", { style: { color: "var(--sev-critical)", fontSize: 11.5, marginTop: 4, display: "flex", alignItems: "center", gap: 4 } },
              h(Icons.alert, { size: 12, style: { color: "var(--sev-critical)" } }), validation.msg))),
        h(Field, { label: "Country / Region" },
          h(SearchableSelect, { value: form.country, options: countryOptions, onChange: handleCountryChange, placeholder: "Search country..." })),
        h(Field, { label: "Organization" }, h("input", { className: "field", value: form.organization, onChange: (e) => set("organization", e.target.value) })),
        h(Field, { label: "Job title" }, h("input", { className: "field", value: form.job_title, onChange: (e) => set("job_title", e.target.value) })),
        h(Field, { label: "Website / GitHub" }, h("input", { className: "field", value: form.website, onChange: (e) => set("website", e.target.value) }))),
      h(Field, { label: "Bio" }, h("textarea", { className: "field", rows: 2, value: form.bio, onChange: (e) => set("bio", e.target.value), style: { resize: "none" } })),
      h(Field, { label: "What best describes your work?" },
        h(Dropdown, { width: 300, value: form.work_type || undefined, defaultValue: form.work_type || undefined,
          onChange: (v) => set("work_type", v),
          options: ["Backend engineering", "Security engineering", "Full-stack development", "Engineering leadership"] })),
      h("button", { className: "btn btn-primary", disabled: !validation.valid || saving, style: { marginTop: 6 }, onClick: save },
        saving && h(Spinner, { size: 13 }), saving ? "Saving…" : "Save changes"));
  }

  // Account: change email (not supported by backend), organization id (no endpoint),
  // active sessions list + revoke, danger zone (no endpoint).
  function AccountSec({ toast }) {
    const [loaded, reload, setState] = useLoader(() => Promise.all([API.profile.get(), API.security.sessions()]), []);
    const [revoking, setRevoking] = useState({});

    async function revoke(id) {
      setRevoking((r) => Object.assign({}, r, { [id]: true }));
      try {
        await API.security.deleteSession(id);
        toast({ kind: "info", msg: "Session revoked" });
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        setRevoking((r) => Object.assign({}, r, { [id]: false }));
      }
    }

    const profile = loaded.data && loaded.data[0];
    const sessions = (loaded.data && loaded.data[1]) || [];

    return h("div", null, h(H2, null, "Account"),
      loaded.loading && !loaded.data
        ? h(LoadingBlock, { label: "Loading account…" })
        : loaded.error
          ? h(ErrorBlock, { msg: loaded.error, onRetry: reload })
          : h("div", null,
              h(SRow, { label: "Email", desc: profile ? profile.email : "—" }, h("span", { style: { fontSize: 11.5, color: "var(--text-3)" } }, profile && profile.email_verified ? "Verified" : "Unverified")),
              h(SRow, { label: "Account ID", desc: profile ? profile.id : "—" },
                h("button", { className: "btn btn-secondary btn-sm", onClick: () => { try { navigator.clipboard.writeText(profile.id); } catch (e) {} toast({ kind: "success", msg: "Copied" }); } }, h(Icons.copy, { size: 13 }), "Copy")),
              h("div", { style: { margin: "18px 0 8px", fontSize: 13, fontWeight: 650 } }, "Active sessions"),
              sessions.length === 0
                ? h("div", { className: "empty-state" }, h(Icons.shield, { size: 22, style: { color: "var(--text-3)", margin: "0 auto 8px" } }), h("h3", null, "No active sessions"))
                : h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 10 } },
                    sessions.map((s, i) =>
                      h("div", { key: s.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 } },
                        h("div", { style: { flex: 1, minWidth: 0 } },
                          h("div", { style: { fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.device || "Unknown device",
                            s.current && h("span", { className: "badge", style: { marginLeft: 8, background: "var(--accent-soft)", color: "var(--accent)" } }, "Current")),
                          h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, (s.location || s.ip || "—") + " · active " + relTime(s.last_active_at))),
                        !s.current && h("button", { className: "btn btn-ghost btn-sm", disabled: !!revoking[s.id], onClick: () => revoke(s.id) }, revoking[s.id] ? "…" : "Revoke")))),
              h("div", { style: { marginTop: 26, padding: 16, borderRadius: "var(--r-md)", border: "1px solid var(--sev-critical)", background: "var(--sev-critical-bg)" } },
                h("div", { style: { fontSize: 13, fontWeight: 650, color: "var(--sev-critical)", marginBottom: 4 } }, "Danger zone"),
                h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 10 } }, "Permanently delete your account, scans, and all associated data."),
                // TODO(no-endpoint): no DELETE /account endpoint exists yet.
                h("button", { className: "btn btn-danger btn-sm", disabled: true, title: "Account deletion is not available yet" }, "Delete account"))));
  }

  // Privacy: GET/PUT /settings/privacy.
  function PrivacySec({ toast }) {
    const [loaded, reload] = useLoader(() => API.settings.getPrivacy(), []);
    const [improve, setImprove] = useState(true);
    const [history, setHistory] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
      if (!loaded.data) return;
      setImprove(!!loaded.data.improve_ai);
      setHistory(!!loaded.data.store_scan_history);
    }, [loaded.data]);

    async function persist(next) {
      setSaving(true);
      try {
        await API.settings.putPrivacy(next);
        toast({ kind: "success", msg: "Privacy settings saved" });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        reload();
      } finally {
        setSaving(false);
      }
    }
    function onImprove(v) { setImprove(v); persist({ improve_ai: v, store_scan_history: history }); }
    function onHistory(v) { setHistory(v); persist({ improve_ai: improve, store_scan_history: v }); }

    const explainers = [
      ["What we store", "Scan metadata, findings, and snippets of flagged code (max 40 lines per finding). We never store your full repository."],
      ["Where code goes", "Code segments are sent to Akira's AI models for analysis, then discarded. They are never used to train models."],
      ["Retention", "Scan history is kept until you delete it. Deleted scans are purged from backups within 30 days."]];

    return h("div", null, h(H2, null, "Privacy & Data"),
      explainers.map(([title, body], i) =>
        h("div", { key: i, style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", marginBottom: 8, overflow: "hidden" } },
          h("button", { onClick: () => setExpanded(expanded === i ? null : i), style: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", fontSize: 13, fontWeight: 550 } },
            h(Icons.chevD, { size: 13, style: { transform: expanded === i ? "none" : "rotate(-90deg)", transition: "transform var(--dur-micro) ease", color: "var(--text-3)" } }), title),
          expanded === i && h("div", { className: "fade-slide-enter", style: { padding: "0 14px 12px 35px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 } }, body))),
      loaded.error
        ? h("div", { style: { marginTop: 14 } }, h(ErrorBlock, { msg: loaded.error, onRetry: reload }))
        : h("div", { style: { marginTop: 14, opacity: loaded.loading ? 0.6 : 1 } },
            h(SRow, { label: "Help improve Akira AI", desc: "Share anonymized finding feedback" }, h(Switch, { on: improve, onChange: onImprove })),
            h(SRow, { label: "Store scan history", desc: "Required for trends and scan diffs" }, h(Switch, { on: history, onChange: onHistory }))),
      h("div", { style: { display: "flex", gap: 8, marginTop: 16 } },
        // TODO(no-endpoint): no data-export / delete-history endpoints exist yet.
        h("button", { className: "btn btn-secondary btn-sm", disabled: true, title: "Data export is not available yet" }, h(Icons.download, { size: 13 }), "Export all data"),
        h("button", { className: "btn btn-danger btn-sm", disabled: true, title: "Bulk delete is not available yet" }, "Delete all scan history")));
  }

  // Handoff links: GET /handoff-links, DELETE /handoff-links/{id}.
  function HandoffLinksSec({ toast }) {
    const [loaded, reload] = useLoader(() => API.handoff.links(), []);
    const [revoking, setRevoking] = useState({});
    const links = loaded.data || [];

    const statusStyle = {
      active: { bg: "var(--sev-clean-bg)", c: "var(--sev-clean)" },
      used: { bg: "var(--bg-active)", c: "var(--text-2)" },
      expired: { bg: "var(--bg-active)", c: "var(--text-3)" },
      revoked: { bg: "var(--sev-critical-bg)", c: "var(--sev-critical)" },
    };
    const scopeLabels = {
      all: "Everything", critical_high: "Critical + High", security: "Security only",
      optimizations: "Optimizations", stubs: "Stub implementations", custom: "Custom rules",
    };

    async function revoke(id) {
      setRevoking((r) => Object.assign({}, r, { [id]: true }));
      try {
        await API.handoff.deleteLink(id);
        toast({ kind: "info", msg: "Handoff link revoked" });
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        setRevoking((r) => Object.assign({}, r, { [id]: false }));
      }
    }

    return h("div", null, h(H2, null, "Handoff links"),
      h("p", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 16, maxWidth: 560 } },
        "Single-use links you've generated for Claude Code. Each is created from a scan report (“Hand off to Claude Code”), expires after 24 hours, and can be revoked here."),
      loaded.loading && !loaded.data
        ? h(LoadingBlock, { label: "Loading handoff links…" })
        : loaded.error
          ? h(ErrorBlock, { msg: loaded.error, onRetry: reload })
          : links.length === 0
            ? h("div", { className: "empty-state" }, h(Icons.terminal, { size: 24, style: { color: "var(--text-3)", margin: "0 auto 8px" } }), h("h3", null, "No handoff links yet"), h("p", null, "Open a scan report and choose “Hand off to Claude Code”."))
            : h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
                links.map((l, i) => {
                  const st = statusStyle[l.status] || statusStyle.expired;
                  const scopeLabel = scopeLabels[l.scope] || l.scope;
                  return h("div", { key: l.id, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--border)" : "none" } },
                    h("div", { style: { flex: 1, minWidth: 0 } },
                      h("div", { style: { fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 } }, scopeLabel,
                        h("span", { className: "badge", style: { background: st.bg, color: st.c } }, l.status)),
                      h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" } },
                        h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 } }, h(Icons.github, { size: 11 }), l.audit_id),
                        h("span", null, "created " + relTime(l.created_at)),
                        l.status === "active" && h("span", null, "expires " + fmtDateTime(l.expires_at)))),
                    l.status === "active"
                      ? h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, disabled: !!revoking[l.id], onClick: () => revoke(l.id) }, revoking[l.id] ? "…" : "Revoke")
                      : h("span", { style: { fontSize: 11.5, color: "var(--text-3)", width: 56, textAlign: "right" } }, ""));
                })));
  }

  // Two-factor block: TOTP + email OTP enroll/verify/disable, set active method, backup codes.
  function TwoFactorBlock({ toast, userEmail }) {
    const [loaded, reload] = useLoader(() => API.security.totpStatus(), []);
    const [flow, setFlow] = useState(null);             // "totp" | "email" enroll flow
    const [code, setCode] = useState("");
    const [enroll, setEnroll] = useState(null);         // { secret, otpauth_uri } for TOTP
    const [backup, setBackup] = useState(null);
    const [busy, setBusy] = useState(false);

    const status = loaded.data || { totp_enabled: false, email_otp_enabled: false, method: null };
    const totpOn = !!status.totp_enabled;
    const emailOn = !!status.email_otp_enabled;
    const method = status.method;

    async function startTotp() {
      setBusy(true); setCode(""); setBackup(null);
      try {
        const res = await API.security.enrollTotp();
        setEnroll(res);
        setFlow("totp");
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
    }
    async function startEmail() {
      setBusy(true); setCode(""); setBackup(null);
      try {
        await API.security.enrollEmailOtp();
        setFlow("email");
        toast({ kind: "info", msg: "Code sent to " + userEmail });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
    }
    async function confirm() {
      if (code.trim().length < 4) { toast({ kind: "error", msg: "Enter the code" }); return; }
      setBusy(true);
      try {
        if (flow === "totp") {
          const res = await API.security.verifyTotp(code.trim());
          setBackup(res && res.codes ? res.codes : null);
          toast({ kind: "success", msg: "Authenticator 2FA enabled" });
        } else {
          await API.security.verifyEmailOtp(code.trim());
          toast({ kind: "success", msg: "Email 2FA enabled" });
        }
        setFlow(null); setCode(""); setEnroll(null);
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
    }
    async function disableTotp() {
      const c = window.prompt("Enter a current 6-digit authenticator code to disable TOTP 2FA:");
      if (!c) return;
      setBusy(true);
      try {
        // NOTE: backend POST /security/2fa/disable requires the current TOTP code.
        await API.security.disableTotp(c.trim());
        toast({ kind: "info", msg: "Authenticator 2FA disabled" });
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
    }
    async function disableEmail() {
      setBusy(true);
      try {
        await API.security.disableEmailOtp();
        toast({ kind: "info", msg: "Email 2FA disabled" });
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
    }
    async function makeActive(id, label) {
      setBusy(true);
      try {
        await API.security.setMethod(id);
        toast({ kind: "success", msg: "Active factor set to " + label });
        reload();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
    }
    async function regenBackup() {
      setBusy(true);
      try {
        const res = await API.security.backupCodes();
        setBackup(res && res.codes ? res.codes : null);
        toast({ kind: "success", msg: "New backup codes generated" });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setBusy(false); }
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
              (totpOn && emailOn && method !== id) && h("button", { className: "btn btn-ghost btn-sm", disabled: busy, onClick: () => makeActive(id, label) }, "Make active"),
              h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, disabled: busy, onClick: onDisable }, "Disable"))
          : h("button", { className: "btn btn-secondary btn-sm", disabled: busy, onClick: onEnable }, "Enable"));

    return h("div", { style: { maxWidth: 520, marginBottom: 22 } },
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 8 } }, "Two-factor authentication"),
      loaded.error && h("div", { style: { marginBottom: 10 } }, h(ErrorBlock, { msg: loaded.error, onRetry: reload })),
      methodChip("totp", "Authenticator app", totpOn,
        "TOTP codes from an app like Google Authenticator. Strongest option.",
        startTotp, disableTotp),
      methodChip("email", "Email code", emailOn,
        "A 6-digit code sent to " + userEmail + " at login. Convenient.",
        startEmail, disableEmail),

      // Enroll flow (shared)
      flow && h("div", { style: card },
        flow === "totp"
          ? h("div", null,
              h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 10 } }, "Add this secret to your authenticator app, then enter the 6-digit code."),
              enroll && enroll.secret && h("div", { style: { marginBottom: 10 } },
                h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 4 } }, "Secret"),
                h("code", { style: { fontSize: 12, fontFamily: "var(--font-mono)", padding: "5px 8px", background: "var(--bg-inset)", borderRadius: 5, display: "inline-block", wordBreak: "break-all" } }, enroll.secret)),
              enroll && enroll.otpauth_uri && h("div", { style: { fontSize: 11, color: "var(--text-3)", wordBreak: "break-all", marginBottom: 6 } }, enroll.otpauth_uri))
          : h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 10 } }, "We emailed a 6-digit code to ", h("strong", null, userEmail), ". Enter it below."),
        h("div", { style: { display: "flex", gap: 8 } },
          h("input", { className: "field mono", placeholder: "000000", maxLength: 8, value: code, onChange: (e) => setCode(e.target.value.replace(/[^0-9a-zA-Z]/g, "")), style: { width: 140, letterSpacing: 2 } }),
          h("button", { className: "btn btn-primary btn-sm", disabled: busy, onClick: confirm }, busy ? "…" : "Verify"),
          flow === "email" && h("button", { className: "btn btn-ghost btn-sm", disabled: busy, onClick: startEmail }, "Resend"),
          h("button", { className: "btn btn-ghost btn-sm", onClick: () => { setFlow(null); setEnroll(null); } }, "Cancel"))),

      // Backup codes (after TOTP enable / regen)
      backup && h("div", { style: card },
        h("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 6 } }, "Backup codes"),
        h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 } }, "Save these somewhere safe — each works once if you lose access to your factor."),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 } },
          backup.map((c) => h("code", { key: c, style: { fontSize: 12, fontFamily: "var(--font-mono)", padding: "5px 8px", background: "var(--bg-inset)", borderRadius: 5, textAlign: "center" } }, c)))),

      totpOn && !flow && h("button", { className: "btn btn-ghost btn-sm", disabled: busy, onClick: regenBackup }, "Regenerate backup codes"));
  }

  // Security: change password, 2FA block, login history.
  function SecuritySec({ toast }) {
    const [profileState, reloadProfile] = useLoader(() => API.profile.get(), []);
    const [history, reloadHistory] = useLoader(() => API.security.loginHistory(), []);
    const [cur, setCur] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [saving, setSaving] = useState(false);
    const userEmail = (profileState.data && profileState.data.email) || "you@example.com";

    async function updatePassword() {
      if (!cur || !next) { toast({ kind: "error", msg: "Fill in both password fields" }); return; }
      if (next.length < 8) { toast({ kind: "error", msg: "New password must be at least 8 characters" }); return; }
      if (next !== confirm) { toast({ kind: "error", msg: "Passwords do not match" }); return; }
      setSaving(true);
      try {
        await API.security.changePassword(cur, next);
        toast({ kind: "success", msg: "Password updated" });
        setCur(""); setNext(""); setConfirm("");
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally { setSaving(false); }
    }

    // Session timeout is stored on the profile (session_timeout_minutes).
    const TIMEOUTS = [["1 hour", 60], ["8 hours", 480], ["24 hours", 1440], ["7 days", 10080]];
    const curMins = profileState.data && profileState.data.session_timeout_minutes;
    const curTimeout = (TIMEOUTS.find(([, m]) => m === curMins) || TIMEOUTS[1])[0];
    async function setTimeout_(label) {
      const mins = (TIMEOUTS.find(([l]) => l === label) || [])[1];
      if (mins == null) return;
      try {
        await API.profile.update({ session_timeout_minutes: mins });
        toast({ kind: "success", msg: "Session timeout updated" });
        reloadProfile();
      } catch (e) { toast({ kind: "error", msg: errMsg(e) }); }
    }

    const logins = history.data || [];
    return h("div", null, h(H2, null, "Security"),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", maxWidth: 460 } },
        h(Field, { label: "Current password" }, h("input", { className: "field", type: "password", placeholder: "••••••••", value: cur, onChange: (e) => setCur(e.target.value) })),
        h("div", null),
        h(Field, { label: "New password" }, h("input", { className: "field", type: "password", value: next, onChange: (e) => setNext(e.target.value) })),
        h(Field, { label: "Confirm new password" }, h("input", { className: "field", type: "password", value: confirm, onChange: (e) => setConfirm(e.target.value) }))),
      h("button", { className: "btn btn-secondary btn-sm", style: { marginBottom: 22 }, disabled: saving, onClick: updatePassword }, saving ? "Updating…" : "Update password"),
      h(TwoFactorBlock, { toast, userEmail }),
      h(SRow, { label: "Session timeout" }, h(Dropdown, { width: 140, value: curTimeout, onChange: setTimeout_, options: TIMEOUTS.map(([l]) => l) })),
      h("div", { style: { margin: "18px 0 8px", fontSize: 13, fontWeight: 650 } }, "Login history"),
      history.loading && !history.data
        ? h(LoadingBlock, { label: "Loading login history…" })
        : history.error
          ? h(ErrorBlock, { msg: history.error, onRetry: reloadHistory })
          : logins.length === 0
            ? h("div", { className: "empty-state" }, h(Icons.shield, { size: 22, style: { color: "var(--text-3)", margin: "0 auto 8px" } }), h("h3", null, "No login history"))
            : h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
                logins.map((l, i) =>
                  h("div", { key: l.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12.5 } },
                    h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: l.success ? "var(--sev-clean)" : "var(--sev-critical)", flexShrink: 0 } }),
                    h("span", { style: { width: 110, color: "var(--text-2)" } }, fmtDateTime(l.created_at)),
                    h("span", { style: { flex: 1, fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, l.device || "Unknown"),
                    h("span", { style: { color: "var(--text-3)" } }, l.location || l.ip || ""),
                    !l.success && h("span", { className: "badge", style: { background: "var(--sev-critical-bg)", color: "var(--sev-critical)" } }, "Blocked")))));
  }

  // Usage: GET /usage. All limits come from the backend — the daily-scan cap for
  // the top card, and the per-tier daily token limit returned alongside each
  // model row. The UI never invents quota numbers.
  function UsageSec({ toast }) {
    const [loaded, reload] = useLoader(() => API.usage.get(), []);

    if (loaded.loading && !loaded.data) return h("div", null, h(H2, null, "Usage"), h(LoadingBlock, { label: "Loading usage…" }));
    if (loaded.error) return h("div", null, h(H2, null, "Usage"), h(ErrorBlock, { msg: loaded.error, onRetry: reload }));

    const d = loaded.data || {};
    const scans = d.daily_scans || { used: 0, limit: 0, remaining: 0 };
    const scanPct = scans.limit ? Math.min(100, Math.round((scans.used / scans.limit) * 100)) : 0;
    const dailyByModel = d.daily_tokens_by_model || [];

    return h("div", { style: { display: "flex", flexDirection: "column", gap: 20 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h(H2, null, "Usage"),
        h("button", { className: "btn btn-ghost btn-sm", onClick: reload, style: { padding: "4px 8px" } },
          h(Icons.refresh, { size: 13, style: { marginRight: 4 } }), "Refresh")
      ),

      // Daily scan quota card (the real rolling-24h cap the backend enforces).
      h("div", { className: "card", style: { padding: "16px 20px", background: "linear-gradient(135deg, var(--bg-surface), var(--accent-soft))", border: "1px solid var(--accent-border)" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8 } },
          h("span", { style: { color: "var(--text-1)" } }, "Daily scans"),
          h("span", { style: { color: "var(--accent)" } }, scanPct + "% of daily limit")
        ),
        h(ProgressBar, { value: scanPct }),
        h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 8 } },
          "You've used " + scans.used + " of " + scans.limit + " scans in the last 24 hours · " + scans.remaining + " remaining."
        )
      ),

      // Daily token usage per model, against the backend-reported per-tier limit.
      h("div", { className: "card", style: { padding: "18px 20px" } },
        h("div", { style: { fontSize: 13.5, fontWeight: 650, marginBottom: 14, color: "var(--text-1)" } }, "Daily token usage by model"),
        dailyByModel.length === 0
          ? h("div", { style: { fontSize: 12.5, color: "var(--text-3)" } }, "No model usage in the last 24 hours.")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
              dailyByModel.map((m) => {
                const tokens = m.tokens || 0;
                const limit = m.limit || 0;
                const pct = limit ? Math.min(100, Math.round((tokens / limit) * 100)) : 0;
                return h("div", { key: m.label },
                  h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 6 } },
                    h("span", { style: { fontWeight: 550, color: "var(--text-2)" } }, m.label),
                    h("span", { className: "mono", style: { color: "var(--text-1)", fontWeight: 600 } }, pct + "%")
                  ),
                  h(ProgressBar, { value: pct }),
                  h("div", { style: { fontSize: 11, color: "var(--text-3)", marginTop: 4 } },
                    tokens.toLocaleString() + (limit ? " / " + limit.toLocaleString() + " tokens" : " tokens"))
                );
              })
            )
      ),

      h("div", { style: { fontSize: 11, color: "var(--text-3)", textAlign: "right" } },
        "Last updated " + relTime(d.last_updated)
      )
    );
  }

  // Notifications: GET/PUT /notifications/preferences.
  function NotifSec({ toast }) {
    const [loaded, reload] = useLoader(() => API.notifications.getPreferences(), []);
    const [prefs, setPrefs] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (loaded.data) setPrefs(Object.assign({}, loaded.data));
    }, [loaded.data]);

    const rows = [
      ["scan_complete", "Scan complete"],
      ["critical_found", "Critical finding discovered"],
      ["watchlist_changed", "Watchlist repo changed"],
      ["weekly_digest", "Weekly digest"],
    ];

    async function update(key, value) {
      const next = Object.assign({}, prefs, { [key]: value });
      setPrefs(next);
      setSaving(true);
      try {
        await API.notifications.putPreferences(next);
        toast({ kind: "success", msg: "Notification preferences saved" });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        reload();
      } finally { setSaving(false); }
    }

    if (loaded.loading && !prefs) return h("div", null, h(H2, null, "Notifications"), h(LoadingBlock, { label: "Loading preferences…" }));
    if (loaded.error && !prefs) return h("div", null, h(H2, null, "Notifications"), h(ErrorBlock, { msg: loaded.error, onRetry: reload }));
    if (!prefs) return h("div", null, h(H2, null, "Notifications"), h(LoadingBlock, null));

    return h("div", { style: { opacity: saving ? 0.7 : 1 } }, h(H2, null, "Notifications"),
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, "Email & alerts"),
      rows.map(([id, label]) =>
        h(SRow, { key: id, label },
          h(Switch, { on: !!prefs[id], onChange: (v) => update(id, v) }))),
      h("div", { style: { fontSize: 13, fontWeight: 650, margin: "18px 0 4px" } }, "In-app"),
      h(SRow, { label: "Show in-app notifications" }, h(Switch, { on: !!prefs.in_app, onChange: (v) => update("in_app", v) })));
  }

  function HelpSec() {
    const DOCS = "https://github.com/donaldemmaogbame/AkiraAI";
    const SUPPORT = "mailto:support@akira.ai?subject=Akira%20AI%20Support";
    const BUG = "mailto:support@akira.ai?subject=Akira%20AI%20Bug%20Report";
    // Each item: [label, icon, action]. Doc-style links open the repo/docs in a
    // new tab; support/bug open a pre-filled mail draft.
    const items = [
      ["Documentation", "book", () => window.open(DOCS + "#readme", "_blank")],
      ["Security glossary", "globe", () => window.open(DOCS + "/blob/main/backend/README.md", "_blank")],
      ["Keyboard shortcuts", "cmd", () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))],
      ["Report a bug", "bug", () => { window.location.href = BUG; }],
      ["Contact support", "help", () => { window.location.href = SUPPORT; }],
      ["Changelog", "sparkle", () => window.open(DOCS + "/commits/main", "_blank")],
    ];
    return h("div", null, h(H2, null, "Help & Support"),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
        items.map(([label, icon, action]) =>
          h("button", { key: label, className: "card card-hover", onClick: action, style: { padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer" } },
            h(Icons[icon], { size: 16, style: { color: "var(--accent)" } }),
            h("span", { style: { fontSize: 13, fontWeight: 550 } }, label)))),
      h("div", { style: { marginTop: 20, fontSize: 12, color: "var(--text-3)" } }, "Akira AI v2.4.1 · © 2026 Akira AI Inc."));
  }
})();
