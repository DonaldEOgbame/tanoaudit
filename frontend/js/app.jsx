// VaultScan — Root app: theme/router state, tweaks, layout
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const {
    Sidebar, CommandPalette, Dashboard, NewScanModal, LiveScan, ScanReport,
    CustomVulnsPage, PlansPage, WatchlistPage, ReportsPage, LearningPage,
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
    const [scanModal, setScanModal] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanRepo, setScanRepo] = useState("user/ecommerce-api");
    const [justScanned, setJustScanned] = useState(false);
    const [cmdOpen, setCmdOpen] = useState(false);
    const [settings, setSettings] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [demoOverride, setDemoOverride] = useState(null);
    const toast = window.useToast();

    const demoState = demoOverride || t.demoState;

    useEffect(() => { applyTheme(t); }, [t.theme, t.mode, t.accent, t.density]);

    // Cmd+K
    useEffect(() => {
      function onKey(e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((v) => !v); }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    function nav(p) { setPage(p); setPageKey((k) => k + 1); if (p !== "report") setJustScanned(false); }
    function startScan() {
      setScanModal(false); setScanning(true);
      setDemoOverride("returning");
    }
    function onScanComplete() {
      setScanning(false); setJustScanned(true); setPage("report"); setPageKey((k) => k + 1);
      toast({ kind: "success", title: "Scan complete", msg: scanRepo + " — 43 findings · risk score 38" });
    }

    // Full-screen live scan takes over
    if (scanning) {
      return h(LiveScan, { repo: scanRepo, speed: t.scanSpeed, onComplete: onScanComplete, onCancel: () => { setScanning(false); toast({ kind: "info", msg: "Scan cancelled" }); } });
    }

    let body;
    switch (page) {
      case "dashboard": body = h(Dashboard, { demoState, nav, user, onNewScan: () => setScanModal(true), onSample: () => { setDemoOverride("returning"); nav("report"); } }); break;
      case "scans":
      case "report": body = h(ScanReport, { nav, toast, justScanned }); break;
      case "watchlist": body = h(WatchlistPage, { toast, nav }); break;
      case "reports": body = h(ReportsPage, { toast, nav }); break;
      case "custom": body = h(CustomVulnsPage, { toast }); break;
      case "plans": body = h(PlansPage, { toast }); break;
      case "integrations": body = h(IntegrationsPage, { toast }); break;
      case "learning": body = h(LearningPage, null); break;
      default: body = h(Dashboard, { demoState, nav, user, onNewScan: () => setScanModal(true), onSample: () => nav("report") });
    }

    const titles = { dashboard: "Dashboard", scans: "Scans", report: "Scan Report", watchlist: "Watchlist", reports: "Reports", custom: "Custom Vulnerabilities", plans: "Optimization Plans", integrations: "Integrations", learning: "Learning Hub" };

    return h("div", { className: "vs-app" },
      h(Sidebar, { page, nav, collapsed, setCollapsed, onNewScan: () => setScanModal(true), onCmd: () => setCmdOpen(true), openSettings: (s) => setSettings(s || "general"), demoState, user, onLogout }),
      h("div", { className: "vs-main" },
        // top bar
        h("div", { className: "vs-topbar" },
          h("span", { style: { fontSize: 13.5, fontWeight: 600 } }, titles[page] || "Akira AI"),
          page === "report" && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-2)" } }, "user/ecommerce-api"),
          h("div", { style: { flex: 1 } }),
          h("button", { className: "icon-btn", "data-tip": "Search (⌘K)", onClick: () => setCmdOpen(true) }, h(Icons.search, { size: 16 })),
          h("button", { className: "icon-btn", "data-tip": t.mode === "dark" ? "Light mode" : "Dark mode", onClick: () => setTweak("mode", t.mode === "dark" ? "light" : "dark") },
            h(t.mode === "dark" ? Icons.sun : Icons.moon, { size: 16 })),
          h("button", { className: "icon-btn", "data-tip": "Notifications" }, h(Icons.bell, { size: 16 })),
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
    const API = window.AkiraAPI;
    // "loading" until we know whether the stored token resolves a user.
    const [status, setStatus] = useState(API && API.auth.isAuthed() ? "loading" : "anon");
    const [user, setUser] = useState(null);

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
      return h(window.AuthScreen, { onAuthed: () => { setStatus("loading"); loadUser(); } });
    }
    return h(AppInner, { user, onLogout });
  }

  function App() {
    return h(window.ToastProvider, null, h(Gate, null));
  }
  window.VaultApp = App;
})();
