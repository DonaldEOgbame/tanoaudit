// VaultScan — Sidebar, Command Palette, Profile popover
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { Avatar, SevDot } = window;

  function Logo({ size, collapsed }) {
    const [isLight, setIsLight] = useState(
      document.documentElement.getAttribute("data-mode") === "light"
    );
    useEffect(() => {
      const obs = new MutationObserver(() => {
        setIsLight(document.documentElement.getAttribute("data-mode") === "light");
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
      return () => obs.disconnect();
    }, []);

    if (collapsed) {
      return h("img", { src: "logo-collapsed.svg", style: { width: 80, height: 80, objectFit: "contain", flexShrink: 0 }, alt: "Akira AI Icon" });
    }
    return h("img", { src: isLight ? "lightmode-logo.svg" : "logo.svg", style: { height: 54, width: "auto", maxWidth: 200, objectFit: "contain" }, alt: "Akira AI" });
  }
  window.Logo = Logo;

  const NAV = [
    { section: "Scans", icon: "list", page: "scans" },
    { section: "Watchlist", icon: "bookmark", page: "watchlist", badge: "↑3" },
    { section: "Reports", icon: "report", page: "reports" },
    { section: "Custom Vulnerabilities", icon: "bug", page: "custom", count: 5 },
    { section: "Optimization Plans", icon: "sliders", page: "plans" },
    { section: "Integrations", icon: "github", page: "integrations", status: true },
    { section: "Learning Hub", icon: "book", page: "learning" },
  ];

  function displayName(user) {
    if (!user) return "Alex Rivera";
    return user.display_name || user.full_name || (user.email ? user.email.split("@")[0] : "Account");
  }
  function userInitials(user) {
    const name = displayName(user);
    const parts = name.trim().split(/\s+/);
    const a = parts[0] ? parts[0][0] : "A";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0] && parts[0][1] ? parts[0][1] : "");
    return (a + b).toUpperCase();
  }

  function Sidebar({ page, nav, collapsed, setCollapsed, onNewScan, onCmd, openSettings, demoState, user, onLogout }) {
    const [profileOpen, setProfileOpen] = useState(false);
    // Recent scans from the backend (falls back to demo data if the call fails).
    const [scans, setScans] = useState([]);
    useEffect(() => {
      let alive = true;
      if (!window.AkiraAPI) { setScans(window.VS_SCANS || []); return; }
      window.AkiraAPI.scans.list({ limit: 8 })
        .then((res) => {
          if (!alive) return;
          const items = (res && res.items) || [];
          setScans(items.map((s) => ({
            id: s.id,
            repo: s.repo || s.source_url || "scan",
            sev: (s.worst_severity && s.worst_severity !== "clean") ? s.worst_severity : "info",
            issues: s.status === "completed" ? "" : (s.status || ""),
          })));
        })
        .catch(() => { if (alive) setScans([]); });
      return () => { alive = false; };
    }, []);
    const hasScans = scans.length > 0;

    // Live sidebar counters: watchlist alerts, custom-vuln rules, GitHub status.
    const [meta, setMeta] = useState({ alerts: 0, customCount: null, ghConnected: false });

    function reloadMeta() {
      const API = window.AkiraAPI;
      if (!API) return;
      Promise.allSettled([API.watchlist.alerts(), API.customVulns.list(), API.github.status()])
        .then(([al, cv, gh]) => {
          const alertsArr = al.status === "fulfilled" ? (al.value && (al.value.items || al.value)) : [];
          const cvArr = cv.status === "fulfilled" ? (cv.value && (cv.value.items || cv.value)) : null;
          const ghVal = gh.status === "fulfilled" ? gh.value : null;
          setMeta({
            alerts: Array.isArray(alertsArr) ? alertsArr.length : 0,
            customCount: Array.isArray(cvArr) ? cvArr.length : null,
            ghConnected: !!(ghVal && (ghVal.connected || ghVal.status === "connected")),
          });
        });
    }

    useEffect(() => {
      reloadMeta();
      window.addEventListener("akira:custom-vulns-changed", reloadMeta);
      return () => {
        window.removeEventListener("akira:custom-vulns-changed", reloadMeta);
      };
    }, []);

    // Resolve each NAV row's badge/count/status from live data (falls back to
    // the static prototype values only when no API is present).
    function navMeta(n) {
      if (!window.AkiraAPI) return { badge: n.badge, count: n.count, status: n.status };
      if (n.page === "watchlist") return { badge: meta.alerts > 0 ? ("↑" + meta.alerts) : null };
      if (n.page === "custom") return { count: meta.customCount };
      if (n.page === "integrations") return { status: meta.ghConnected };
      return {};
    }

    return h("aside", { className: "vs-sidebar" + (collapsed ? " collapsed" : "") },
      // Head
      h("div", { className: "sb-head", style: collapsed ? { justifyContent: "center" } : {} },
        h("button", { className: "sb-logo", onClick: () => nav("dashboard"), style: { background: "none" } },
          h(Logo, { size: 22, collapsed }),
          !collapsed && h("span", { style: { display: "none" } }),
        ),
        h("button", {
          className: "icon-btn",
          onClick: () => setCollapsed(!collapsed),
          "data-tip": collapsed ? "Expand" : "Collapse",
          style: collapsed ? { width: 32 } : {}
        }, h(Icons.panelLeft, { size: 16 })),
      ),

      // New scan button
      h("div", { style: { padding: collapsed ? "0 4px 4px" : "0 12px 8px" } },
        h("button", { className: "btn btn-primary", style: { width: "100%", padding: collapsed ? "8px 0" : "9px 14px", justifyContent: "center" }, onClick: onNewScan },
          h(Icons.plus, { size: 16, sw: 2.2 }), !collapsed && "New Scan")),

      // Scroll area
      h("div", { className: "sb-scroll" },
        // Top nav items (Watchlist, Reports, etc.)
        NAV.slice(1).map((n) => {
          const m = navMeta(n);
          return h("button", { key: n.page, className: "sb-item" + (page === n.page ? " active" : ""),
            onClick: () => nav(n.page), "data-tip": collapsed ? n.section : null },
            h(Icons[n.icon], { size: 17 }),
            !collapsed && h("span", { className: "sbi-label" }, n.section),
            !collapsed && m.badge && demoState !== "first-run" && h("span", { className: "badge", style: { background: "var(--accent-soft)", color: "var(--accent)", fontSize: 10 } }, m.badge, " new"),
            !collapsed && m.count != null && h("span", { style: { fontSize: 11, color: "var(--text-3)" } }, m.count),
            !collapsed && m.status && h("span", { className: "pulse-dot", style: { width: 7, height: 7, borderRadius: "50%", background: "var(--sev-clean)" }, "data-tip": "Connected" }),
          );
        }),

        // Search / cmd — above Scans
        !collapsed && h("div", { style: { padding: "8px 2px 2px" } },
          h("button", { onClick: onCmd, style: {
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            borderRadius: "var(--r-md)", background: "var(--bg-inset)", border: "1px solid var(--border)",
            color: "var(--text-3)", fontSize: 12.5,
          } },
            h(Icons.search, { size: 14 }), h("span", { style: { flex: 1, textAlign: "left" } }, "Search…"),
            h("kbd", { style: { fontSize: 10.5, fontFamily: "var(--font-mono)", background: "var(--bg-active)", padding: "1px 5px", borderRadius: 4 } }, "⌘K"))),

        // Scans section with recent items
        !collapsed && h("div", { className: "sb-section-label", style: { marginTop: 8 } }, "Scans"),
        collapsed && h("button", { className: "sb-item" + (page === "scans" ? " active" : ""), onClick: () => nav("scans"), "data-tip": "Scans" }, h(Icons.list, { size: 17 })),
        !collapsed && hasScans && h("div", { style: { marginBottom: 4 } },
          scans.slice(0, 5).map((s) =>
            h("button", { key: s.id, className: "sb-item",
              onClick: () => nav("report", s.id),
              style: { paddingLeft: 10 } },
              h(SevDot, { sev: s.sev }),
              h("span", { className: "sbi-label", style: { fontSize: 12.5 } }, (s.repo.includes("/") ? s.repo.split("/")[1] : s.repo)),
              h("span", { style: { fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" } }, s.issues),
            ))),
        !collapsed && !hasScans && h("div", { style: { padding: "4px 10px 8px", fontSize: 12, color: "var(--text-3)" } }, "No scans yet"),
      ),

      // Footer profile
      h("div", { className: "sb-foot" },
        h("button", { className: "sb-item", style: { padding: collapsed ? "6px 4px" : "7px 8px" }, onClick: () => setProfileOpen((v) => !v) },
          h(Avatar, { initials: userInitials(user), color: "var(--accent)", size: 26 }),
          !collapsed && h("div", { style: { flex: 1, minWidth: 0, textAlign: "left" } },
            h("div", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, displayName(user)),
            h("div", { style: { fontSize: 11, color: "var(--text-3)" } }, (user && user.organization) || "Pro plan"),
          ),
          !collapsed && h(Icons.chevR, { size: 14, style: { color: "var(--text-3)" } }),
        ),
        profileOpen && h(ProfilePopover, { onClose: () => setProfileOpen(false), openSettings, collapsed, user, onLogout }),
      ),
    );
  }
  window.Sidebar = Sidebar;

  function ProfilePopover({ onClose, openSettings, collapsed, user, onLogout }) {
    const ref = useRef();
    const [pos, setPos] = useState(null);
    useEffect(() => {
      const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);
    // When collapsed, measure the foot element to position with fixed coords
    useEffect(() => {
      if (collapsed && ref.current) {
        const parent = ref.current.parentElement;
        if (parent) {
          const rect = parent.getBoundingClientRect();
          setPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
        }
      }
    }, [collapsed]);
    const items = [
      { label: "Settings", icon: "settings", sec: "general" },
      { label: "Usage & Limits", icon: "chart", sec: "usage" },
      { label: "Help & Docs", icon: "help", sec: "help" },
      { label: "What's New", icon: "sparkle", sec: "help" },
    ];
    const popStyle = collapsed && pos
      ? { position: "fixed", bottom: pos.bottom, left: pos.left, width: 220, zIndex: 9999 }
      : { bottom: "calc(100% + 6px)", left: 8, right: 8, width: "auto" };
    return h("div", { ref, className: "popover", style: popStyle },
      h("div", { style: { padding: "8px 10px 6px" } },
        h("div", { style: { fontSize: 12.5, fontWeight: 600 } }, displayName(user)),
        h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, (user && user.email) || "alex@acme.dev"),
      ),
      h("div", { className: "menu-sep" }),
      items.map((it) =>
        h("button", { key: it.label, className: "menu-item", onClick: () => { onClose(); openSettings(it.sec); } },
          h(Icons[it.icon], { size: 15, style: { color: "var(--text-2)" } }), it.label)),
      h("div", { className: "menu-sep" }),
      h("button", { className: "menu-item", onClick: () => { onClose(); if (onLogout) onLogout(); }, style: { color: "var(--sev-critical)" } },
        h(Icons.logout, { size: 15 }), "Log out"),
    );
  }

  // ---- Command Palette ----
  function CommandPalette({ onClose, nav, onNewScan, openSettings }) {
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const [scanCmds, setScanCmds] = useState([]);
    const inputRef = useRef();
    useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
    // Real scans become "jump to report" commands.
    useEffect(() => {
      if (!window.AkiraAPI) return;
      window.AkiraAPI.scans.list({ limit: 20 })
        .then((res) => setScanCmds(((res && res.items) || []).map((s) => ({
          type: "Scan", label: s.repo || s.source_url || "scan",
          hint: s.status === "completed" ? "score " + (s.security_score != null ? s.security_score : "—") : (s.status || ""),
          icon: "list", action: () => nav("report", s.id),
        }))))
        .catch(() => {});
    }, []);

    const commands = [...scanCmds];
    [["Dashboard", "home", "dashboard"], ["Watchlist", "bookmark", "watchlist"], ["Reports", "report", "reports"],
     ["Custom Vulnerabilities", "bug", "custom"], ["Optimization Plans", "sliders", "plans"], ["Integrations", "github", "integrations"],
     ["Learning Hub", "book", "learning"]].forEach(([label, icon, page]) =>
      commands.push({ type: "Navigate", label, icon, action: () => nav(page) }));
    commands.push({ type: "Action", label: "Start a New Scan", icon: "plus", action: onNewScan });
    commands.push({ type: "Action", label: "Open Settings", icon: "settings", action: () => openSettings("general") });

    const filtered = q.trim() === "" ? commands.slice(0, 8) :
      commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()) || (c.hint || "").toLowerCase().includes(q.toLowerCase())).slice(0, 30);

    useEffect(() => { setSel(0); }, [q]);

    function onKey(e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const c = filtered[sel]; if (c) { c.action(); onClose(); } }
      else if (e.key === "Escape") onClose();
    }

    return h("div", { className: "overlay-scrim", style: { alignItems: "flex-start", paddingTop: "14vh" }, onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
      h("div", { className: "modal", style: { width: 580, maxHeight: "70vh" }, onKeyDown: onKey },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" } },
          h(Icons.search, { size: 18, style: { color: "var(--text-3)" } }),
          h("input", { ref: inputRef, value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search scans, files, findings, settings…",
            style: { flex: 1, background: "none", border: "none", outline: "none", fontSize: 15 } }),
          h("kbd", { style: { fontSize: 10.5, fontFamily: "var(--font-mono)", background: "var(--bg-active)", padding: "2px 6px", borderRadius: 4, color: "var(--text-3)" } }, "ESC"),
        ),
        h("div", { style: { overflowY: "auto", padding: 8 } },
          q.trim() === "" && h("div", { style: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", padding: "6px 8px 4px" } }, "Recent & quick actions"),
          filtered.length === 0 && h("div", { style: { padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 } }, "No results for “" + q + "”"),
          filtered.map((c, i) =>
            h("button", { key: i, className: "menu-item", onMouseEnter: () => setSel(i),
              onClick: () => { c.action(); onClose(); },
              style: { background: i === sel ? "var(--bg-active)" : "transparent", padding: "9px 10px" } },
              h("span", { style: { display: "flex", color: "var(--text-2)" } }, h(Icons[c.icon] || Icons.dot, { size: 16 })),
              h("span", { style: { flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.label),
              c.hint && h("span", { className: "mono", style: { fontSize: 11, color: "var(--text-3)" } }, c.hint),
              h("span", { style: { fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" } }, c.type),
            )),
        ),
      )
    );
  }
  window.CommandPalette = CommandPalette;
})();
