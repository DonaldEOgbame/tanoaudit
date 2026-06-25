// VaultScan — New Scan modal (3 steps)
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { Modal, SevDot } = window;
  const API = window.AkiraAPI;

  // Accent colors per Akira tier (purely cosmetic; vendor never referenced).
  const TIER_COLORS = {
    akira_fast: "#7aa2f7",
    akira_balanced: "#9ece6a",
    akira_deep: "#c792ea",
  };

  // Count of the user's custom-vulnerability rules, for the "active rules" copy.
  function useCustomCount() {
    const [count, setCount] = useState(null);
    useEffect(() => {
      if (!API) return;
      let alive = true;
      API.customVulns.list()
        .then((res) => { if (alive) setCount(Array.isArray(res) ? res.length : ((res && res.items && res.items.length) || 0)); })
        .catch(() => { if (alive) setCount(null); });
      return () => { alive = false; };
    }, []);
    return count;
  }

  // Load the connected user's GitHub repos. A 400/empty result means "not
  // connected" → the StepSource github tab shows a connect prompt instead.
  function useGithubRepos() {
    const [state, setState] = useState({ loading: true, error: null, repos: [] });
    useEffect(() => {
      let alive = true;
      API.github.repos()
        .then((list) => {
          if (!alive) return;
          const repos = (Array.isArray(list) ? list : []).map((r) => ({
            name: r.full_name,
            lang: r.language || "—",
            pushed: r.pushed_at || "",
            private: !!r.private,
          }));
          setState({ loading: false, error: null, repos });
        })
        .catch((e) => { if (alive) setState({ loading: false, error: (e && e.message) || "Failed to load repositories", repos: [] }); });
      return () => { alive = false; };
    }, []);
    return state;
  }

  // Translate the modal's local UI state into the payload the backend wants.
  // Returns { source_type, repo|source_url, branch, depth, model_mode, models,
  // include_custom, include_optimization, file? } — file is the ZIP File object
  // (only for zip sources), consumed by the upload path in app.jsx.
  //
  // The user picks one scan profile, which fixes both the coverage (depth) and
  // the engine (tier). We send the tier as model_mode "manual" with a
  // single-element models list; the backend still keeps every other tier as a
  // tail fallback for rate-limit rerouting.
  function buildConfig(source, cfg) {
    const p = cfg.profile;
    const base = {
      depth: profileDepth(p),
      model_mode: "manual",
      models: [p.tier],
      include_custom: cfg.incCustom,
      include_optimization: cfg.incOpt,
    };
    if (source.tab === "github") return Object.assign({ source_type: "github", repo: source.repo }, base);
    if (source.tab === "url") return Object.assign({ source_type: "url", source_url: source.url }, base);
    return Object.assign({ source_type: "zip", file: source.file, repo: source.fileName || null }, base);
  }

  // Gate the Continue button on step 1 until a valid source is chosen.
  function canContinue(step, source) {
    if (step !== 1) return true;
    if (source.tab === "github") return !!source.repo;
    if (source.tab === "url") return !!(source.url && source.url.trim());
    return !!source.file; // zip
  }

  function StepDots({ step }) {
    const labels = ["Source", "Configure", "Review"];
    return h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
      labels.map((l, i) => {
        const n = i + 1, active = n === step, done = n < step;
        return h(React.Fragment, { key: l },
          h("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
            h("div", { style: {
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11.5, fontWeight: 650, flexShrink: 0,
              background: active ? "var(--accent)" : done ? "var(--accent-soft)" : "var(--bg-active)",
              color: active ? "var(--accent-text)" : done ? "var(--accent)" : "var(--text-3)",
              transition: "all var(--dur-med) var(--ease-spring)",
            } }, done ? h(Icons.check, { size: 13, sw: 2.5 }) : n),
            h("span", { style: { fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? "var(--text-1)" : "var(--text-3)" } }, l),
          ),
          i < 2 && h("div", { style: { width: 24, height: 1.5, background: "var(--border)" } }),
        );
      })
    );
  }

  // A scan profile bundles BOTH coverage (depth → segment cap) and engine (tier)
  // into one choice, so the user makes a single decision instead of two
  // overlapping ones. `depth` and `tier` map straight onto the backend contract
  // (Scan.depth + model_mode/models); `seg` mirrors the backend cap per depth.
  const PROFILES = [
    { id: "fast", label: "Fast", tier: "akira_fast", time: "~5 min", seg: 120,
      desc: "Surface pass — up to ~120 segments. Critical security issues and obvious code stubs." },
    { id: "balanced", label: "Balanced", tier: "akira_balanced", depth: "deep", time: "~15 min", seg: 400,
      desc: "Recommended. ~400 segments — full security, optimization, and stub/placeholder coverage." },
    { id: "thorough", label: "Thorough", tier: "akira_deep", time: "~30 min", seg: 800,
      desc: "Widest coverage — up to ~800 segments for large repositories." },
  ];
  // The backend `depth` value for a profile (defaults to the profile id, which
  // already matches the fast/thorough depth keys; balanced overrides to "deep").
  const profileDepth = (p) => p.depth || p.id;
  const PROFILE_TIER_COLORS = { akira_fast: TIER_COLORS.akira_fast, akira_balanced: TIER_COLORS.akira_balanced, akira_deep: TIER_COLORS.akira_deep };

  function NewScanModal({ onClose, onStart }) {
    const [step, setStep] = useState(1);
    const [dir, setDir] = useState("fwd");
    const [source, setSource] = useState({ tab: "github", repo: "", url: "", file: null });
    // The single scan profile (id). Defaults to Balanced (the recommended one).
    const [profile, setProfile] = useState("balanced");
    const [incCustom, setIncCustom] = useState(true);
    const [incOpt, setIncOpt] = useState(true);

    const customCount = useCustomCount();
    const activeProfile = PROFILES.find((p) => p.id === profile) || PROFILES[1];

    const go = (n) => { setDir(n > step ? "fwd" : "back"); setStep(n); };

    return h(Modal, { onClose, width: 600 },
      h("div", { style: { padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h(StepDots, { step }),
        h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 17 })),
      ),
      h("div", { style: { padding: 22, overflowY: "auto", flex: 1 } },
        step === 1 && h(StepSource, { dir, source, setSource }),
        step === 2 && h(StepConfig, { dir, profile, setProfile, incCustom, setIncCustom, incOpt, setIncOpt, customCount }),
        step === 3 && h(StepReview, { dir, source, profile: activeProfile, incCustom, incOpt, customCount }),
      ),
      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        step > 1 ? h("button", { className: "btn btn-ghost", onClick: () => go(step - 1) }, h(Icons.chevL, { size: 15 }), "Back") : h("span", null),
        step < 3
          ? h("button", { className: "btn btn-primary", onClick: () => go(step + 1), disabled: !canContinue(step, source) }, "Continue", h(Icons.chevR, { size: 15 }))
          : h("button", { className: "btn btn-primary btn-lg", onClick: () => onStart(buildConfig(source, { profile: activeProfile, incCustom, incOpt })), style: { position: "relative", overflow: "hidden" } },
              h(Icons.play, { size: 16 }), "Start Scan"),
      ),
    );
  }
  window.NewScanModal = NewScanModal;

  function StepSource({ dir, source, setSource }) {
    const [dragOver, setDragOver] = useState(false);
    const [q, setQ] = useState("");
    const fileInput = React.useRef(null);
    const pickFile = (f) => { if (f) setSource(Object.assign({}, source, { file: f, fileName: f.name })); };
    const tabs = [["github", "GitHub repo", "github"], ["url", "Git URL", "link"], ["zip", "Upload ZIP", "upload"]];
    // Real GitHub repos (GET /github/repos). Errors/empty → "not connected" state.
    const gh = useGithubRepos();
    const notConnected = !gh.loading && (gh.error || gh.repos.length === 0);
    const repos = gh.repos.filter((r) => (r.name || "").toLowerCase().includes(q.toLowerCase()));
    return h("div", { className: "step-panel" + (dir === "back" ? " back" : "") },
      h("h3", { style: { fontSize: 16, fontWeight: 650, marginBottom: 4 } }, "Choose a source"),
      h("p", { style: { fontSize: 13, color: "var(--text-2)", marginBottom: 16 } }, "Where is the code you want to scan?"),
      h("div", { style: { display: "flex", gap: 6, marginBottom: 16, background: "var(--bg-inset)", padding: 4, borderRadius: "var(--r-md)" } },
        tabs.map(([id, label, icon]) =>
          h("button", { key: id, onClick: () => setSource(Object.assign({}, source, { tab: id })),
            style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px", borderRadius: 7, fontSize: 12.5, fontWeight: 550,
              background: source.tab === id ? "var(--bg-surface)" : "transparent", color: source.tab === id ? "var(--text-1)" : "var(--text-2)",
              boxShadow: source.tab === id ? "var(--shadow-card)" : "none", transition: "all var(--dur-micro) ease" } },
            h(Icons[icon], { size: 15 }), label)),
      ),
      source.tab === "github" && (
        gh.loading
          ? h("div", { style: { padding: "32px 14px", textAlign: "center", color: "var(--text-3)", fontSize: 13 } }, "Loading repositories…")
          : notConnected
            ? h("div", { style: { padding: "26px 18px", textAlign: "center", border: "1.5px dashed var(--border)", borderRadius: "var(--r-md)", background: "var(--bg-inset)" } },
                h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 10 } }, h(Icons.github, { size: 26, style: { color: "var(--text-3)" } })),
                h("div", { style: { fontSize: 13.5, fontWeight: 600, marginBottom: 4 } }, "Connect GitHub in Integrations"),
                h("p", { style: { fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.45 } },
                  gh.error || "No repositories found. Connect your GitHub account in Integrations to scan a repo, or use the Git URL / Upload ZIP tabs."))
            : h("div", null,
                h("div", { style: { position: "relative", marginBottom: 10 } },
                  h(Icons.search, { size: 15, style: { position: "absolute", left: 11, top: 10, color: "var(--text-3)" } }),
                  h("input", { className: "field", style: { paddingLeft: 33 }, placeholder: "Search repositories…", value: q, onChange: (e) => setQ(e.target.value) })),
                repos.length === 0
                  ? h("div", { style: { padding: "20px 14px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5 } }, "No repositories match “", q, "”.")
                  : h("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 230, overflowY: "auto" } },
                      repos.map((r) =>
                        h("button", { key: r.name, onClick: () => setSource(Object.assign({}, source, { repo: r.name })),
                          className: "sel-card", style: { padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, borderWidth: 1.5,
                            borderColor: source.repo === r.name ? "var(--accent)" : "var(--border)", background: source.repo === r.name ? "var(--accent-soft)" : "var(--bg-surface)" } },
                          h(Icons.github, { size: 17, style: { color: "var(--text-2)", flexShrink: 0 } }),
                          h("div", { style: { flex: 1, textAlign: "left" } },
                            h("div", { style: { fontSize: 13, fontWeight: 600 } }, r.name),
                            h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, r.lang, r.pushed ? " · pushed " + r.pushed : "")),
                          r.private && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-3)" } }, "Private"),
                          source.repo === r.name && h(Icons.check, { size: 16, style: { color: "var(--accent)" } }),
                        )),
                    ),
              )
      ),
      source.tab === "url" && h("div", null,
        h("label", { className: "flabel" }, "Public Git repository URL"),
        h("input", { className: "field", placeholder: "https://github.com/org/repo.git", value: source.url, onChange: (e) => setSource(Object.assign({}, source, { url: e.target.value })) }),
        h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 8 } }, "We'll clone the default branch. Private repos require a connected GitHub account."),
      ),
      source.tab === "zip" && h("div", { className: "dropzone" + (dragOver ? " over" : ""),
        onClick: () => fileInput.current && fileInput.current.click(),
        onDragOver: (e) => { e.preventDefault(); setDragOver(true); }, onDragLeave: () => setDragOver(false),
        onDrop: (e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files && e.dataTransfer.files[0]); } },
        h("input", { ref: fileInput, type: "file", accept: ".zip,application/zip", style: { display: "none" },
          onChange: (e) => pickFile(e.target.files && e.target.files[0]) }),
        h(Icons.upload, { size: 30, style: { color: "var(--text-3)", margin: "0 auto 10px" } }),
        source.fileName
          ? h("div", null, h("div", { style: { fontWeight: 600 } }, source.fileName), h("div", { style: { fontSize: 12, color: "var(--accent)", marginTop: 3 } }, "Ready to scan"))
          : h("div", null, h("div", { style: { fontWeight: 600, fontSize: 14 } }, "Drag & drop a .zip here"), h("div", { style: { fontSize: 12.5, color: "var(--text-3)", marginTop: 3 } }, "or click to browse · max 200 MB")),
      ),
    );
  }

  function StepConfig({ dir, profile, setProfile, incCustom, setIncCustom, incOpt, setIncOpt, customCount }) {
    const ruleDesc = customCount == null ? "Rules from your library"
      : customCount === 0 ? "No custom rules yet — add some in your library"
      : customCount + (customCount === 1 ? " active rule" : " active rules") + " from your library";
    return h("div", { className: "step-panel" + (dir === "back" ? " back" : "") },
      h("h3", { style: { fontSize: 16, fontWeight: 650, marginBottom: 4 } }, "Scan configuration"),
      h("p", { style: { fontSize: 12.5, color: "var(--text-3)", marginBottom: 14 } }, "Each profile sets how much of the repo Akira scans. It automatically reroutes around rate limits."),
      h("label", { className: "flabel" }, "Scan profile"),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 } },
        PROFILES.map((p) => {
          const sel = profile === p.id;
          return h("div", { key: p.id, className: "sel-card" + (sel ? " sel" : ""), onClick: () => setProfile(p.id) },
            h("div", { className: "sel-check" }, h(Icons.check, { size: 13, sw: 2.5 })),
            h("div", { style: { display: "flex", alignItems: "center", gap: 7, fontWeight: 650, fontSize: 14 } },
              h("span", { style: { width: 9, height: 9, borderRadius: "50%", background: PROFILE_TIER_COLORS[p.tier] || "var(--text-3)", flexShrink: 0 } }),
              p.label),
            h("div", { style: { fontSize: 12, color: "var(--accent)", fontWeight: 600, margin: "2px 0 6px" } }, p.time),
            h("div", { style: { fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.4 } }, p.desc),
          );
        }),
      ),
      h("label", { className: "flabel" }, "Include in this scan"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h(ToggleRow, { on: incCustom, set: setIncCustom, title: "Custom vulnerabilities", desc: ruleDesc }),
        h(ToggleRow, { on: incOpt, set: setIncOpt, title: "Optimization engine", desc: "Performance, code quality, scalability & deps" }),
      ),
    );
  }

  function ToggleRow({ on, set, title, desc }) {
    const { Switch } = window;
    return h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", border: "1px solid var(--border)" } },
      h("div", { style: { flex: 1 } },
        h("div", { style: { fontSize: 13, fontWeight: 600 } }, title),
        h("div", { style: { fontSize: 12, color: "var(--text-3)" } }, desc)),
      h(Switch, { on, onChange: set }),
    );
  }

  function StepReview({ dir, source, profile, incCustom, incOpt, customCount }) {
    const customLabel = !incCustom ? "Off" : (customCount == null ? "On" : (customCount + " active"));
    const srcLabel = source.tab === "github" ? source.repo : source.tab === "url" ? (source.url || "—") : (source.fileName || "uploaded.zip");
    const TIER_NAMES = { akira_fast: "Akira Fast", akira_balanced: "Akira Balanced", akira_deep: "Akira Deep" };
    const rows = [
      ["Source", srcLabel, "github"],
      ["Profile", profile.label + " · " + profile.time, "clock"],
      ["Coverage", "up to ~" + profile.seg + " segments", "layers"],
      ["Engines", "Security & Stubs" + (incOpt ? " + Optimization" : ""), "shield"],
      ["Custom rules", customLabel, "bug"],
    ];
    return h("div", { className: "step-panel" + (dir === "back" ? " back" : "") },
      h("h3", { style: { fontSize: 16, fontWeight: 650, marginBottom: 4 } }, "Review & start"),
      h("p", { style: { fontSize: 13, color: "var(--text-2)", marginBottom: 16 } }, "Confirm the configuration before launching."),
      h("div", { className: "card", style: { padding: 4, marginBottom: 16 } },
        rows.map(([label, val, icon], i) =>
          h("div", { key: label, style: { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i ? "1px solid var(--border)" : "none" } },
            h("span", { style: { display: "flex", color: "var(--text-3)" } }, h(Icons[icon], { size: 16 })),
            h("span", { style: { fontSize: 13, color: "var(--text-2)", flex: 1 } }, label),
            h("span", { style: { fontSize: 13, fontWeight: 600 } }, val))),
      ),
      h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 8 } }, "Engine"),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-1)", padding: "5px 11px", fontSize: 12 } },
          h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: PROFILE_TIER_COLORS[profile.tier] || "var(--text-3)" } }),
          TIER_NAMES[profile.tier] || profile.label)),
    );
  }
})();
