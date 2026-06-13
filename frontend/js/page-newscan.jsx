// VaultScan — New Scan modal (3 steps)
(function () {
  const React = window.React;
  const { useState } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { Modal, SevDot } = window;

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

  function NewScanModal({ onClose, onStart }) {
    const [step, setStep] = useState(1);
    const [dir, setDir] = useState("fwd");
    const [source, setSource] = useState({ tab: "github", repo: "user/ecommerce-api", url: "", file: null });
    const [depth, setDepth] = useState("deep");
    const [modelMode, setModelMode] = useState("auto");
    const [models, setModels] = useState(["gemini", "groq", "openrouter"]);
    const [incCustom, setIncCustom] = useState(true);
    const [incOpt, setIncOpt] = useState(true);

    const go = (n) => { setDir(n > step ? "fwd" : "back"); setStep(n); };

    const depthMap = { fast: { label: "Fast", time: "~5 min", seg: 120, desc: "Surface-level pass. Checks critical security vulnerabilities and code stubs." },
      deep: { label: "Deep", time: "~15 min", seg: 318, desc: "Recommended. Full security, optimization, and code stub/placeholder coverage." },
      thorough: { label: "Thorough", time: "~30 min", seg: 540, desc: "Exhaustive pass. Full coverage with cross-model validation for critical findings." } };

    return h(Modal, { onClose, width: 600 },
      h("div", { style: { padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h(StepDots, { step }),
        h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 17 })),
      ),
      h("div", { style: { padding: 22, overflowY: "auto", flex: 1 } },
        step === 1 && h(StepSource, { dir, source, setSource }),
        step === 2 && h(StepConfig, { dir, depth, setDepth, depthMap, modelMode, setModelMode, models, setModels, incCustom, setIncCustom, incOpt, setIncOpt }),
        step === 3 && h(StepReview, { dir, source, depth: depthMap[depth], models, modelMode, incCustom, incOpt }),
      ),
      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        step > 1 ? h("button", { className: "btn btn-ghost", onClick: () => go(step - 1) }, h(Icons.chevL, { size: 15 }), "Back") : h("span", null),
        step < 3
          ? h("button", { className: "btn btn-primary", onClick: () => go(step + 1) }, "Continue", h(Icons.chevR, { size: 15 }))
          : h("button", { className: "btn btn-primary btn-lg", onClick: onStart, style: { position: "relative", overflow: "hidden" } },
              h(Icons.play, { size: 16 }), "Start Scan"),
      ),
    );
  }
  window.NewScanModal = NewScanModal;

  function StepSource({ dir, source, setSource }) {
    const [dragOver, setDragOver] = useState(false);
    const [q, setQ] = useState("");
    const tabs = [["github", "GitHub repo", "github"], ["url", "Git URL", "link"], ["zip", "Upload ZIP", "upload"]];
    const repos = window.VS_GH_REPOS.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
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
      source.tab === "github" && h("div", null,
        h("div", { style: { position: "relative", marginBottom: 10 } },
          h(Icons.search, { size: 15, style: { position: "absolute", left: 11, top: 10, color: "var(--text-3)" } }),
          h("input", { className: "field", style: { paddingLeft: 33 }, placeholder: "Search repositories…", value: q, onChange: (e) => setQ(e.target.value) })),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 230, overflowY: "auto" } },
          repos.map((r) =>
            h("button", { key: r.name, onClick: () => setSource(Object.assign({}, source, { repo: r.name })),
              className: "sel-card", style: { padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, borderWidth: 1.5,
                borderColor: source.repo === r.name ? "var(--accent)" : "var(--border)", background: source.repo === r.name ? "var(--accent-soft)" : "var(--bg-surface)" } },
              h(Icons.github, { size: 17, style: { color: "var(--text-2)", flexShrink: 0 } }),
              h("div", { style: { flex: 1, textAlign: "left" } },
                h("div", { style: { fontSize: 13, fontWeight: 600 } }, r.name),
                h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, r.lang, " · pushed ", r.pushed)),
              r.private && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-3)" } }, "Private"),
              source.repo === r.name && h(Icons.check, { size: 16, style: { color: "var(--accent)" } }),
            )),
        ),
      ),
      source.tab === "url" && h("div", null,
        h("label", { className: "flabel" }, "Public Git repository URL"),
        h("input", { className: "field", placeholder: "https://github.com/org/repo.git", value: source.url, onChange: (e) => setSource(Object.assign({}, source, { url: e.target.value })) }),
        h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 8 } }, "We'll clone the default branch. Private repos require a connected GitHub account."),
      ),
      source.tab === "zip" && h("div", { className: "dropzone" + (dragOver ? " over" : ""),
        onDragOver: (e) => { e.preventDefault(); setDragOver(true); }, onDragLeave: () => setDragOver(false),
        onDrop: (e) => { e.preventDefault(); setDragOver(false); setSource(Object.assign({}, source, { file: "ecommerce-api.zip" })); } },
        h(Icons.upload, { size: 30, style: { color: "var(--text-3)", margin: "0 auto 10px" } }),
        source.file
          ? h("div", null, h("div", { style: { fontWeight: 600 } }, source.file), h("div", { style: { fontSize: 12, color: "var(--accent)", marginTop: 3 } }, "Ready to scan"))
          : h("div", null, h("div", { style: { fontWeight: 600, fontSize: 14 } }, "Drag & drop a .zip here"), h("div", { style: { fontSize: 12.5, color: "var(--text-3)", marginTop: 3 } }, "or click to browse · max 200 MB")),
      ),
    );
  }

  function StepConfig({ dir, depth, setDepth, depthMap, modelMode, setModelMode, models, setModels, incCustom, setIncCustom, incOpt, setIncOpt }) {
    const allModels = window.VS_MODELS;
    const toggleModel = (id) => setModels((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);
    return h("div", { className: "step-panel" + (dir === "back" ? " back" : "") },
      h("h3", { style: { fontSize: 16, fontWeight: 650, marginBottom: 14 } }, "Scan configuration"),
      h("label", { className: "flabel" }, "Scan depth"),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 } },
        Object.entries(depthMap).map(([k, v]) =>
          h("div", { key: k, className: "sel-card" + (depth === k ? " sel" : ""), onClick: () => setDepth(k) },
            h("div", { className: "sel-check" }, h(Icons.check, { size: 13, sw: 2.5 })),
            h("div", { style: { fontWeight: 650, fontSize: 14 } }, v.label),
            h("div", { style: { fontSize: 12, color: "var(--accent)", fontWeight: 600, margin: "2px 0 6px" } }, v.time),
            h("div", { style: { fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.4 } }, v.desc),
          )),
      ),
      h("label", { className: "flabel" }, "Model selection"),
      h("div", { style: { display: "flex", gap: 6, marginBottom: 10, background: "var(--bg-inset)", padding: 4, borderRadius: "var(--r-md)", width: "fit-content" } },
        [["auto", "Auto (recommended)"], ["manual", "Manual"]].map(([id, label]) =>
          h("button", { key: id, onClick: () => setModelMode(id),
            style: { padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 550,
              background: modelMode === id ? "var(--bg-surface)" : "transparent", color: modelMode === id ? "var(--text-1)" : "var(--text-2)",
              boxShadow: modelMode === id ? "var(--shadow-card)" : "none" } }, label)),
      ),
      modelMode === "auto"
        ? h("div", { style: { fontSize: 12.5, color: "var(--text-2)", background: "var(--bg-inset)", padding: "10px 12px", borderRadius: "var(--r-md)", marginBottom: 18, display: "flex", gap: 8 } },
            h(Icons.sparkle, { size: 15, style: { color: "var(--accent)", flexShrink: 0 } }),
            "Akira AI picks the best model per segment and automatically reroutes around rate limits.")
        : h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 } },
            allModels.map((m) =>
              h("button", { key: m.id, onClick: () => toggleModel(m.id),
                className: "sel-card", style: { padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderWidth: 1.5,
                  borderColor: models.includes(m.id) ? "var(--accent)" : "var(--border)", background: models.includes(m.id) ? "var(--accent-soft)" : "var(--bg-surface)" } },
                h("span", { style: { width: 9, height: 9, borderRadius: "50%", background: m.color } }),
                h("span", { style: { flex: 1, textAlign: "left", fontSize: 13, fontWeight: 550 } }, m.name),
                models.includes(m.id) && h(Icons.check, { size: 15, style: { color: "var(--accent)" } }))),
          ),
      h("label", { className: "flabel" }, "Include in this scan"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h(ToggleRow, { on: incCustom, set: setIncCustom, title: "Custom vulnerabilities", desc: "5 active rules from your library" }),
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

  function StepReview({ dir, source, depth, models, modelMode, incCustom, incOpt }) {
    const allModels = window.VS_MODELS;
    const activeModels = modelMode === "auto" ? allModels : allModels.filter((m) => models.includes(m.id));
    const srcLabel = source.tab === "github" ? source.repo : source.tab === "url" ? (source.url || "—") : (source.file || "uploaded.zip");
    const rows = [
      ["Source", srcLabel, "github"],
      ["Scan depth", depth.label + " · " + depth.time, "clock"],
      ["Est. segments", "~" + depth.seg, "layers"],
      ["Engines", "Security & Stubs" + (incOpt ? " + Optimization" : ""), "shield"],
      ["Custom rules", incCustom ? "5 active" : "Off", "bug"],
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
      h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 8 } }, "Active models"),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        activeModels.map((m) =>
          h("span", { key: m.id, className: "badge", style: { background: "var(--bg-active)", color: "var(--text-1)", padding: "5px 11px", fontSize: 12 } },
            h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: m.color } }), m.name))),
    );
  }
})();
