// VaultScan — Root app: theme/router state, tweaks, layout
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const {
    Sidebar, CommandPalette, Dashboard, NewScanModal, LiveScan, ScanReport,
    CustomVulnsPage, PlansPage, WatchlistPage, LearningPage,
    IntegrationsPage, SettingsModal, ToastProvider, useToast,
  } = window;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "carbon",
    "mode": "dark",
    "accent": "#10b981",
    "scanSpeed": 2,
    "density": "comfy",
    "demoState": "returning"
  }/*EDITMODE-END*/;

  const ACCENTS = {
    "#10b981": { hover: "#34d399", text: "#052e22", soft: "rgba(16,185,129,0.13)" },
    "#6366f1": { hover: "#818cf8", text: "#0b0a2e", soft: "rgba(99,102,241,0.14)" },
    "#06b6d4": { hover: "#22d3ee", text: "#04212a", soft: "rgba(6,182,212,0.14)" },
    "#f59e0b": { hover: "#fbbf24", text: "#2a1a02", soft: "rgba(245,158,11,0.14)" },
  };

  function applyTheme(t) {
    const html = document.documentElement;
    html.setAttribute("data-theme", t.mode === "light" ? "warm" : t.theme);
    html.setAttribute("data-mode", t.mode);
    const a = ACCENTS[t.accent];
    if (a) {
      html.style.setProperty("--accent", t.accent);
      html.style.setProperty("--accent-hover", a.hover);
      html.style.setProperty("--accent-text", a.text);
      html.style.setProperty("--accent-soft", a.soft);
    }
    html.style.setProperty("--density-pad", t.density === "compact" ? "0.85" : t.density === "comfy" ? "1.08" : "1");
  }

  function AppInner({ user, onLogout }) {
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const [page, setPage] = useState("dashboard");
    const [pageKey, setPageKey] = useState(0);
    const [learnSlug, setLearnSlug] = useState(null);  // deep-link target for the Learning Hub
    const [scanModal, setScanModal] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanRepo, setScanRepo] = useState("user/ecommerce-api");
    const [scanId, setScanId] = useState(null);
    const [activeScanId, setActiveScanId] = useState(null);
    const [justScanned, setJustScanned] = useState(false);
    const [cmdOpen, setCmdOpen] = useState(false);
    const [settings, setSettings] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [demoOverride, setDemoOverride] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);
    const toast = window.useToast();

    const demoState = demoOverride || t.demoState;

    useEffect(() => {
      if (!user || !window.TanoAuditAPI) return;
      let alive = true;
      window.TanoAuditAPI.notifications.unreadCount()
        .then((res) => {
          if (!alive) return;
          const count = res && typeof res.count === "number" ? res.count : (typeof res === "number" ? res : 0);
          setUnreadCount(count);
        })
        .catch(() => {});
      return () => { alive = false; };
    }, [user]);

    // Land back on Integrations after the GitHub OAuth round-trip. The backend
    // redirects to <frontend>/?github=connected (or ?github=error&message=…);
    // we route there, toast the result, and strip the params from the URL.
    useEffect(() => {
      if (!user) return;
      let params;
      try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
      const gh = params.get("github");
      if (!gh) return;
      if (gh === "connected") {
        const acct = params.get("account");
        toast({ kind: "success", title: "GitHub connected", msg: acct ? ("Connected as " + acct) : "Your GitHub account is linked." });
        nav("integrations");
      } else if (gh === "error") {
        toast({ kind: "error", title: "GitHub connection failed", msg: params.get("message") || "Authorization was not completed." });
        nav("integrations");
      }
      // Clean the query string so a refresh doesn't re-trigger.
      try {
        const url = new URL(window.location.href);
        ["github", "account", "message"].forEach((k) => url.searchParams.delete(k));
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      } catch (e) {}
    }, [user]);

    useEffect(() => { applyTheme(t); }, [t.theme, t.mode, t.accent, t.density]);

    // Cmd+K
    useEffect(() => {
      function onKey(e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((v) => !v); }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    // nav(page) or nav("report", scanId) — the optional second arg targets a
    // specific scan's report (used by dashboard/watchlist/scan-list rows).
    function nav(p, targetScanId) {
      if (p === "report" && targetScanId) { setScanId(targetScanId); setJustScanned(false); }
      else if (p !== "report") { setJustScanned(false); }
      // nav("learning", slug) deep-links to a specific class.
      if (p === "learning") setLearnSlug(targetScanId || null);
      setPage(p); setPageKey((k) => k + 1);
    }

    // Kick off a real scan: POST /scans (or upload for ZIP), then take over with
    // the live screen bound to the returned scan id.
    async function startScan(config) {
      const API = window.TanoAuditAPI;
      const label = config.repo || config.source_url || config.fileName || "your project";
      try {
        let scan;
        if (config.source_type === "zip") {
          const { file } = config;
          if (!file) { toast({ kind: "error", msg: "Choose a .zip file to scan" }); return; }
          const { file: _omit, fileName: _omit2, ...cfg } = config;
          scan = await API.scans.upload(file, cfg);
        } else {
          scan = await API.scans.create(config);
        }
        setScanModal(false);
        setScanRepo(scan.repo || label);
        setActiveScanId(scan.id);
        setScanning(true);
      } catch (e) {
        if (e && e.code === "daily_limit_reached") {
          toast({ kind: "error", title: "Daily limit reached", msg: (e && e.message) || "You've used all your scans for today." });
        } else {
          toast({ kind: "error", title: "Couldn't start scan", msg: (e && e.message) || "Please try again." });
        }
      }
    }

    function onScanComplete(summary) {
      setScanning(false); setJustScanned(true);
      setScanId(activeScanId); setActiveScanId(null);
      setPage("report"); setPageKey((k) => k + 1);
      const parts = [];
      if (summary && summary.security_score != null) parts.push("security risk " + window.riskFromScore(summary.security_score));
      toast({ kind: "success", title: "Scan complete", msg: scanRepo + (parts.length ? " — " + parts.join(" · ") : "") });
    }

    function onScanError(message) {
      setScanning(false); setActiveScanId(null);
      toast({ kind: "error", title: "Scan failed", msg: message || "The scan did not complete." });
    }

    // Full-screen live scan takes over
    if (scanning) {
      return h(LiveScan, {
        repo: scanRepo, scanId: activeScanId, speed: t.scanSpeed,
        onComplete: onScanComplete, onError: onScanError,
        onCancel: () => {
          if (activeScanId) { try { window.TanoAuditAPI.scans.control(activeScanId, "cancel"); } catch (e) {} }
          setScanning(false); setActiveScanId(null);
          toast({ kind: "info", msg: "Scan cancelled" });
        },
      });
    }

    let body;
    switch (page) {
      case "dashboard": body = h(Dashboard, { demoState, nav, user, openSettings: (s) => setSettings(s || "general"), onNewScan: () => setScanModal(true), onSample: () => { setDemoOverride("returning"); nav("report"); } }); break;
      case "scans":
      case "report": body = h(ScanReport, { nav, toast, justScanned, scanId, repo: scanId ? scanRepo : null, onLoadRepo: setScanRepo }); break;
      case "watchlist": body = h(WatchlistPage, { toast, nav }); break;
      case "custom": body = h(CustomVulnsPage, { toast }); break;
      case "plans": body = h(PlansPage, { toast }); break;
      case "integrations": body = h(IntegrationsPage, { toast }); break;
      case "learning": body = h(LearningPage, { initialSlug: learnSlug }); break;
      default: body = h(Dashboard, { demoState, nav, user, onNewScan: () => setScanModal(true), onSample: () => nav("report") });
    }

    const titles = { dashboard: "Dashboard", scans: "Scans", report: "Scan Report", watchlist: "Watchlist", custom: "Custom Vulnerabilities", plans: "Optimization Plans", integrations: "Integrations", learning: "Learning Hub" };

    return h("div", { className: "vs-app" },
      h(Sidebar, { page, nav, collapsed, setCollapsed, onNewScan: () => setScanModal(true), onCmd: () => setCmdOpen(true), openSettings: (s) => setSettings(s || "general"), demoState, user, onLogout }),
      h("div", { className: "vs-main" },
        // top bar
        h("div", { className: "vs-topbar" },
          h("span", { style: { fontSize: 13.5, fontWeight: 600 } }, titles[page] || "TanoAudit"),
          page === "report" && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-2)" } }, scanId ? scanRepo : "user/ecommerce-api"),
          h("div", { style: { flex: 1 } }),
          h("button", { className: "icon-btn", "data-tip": "Search (⌘K)", onClick: () => setCmdOpen(true) }, h(Icons.search, { size: 16 })),
          h("button", { className: "icon-btn", "data-tip": t.mode === "dark" ? "Light mode" : "Dark mode", onClick: () => setTweak("mode", t.mode === "dark" ? "light" : "dark") },
            h(t.mode === "dark" ? Icons.sun : Icons.moon, { size: 16 })),
          h("div", { style: { position: "relative" } },
            h("button", {
              id: "vs-bell-btn",
              className: "icon-btn",
              "data-tip": "Notifications",
              onClick: () => setNotifOpen(!notifOpen)
            },
              h(Icons.bell, { size: 16 }),
              unreadCount > 0 && h("span", {
                style: {
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--accent)"
                }
              })
            ),
            notifOpen && h(window.NotificationsPopover, {
              onClose: () => setNotifOpen(false),
              nav,
              toast,
              setUnreadCount
            })
          ),
          h("button", { className: "btn btn-secondary btn-sm", onClick: () => setSettings("general") }, h(Icons.settings, { size: 14 }), "Settings"),
        ),
        h("div", { key: pageKey, className: "vs-page" }, body),
      ),

      scanModal && h(NewScanModal, { onClose: () => setScanModal(false), onStart: startScan }),
      cmdOpen && h(CommandPalette, { onClose: () => setCmdOpen(false), nav, onNewScan: () => { setCmdOpen(false); setScanModal(true); }, openSettings: (s) => { setCmdOpen(false); setSettings(s); } }),
      settings && h(SettingsModal, { onClose: () => setSettings(null), initial: settings, mode: t.mode, setMode: (m) => setTweak("mode", m), toast }),

      // Tweaks panel
      h(window.TweaksPanel, null,
        h(window.TweakSection, { label: "Theme" }),
        h(window.TweakRadio, { label: "Style", value: t.theme, options: ["carbon", "mono", "warm"], onChange: (v) => setTweak("theme", v) }),
        h(window.TweakRadio, { label: "Mode", value: t.mode, options: ["dark", "light"], onChange: (v) => setTweak("mode", v) }),
        h(window.TweakColor, { label: "Accent", value: t.accent, options: Object.keys(ACCENTS), onChange: (v) => setTweak("accent", v) }),
        h(window.TweakSection, { label: "Layout" }),
        h(window.TweakRadio, { label: "Density", value: t.density, options: ["compact", "regular", "comfy"], onChange: (v) => setTweak("density", v) }),
        h(window.TweakSection, { label: "Demo" }),
        h(window.TweakRadio, { label: "Home state", value: demoState, options: ["returning", "first-run"], onChange: (v) => { setDemoOverride(v); setTweak("demoState", v); if (page !== "dashboard") nav("dashboard"); } }),
        h(window.TweakSlider, { label: "Scan speed", value: t.scanSpeed, min: 1, max: 5, step: 0.5, unit: "×", onChange: (v) => setTweak("scanSpeed", v) }),
        h(window.TweakButton, { label: "Run a demo scan", onClick: () => { setScanRepo("user/ecommerce-api"); setScanning(true); } }),
      ),
    );
  }

  function Gate() {
    const API = window.TanoAuditAPI;
    // Pick up any tokens / error the GitHub sign-in redirect left in the URL
    // before we decide the initial status. Runs once at module eval per mount.
    const redirect = useRef(API ? API.auth.consumeAuthRedirect() : null).current;
    // "loading" until we know whether the stored token resolves a user.
    const [status, setStatus] = useState(API && API.auth.isAuthed() ? "loading" : "anon");
    const [user, setUser] = useState(null);
    // For anon visitors, show the marketing landing page first; "auth" reveals
    // the login/register screen. `authMode` seeds it to login or register.
    // A GitHub sign-in error lands straight on the auth screen with a message.
    const [view, setView] = useState(redirect && redirect.error ? "auth" : "landing");
    const [authMode, setAuthMode] = useState("login");
    const [authError, setAuthError] = useState(redirect && redirect.error ? redirect.error : null);

    async function loadUser() {
      try {
        const me = await API.auth.me();
        setUser(me);
        setStatus("authed");
      } catch (e) {
        // Token missing/expired/invalid — fall back to the auth screen.
        if (API) API.tokens.clear();
        setStatus("anon");
      }
    }

    useEffect(() => {
      if (status === "loading") loadUser();
    }, []);

    async function onLogout() {
      try { await API.auth.logout(); } catch (e) { /* ignore */ }
      setUser(null);
      setStatus("anon");
    }

    if (status === "loading") {
      return h("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)", color: "var(--text-3)", fontSize: 13 } }, "Loading…");
    }
    if (status !== "authed") {
      if (view === "landing") {
        return h(window.LandingPage, {
          onGetStarted: () => { setAuthMode("register"); setView("auth"); },
          onLogin: () => { setAuthMode("login"); setView("auth"); },
        });
      }
      return h(window.AuthScreen, {
        initialMode: authMode,
        initialError: authError,
        onBack: () => { setAuthError(null); setView("landing"); },
        onAuthed: () => { setStatus("loading"); loadUser(); },
      });
    }
    return h(AppInner, { user, onLogout });
  }

  function App() {
    return h(window.ToastProvider, null, h(Gate, null));
  }
  window.VaultApp = App;
})();
