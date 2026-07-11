// VaultScan — Sidebar, Command Palette, Profile popover
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { Avatar, SevDot } = window;

  function Logo({ size, collapsed }) {
    return h("span", {
      style: { color: "var(--text-1)" },
    }, collapsed ? "TA" : "TanoAudit");
  }
  window.Logo = Logo;

  const NAV = [
    { section: "Scans", icon: "list", page: "scans" },
    { section: "Watchlist", icon: "bookmark", page: "watchlist", badge: "↑3" },
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

  // A single recent-scan row in the sidebar, with a hover "⋯" button that
  // opens a Rename / Pin / Delete menu. Inline-renames in place.
  function ScanRow({ scan: s, nav, menuOpen, renaming, onOpenMenu, onCloseMenu,
                     onStartRename, onRename, onCancelRename, onPin, onShare, onDelete }) {
    const rowRef = useRef();
    const menuRef = useRef();
    const inputRef = useRef();
    // A scan that didn't complete (cancelled/failed) has no valid severity or
    // scores — show it muted, not as a peer of real reports.
    const incomplete = s.status === "cancelled" || s.status === "canceled" || s.status === "failed";
    const label = s.displayName || (s.repo.includes("/") ? s.repo.split("/")[1] : s.repo);

    // Close the menu on outside click / Escape.
    useEffect(() => {
      if (!menuOpen) return;
      const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target) && rowRef.current && !rowRef.current.contains(e.target)) onCloseMenu(); };
      const onKey = (e) => { if (e.key === "Escape") onCloseMenu(); };
      setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
      document.addEventListener("keydown", onKey);
      return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    }, [menuOpen]);

    useEffect(() => { if (renaming && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [renaming]);

    if (renaming) {
      return h("div", { className: "sb-item", style: { paddingLeft: 10 } },
        incomplete
          ? h("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--text-3)", flexShrink: 0 } })
          : h(SevDot, { sev: s.sev }),
        h("input", {
          ref: inputRef, defaultValue: label,
          className: "sb-rename-input",
          style: {
            flex: 1, minWidth: 0, fontSize: 12.5, background: "var(--bg-inset)",
            border: "1px solid var(--accent)", borderRadius: 4, color: "var(--text-1)", padding: "2px 6px",
          },
          onClick: (e) => e.stopPropagation(),
          onKeyDown: (e) => {
            if (e.key === "Enter") onRename(e.target.value);
            else if (e.key === "Escape") onCancelRename();
          },
          onBlur: (e) => onRename(e.target.value),
        }),
      );
    }

    return h("div", { ref: rowRef, className: "sb-scan-row" + (menuOpen ? " menu-open" : ""), style: { position: "relative" } },
      h("button", { className: "sb-item",
        onClick: () => nav("report", s.id),
        style: { paddingLeft: 10, opacity: incomplete ? 0.5 : 1, width: "100%" },
        "data-tip": incomplete ? ("Scan " + s.status) : undefined },
        incomplete
          ? h("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--text-3)", flexShrink: 0 } })
          : h(SevDot, { sev: s.sev }),
        s.pinned && h(Icons.pin, { size: 11, style: { color: "var(--accent)", flexShrink: 0 } }),
        h("span", { className: "sbi-label", style: { fontSize: 12.5 } }, label),
        h("span", { style: { fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" } }, s.issues),
      ),
      // Hover-revealed "⋯" trigger (always visible while its menu is open).
      h("button", {
        className: "sb-scan-more icon-btn",
        onClick: (e) => { e.stopPropagation(); onOpenMenu(); },
        "data-tip": menuOpen ? null : "More",
        style: {
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          width: 24, height: 24, borderRadius: 6,
        },
      }, h(Icons.more, { size: 16 })),
      menuOpen && h("div", { ref: menuRef, className: "popover",
        style: { top: "calc(100% - 2px)", right: 4, left: "auto", width: 160, zIndex: 9999 } },
        h("button", { className: "menu-item", onClick: onStartRename },
          h(Icons.edit, { size: 14, style: { color: "var(--text-2)" } }), "Rename"),
        h("button", { className: "menu-item", onClick: onPin },
          h(Icons.pin, { size: 14, style: { color: "var(--text-2)" } }), s.pinned ? "Unpin" : "Pin"),
        h("button", { className: "menu-item", onClick: onShare },
          h(Icons.share, { size: 14, style: { color: "var(--text-2)" } }), "Share"),
        h("div", { className: "menu-sep" }),
        h("button", { className: "menu-item", onClick: onDelete, style: { color: "var(--sev-critical)" } },
          h(Icons.trash, { size: 14 }), "Delete"),
      ),
    );
  }

  function Sidebar({ page, nav, collapsed, setCollapsed, onNewScan, onCmd, openSettings, demoState, user, onLogout }) {
    const toast = window.useToast ? window.useToast() : (() => {});
    const [profileOpen, setProfileOpen] = useState(false);
    // Recent scans from the backend (falls back to demo data if the call fails).
    const [scans, setScans] = useState([]);
    // Which scan row's "⋯" menu is open (by id), and which is being renamed.
    const [menuFor, setMenuFor] = useState(null);
    const [renameFor, setRenameFor] = useState(null);
    // Scan pending delete confirmation (shown via in-app modal, not window.confirm).
    const [confirmDel, setConfirmDel] = useState(null);

    function loadScans() {
      if (!window.TanoAuditAPI) { setScans(window.VS_SCANS || []); return; }
      window.TanoAuditAPI.scans.list({ limit: 8 })
        .then((res) => {
          const items = (res && res.items) || [];
          setScans(items.map((s) => ({
            id: s.id,
            repo: s.repo || s.source_url || "scan",
            displayName: s.display_name || "",
            pinned: !!s.pinned,
            sev: (s.worst_severity && s.worst_severity !== "clean") ? s.worst_severity : "info",
            status: s.status || "",
            issues: s.status === "completed" ? "" : (s.status || ""),
          })));
        })
        .catch(() => setScans([]));
    }
    useEffect(() => { loadScans(); }, []);

    function pinScan(s) {
      setMenuFor(null);
      const next = !s.pinned;
      setScans((arr) => arr.map((x) => x.id === s.id ? { ...x, pinned: next } : x));
      if (window.TanoAuditAPI) window.TanoAuditAPI.scans.setPinned(s.id, next).then(loadScans).catch(loadScans);
    }
    function renameScan(s, name) {
      setRenameFor(null);
      const clean = (name || "").trim();
      setScans((arr) => arr.map((x) => x.id === s.id ? { ...x, displayName: clean } : x));
      if (window.TanoAuditAPI) window.TanoAuditAPI.scans.rename(s.id, clean).catch(loadScans);
    }
    function deleteScan(s) {
      setMenuFor(null);
      setConfirmDel(s);
    }
    function confirmDeleteScan() {
      const s = confirmDel;
      setConfirmDel(null);
      if (!s) return;
      setScans((arr) => arr.filter((x) => x.id !== s.id));
      if (window.TanoAuditAPI) window.TanoAuditAPI.scans.remove(s.id).then(loadScans).catch(loadScans);
    }
    // Create-or-reuse a read-only share link and copy it to the clipboard
    // (same flow as the report page's Share popover).
    function shareScan(s) {
      setMenuFor(null);
      const API = window.TanoAuditAPI;
      if (!API) { toast({ kind: "info", msg: "Sharing isn't available in preview mode." }); return; }
      const toLink = (r) => {
        if (!r) return "";
        const slug = r.slug || r.token || r.id;
        return r.url || (API.BASE.replace("/api/v1", "") + "/api/v1/public/reports/" + slug);
      };
      API.reports.getShare(s.id)
        .then((r) => (r && (r.slug || r.url || r.id)) ? r : API.reports.createShare(s.id))
        .catch(() => API.reports.createShare(s.id))
        .then((r) => {
          const link = toLink(r);
          if (!link) throw new Error("no link");
          if (navigator.clipboard) navigator.clipboard.writeText(link);
          toast({ kind: "success", msg: "Share link copied to clipboard" });
        })
        .catch((e) => toast({ kind: "error", msg: "Couldn't create share link: " + ((e && e.message) || "error") }));
    }

    // Pinned scans float to the top (the API already sorts this way, but keep
    // the order stable after optimistic local pin toggles).
    const sortedScans = [...scans].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    const hasScans = scans.length > 0;

    // Live sidebar counters: watchlist alerts, custom-vuln rules, GitHub status.
    const [meta, setMeta] = useState({ alerts: 0, customCount: null, ghConnected: false });

    function reloadMeta() {
      const API = window.TanoAuditAPI;
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
      window.addEventListener("tanoaudit:custom-vulns-changed", reloadMeta);
      return () => {
        window.removeEventListener("tanoaudit:custom-vulns-changed", reloadMeta);
      };
    }, []);

    // Resolve each NAV row's badge/count/status from live data (falls back to
    // the static prototype values only when no API is present).
    function navMeta(n) {
      if (!window.TanoAuditAPI) return { badge: n.badge, count: n.count, status: n.status };
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
          sortedScans.slice(0, 6).map((s) =>
            h(ScanRow, {
              key: s.id, scan: s, nav,
              menuOpen: menuFor === s.id,
              renaming: renameFor === s.id,
              onOpenMenu: () => setMenuFor((v) => v === s.id ? null : s.id),
              onCloseMenu: () => setMenuFor(null),
              onStartRename: () => { setMenuFor(null); setRenameFor(s.id); },
              onRename: (name) => renameScan(s, name),
              onCancelRename: () => setRenameFor(null),
              onPin: () => pinScan(s),
              onShare: () => shareScan(s),
              onDelete: () => deleteScan(s),
            }))),
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

      // Delete confirmation (in-app modal, replaces the native browser confirm).
      confirmDel && window.Modal && h(window.Modal, { width: 420, onClose: () => setConfirmDel(null) },
        h("div", { style: { padding: "20px 22px" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
            h("div", { style: { width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sev-critical-soft, rgba(239,68,68,0.12))", color: "var(--sev-critical)", flexShrink: 0 } },
              h(Icons.trash, { size: 16 })),
            h("div", { style: { fontSize: 15, fontWeight: 650, color: "var(--text-1)" } }, "Delete scan?"),
          ),
          h("div", { style: { fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 18 } },
            "Delete ", h("strong", null, (confirmDel.displayName || confirmDel.repo || "this scan")),
            " and all of its data? This can't be undone."),
          h("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
            h("button", { className: "btn", onClick: () => setConfirmDel(null) }, "Cancel"),
            h("button", { className: "btn", style: { background: "var(--sev-critical)", color: "#fff", borderColor: "var(--sev-critical)" }, onClick: confirmDeleteScan }, "Delete"),
          ),
        )),
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
      if (!window.TanoAuditAPI) return;
      window.TanoAuditAPI.scans.list({ limit: 20 })
        .then((res) => setScanCmds(((res && res.items) || []).map((s) => ({
          type: "Scan", label: s.repo || s.source_url || "scan",
          hint: s.status === "completed" ? "score " + (s.security_score != null ? s.security_score : "—") : (s.status || ""),
          icon: "list", action: () => nav("report", s.id),
        }))))
        .catch(() => {});
    }, []);

    const commands = [...scanCmds];
    [["Dashboard", "home", "dashboard"], ["Watchlist", "bookmark", "watchlist"],
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
