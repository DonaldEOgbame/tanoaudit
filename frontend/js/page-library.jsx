// VaultScan — Custom Vulnerabilities, Optimization Plans, Watchlist, Reports
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, SevDot, Switch, Ring, Tag, Modal, scoreColor, ProgressBar, Dropdown } = window;

  function PageHead({ title, desc, action }) {
    return h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" } },
      h("div", null,
        h("h1", { style: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } }, title),
        desc && h("p", { style: { color: "var(--text-2)", fontSize: 13, marginTop: 2 } }, desc)),
      action);
  }
  window.PageHead = PageHead;

  // ============ CUSTOM VULNERABILITIES ============
  function CustomVulnsPage({ toast }) {
    const [vulns, setVulns] = useState(window.VS_CUSTOM_VULNS.map((v, i) => Object.assign({ id: i }, v)));
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(null);

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Custom Vulnerabilities" },
      h(PageHead, { title: "Custom Vulnerabilities", desc: "Your own detection rules, researched and added to every scan.",
        action: h("button", { className: "btn btn-primary", onClick: () => setAdding(true) }, h(Icons.plus, { size: 15, sw: 2.2 }), "Add Custom Vulnerability") }),
      h("div", { className: "card", style: { overflow: "visible" } },
        vulns.map((v, i) =>
          h("div", { key: v.id, style: { display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderTop: i ? "1px solid var(--border)" : "none", opacity: v.active ? 1 : 0.55, transition: "opacity var(--dur-med) ease" } },
            h(SevBadge, { sev: v.sev }),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontSize: 13.5, fontWeight: 600 } }, v.name),
              h("div", { style: { fontSize: 12, color: "var(--text-2)", marginTop: 1 } }, v.desc)),
            h(Switch, { on: v.active, onChange: (on) => setVulns((vs) => vs.map((x) => x.id === v.id ? Object.assign({}, x, { active: on }) : x)) }),
            h("button", { className: "icon-btn", "data-tip": "Edit", onClick: () => setEditing(v) }, h(Icons.edit, { size: 14 })),
            h("button", { className: "icon-btn", "data-tip": "Delete", onClick: () => { setVulns((vs) => vs.filter((x) => x.id !== v.id)); toast({ kind: "info", msg: "Rule deleted" }); } }, h(Icons.trash, { size: 14 })))),
        vulns.length === 0 && h("div", { className: "empty-state" },
          h("div", { className: "es-icon" }, h(Icons.bug, { size: 24 })),
          h("h3", null, "No custom rules yet"),
          h("p", null, "Describe a vulnerability unique to your stack and Akira AI will research it and add it to every scan."))),
      adding && h(AddVulnModal, { onClose: () => setAdding(false), onSave: (v) => { setVulns((vs) => [...vs, Object.assign({ id: Date.now(), active: true }, v)]); setAdding(false); toast({ kind: "success", msg: "Added to your library" }); } }),
      editing && h(AddVulnModal, { vuln: editing, onClose: () => setEditing(null), onSave: (v) => { setVulns((vs) => vs.map((x) => x.id === v.id ? v : x)); setEditing(null); toast({ kind: "success", msg: "Saved vulnerability details" }); } }));
  }
  window.CustomVulnsPage = CustomVulnsPage;

  function AddVulnModal({ onClose, onSave, vuln }) {
    const [phase, setPhase] = useState("form"); // form | research | result
    const [name, setName] = useState(vuln ? vuln.name : "");
    const [desc, setDesc] = useState(vuln ? vuln.desc : "");
    const [sev, setSev] = useState(vuln ? vuln.sev : "high");
    const [queries, setQueries] = useState([]);
    const [synth, setSynth] = useState(false);

    const RESEARCH_QUERIES = [
      "“" + (name || "internal API key leak") + "” vulnerability patterns",
      "CWE classification " + (name || "credential exposure"),
      "detection regex " + (name || "API key") + " source code",
      "real-world exploits " + (name || "leaked credentials") + " 2024–2026",
      "remediation best practices",
    ];

    function startResearch() {
      setPhase("research"); setQueries([]); setSynth(false);
      RESEARCH_QUERIES.forEach((q, i) => setTimeout(() => setQueries((qs) => [...qs, q]), 600 + i * 900));
      setTimeout(() => setSynth(true), 600 + RESEARCH_QUERIES.length * 900);
      setTimeout(() => setPhase("result"), 600 + RESEARCH_QUERIES.length * 900 + 2200);
    }

    return h(Modal, { onClose, width: 560 },
      h("div", { style: { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("h3", { style: { fontSize: 15, fontWeight: 650 } },
          phase === "form" ? (vuln ? "Edit custom vulnerability" : "Add custom vulnerability") : phase === "research" ? "Researching…" : "Research complete"),
        h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 16 }))),
      h("div", { style: { padding: 22, overflowY: "auto" } },
        phase === "form" && h("div", { className: "step-panel" },
          h("label", { className: "flabel" }, "Name"),
          h("input", { className: "field", placeholder: "e.g. Leaked internal service token", value: name, onChange: (e) => setName(e.target.value), style: { marginBottom: 14 } }),
          h("label", { className: "flabel" }, "Describe what to look for"),
          h("textarea", { className: "field", rows: 3, placeholder: "Tokens with prefix acme_sk_ committed to source, or referenced in client-side code…", value: desc, onChange: (e) => setDesc(e.target.value), style: { resize: "none", marginBottom: 14 } }),
          h("label", { className: "flabel" }, "Severity"),
          h("div", { className: "severity-selector" },
            ["critical", "high", "medium", "low"].map((s) =>
              h("button", {
                key: s,
                type: "button",
                onClick: () => setSev(s),
                className: "severity-btn" + (sev === s ? " active-" + s : "")
              },
                h("span", { className: "dot dot-" + s }),
                s.charAt(0).toUpperCase() + s.slice(1)
              )))),
        phase === "research" && h("div", { className: "step-panel" },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } },
            h("div", { className: "spinner" }),
            h("span", { style: { fontSize: 13.5, fontWeight: 600 } }, synth ? "Synthesizing findings…" : "Running web research")),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            queries.map((q, i) =>
              h("div", { key: i, className: "research-q", style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", border: "1px solid var(--border)" } },
                h(Icons.search, { size: 14, style: { color: "var(--accent)", flexShrink: 0 } }),
                h("span", { className: "mono", style: { fontSize: 12, color: "var(--text-1)" } }, q),
                h("span", { style: { marginLeft: "auto", display: "flex" } },
                  i < queries.length - 1 || synth ? h(Icons.check, { size: 14, style: { color: "var(--sev-clean)" } }) : h("div", { className: "spinner", style: { width: 12, height: 12 } })))),
            synth && h("div", { className: "research-q", style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: "var(--r-md)", background: "var(--accent-soft)", border: "1px solid var(--accent)" } },
              h(Icons.sparkle, { size: 14, style: { color: "var(--accent)" } }),
              h("span", { style: { fontSize: 12.5, fontWeight: 550 } }, "Cross-referencing 14 sources · extracting detection patterns…")))),
        phase === "result" && h("div", { className: "step-panel" },
          h("div", { className: "card", style: { padding: 16, marginBottom: 12, background: "var(--bg-inset)" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
              h(SevBadge, { sev }), h("span", { style: { fontWeight: 650, fontSize: 14 } }, name || "Leaked internal service token")),
            h("div", { style: { fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" } },
              h("p", { style: { marginBottom: 8 } }, h("strong", { style: { color: "var(--text-1)" } }, "What it is: "), "Internal service tokens committed to source grant lateral access to internal APIs. Treated as credential exposure (CWE-798 family)."),
              h("p", { style: { marginBottom: 8 } }, h("strong", { style: { color: "var(--text-1)" } }, "Detection patterns: "), "Regex match on token prefix in all text files; entropy analysis on string literals; references in client-bundled code."),
              h("p", null, h("strong", { style: { color: "var(--text-1)" } }, "Sources: "), "OWASP Secrets Management Cheat Sheet · GitGuardian 2025 report · CWE-798"))),
          h("div", { style: { fontSize: 12, color: "var(--text-3)" } }, "This rule will run in every future scan. You can edit the patterns any time."))),
      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 } },
        phase === "form" && (vuln ?
          h(React.Fragment, null,
            h("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
            h("button", { className: "btn btn-primary", disabled: !name.trim() && !desc.trim(), onClick: () => onSave(Object.assign({}, vuln, { name, desc, sev })) }, "Save Changes")
          ) :
          h("button", { className: "btn btn-primary", disabled: !name && !desc, onClick: startResearch }, h(Icons.search, { size: 14 }), "Research & Add")),
        phase === "result" && h(React.Fragment, null,
          h("button", { className: "btn btn-secondary", onClick: () => setPhase("form") }, "Edit"),
          h("button", { className: "btn btn-primary", onClick: () => onSave({ name: name || "Leaked internal service token", desc: desc || "Internal tokens committed to source", sev }) }, "Save to Library"))));
  }

  // ============ OPTIMIZATION PLANS ============
  function PlansPage({ toast }) {
    const [creating, setCreating] = useState(false);
    const [detail, setDetail] = useState(null);
    const plans = window.VS_PLANS;
    const statusColor = { "Done": "var(--sev-clean)", "In progress": "var(--sev-low)", "Pending": "var(--text-3)" };

    if (detail) {
      const p = plans.find((x) => x.name === detail);
      return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Plan Detail" },
        h("button", { className: "btn btn-ghost btn-sm", style: { marginBottom: 14 }, onClick: () => setDetail(null) }, h(Icons.chevL, { size: 14 }), "All plans"),
        h(PageHead, { title: p.name, desc: (p.repo ? p.repo + " · " : "") + p.priority + " priority · " + p.linked + " linked findings" }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" } },
          h("div", { className: "card", style: { padding: 6 } },
            p.goals.map((g, i) =>
              h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--border)" : "none" } },
                h("div", { style: { width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: g.status === "Done" ? "var(--sev-clean)" : "var(--bg-active)", color: g.status === "Done" ? "#fff" : "var(--text-3)",
                  border: g.status === "In progress" ? "2px solid var(--sev-low)" : "none" } },
                  g.status === "Done" && h(Icons.check, { size: 13, sw: 2.6 })),
                h("span", { style: { flex: 1, fontSize: 13.5, textDecoration: g.status === "Done" ? "line-through" : "none", color: g.status === "Done" ? "var(--text-3)" : "var(--text-1)" } }, g.text),
                h("span", { style: { fontSize: 11.5, fontWeight: 600, color: statusColor[g.status] } }, g.status))),
          ),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
            h("div", { className: "card", style: { padding: 18, textAlign: "center" } },
              h(Ring, { value: p.health, size: 84, stroke: 6, color: p.health > 80 ? "var(--sev-clean)" : "var(--sev-high)" }),
              h("div", { style: { fontSize: 12.5, fontWeight: 600, marginTop: 8 } }, "Plan health"),
              h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 2 } }, "Based on goal progress & linked findings")),
            h("div", { className: "card", style: { padding: "14px 16px" } },
              h("div", { style: { fontSize: 12.5, fontWeight: 650, marginBottom: 8 } }, "Linked findings"),
              window.VS_FINDINGS.filter((f) => f.type === "opt").slice(0, p.linked).map((f) =>
                h("div", { key: f.id, style: { display: "flex", alignItems: "center", gap: 7, padding: "5px 0", fontSize: 12 } },
                  h(SevDot, { sev: "opt", size: 7 }),
                  h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.name)))))));
    }

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Optimization Plans" },
      h(PageHead, { title: "Optimization Plans", desc: "Goal-driven optimization tracked across scans.",
        action: h("button", { className: "btn btn-primary", onClick: () => setCreating(true) }, h(Icons.plus, { size: 15, sw: 2.2 }), "Create plan") }),
      h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 } },
        plans.map((p) =>
          h("button", { key: p.name, className: "card card-hover", style: { padding: 18, textAlign: "left", display: "flex", gap: 16, alignItems: "center" }, onClick: () => setDetail(p.name) },
            h(Ring, { value: p.progress, size: 56, stroke: 5, color: "var(--sev-clean)" }),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontSize: 14, fontWeight: 650 } }, p.name),
              p.repo && h("div", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-3)", marginTop: 2, overflow: "hidden" } },
                h(Icons.github, { size: 12, style: { flexShrink: 0 } }),
                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.repo)),
              h("div", { style: { fontSize: 12, color: "var(--text-2)", marginTop: 3 } }, p.goals.filter((g) => g.status === "Done").length + " of " + p.goals.length + " goals done"),
              h("div", { style: { display: "flex", gap: 6, marginTop: 7 } },
                h(Tag, null, p.priority),
                h(Tag, null, p.linked + " findings")))))),
      creating && h(CreatePlanModal, { onClose: () => setCreating(false), toast }));
  }
  window.PlansPage = PlansPage;

  function CreatePlanModal({ onClose, toast }) {
    const [phase, setPhase] = useState("form"); // form | validating | issues
    const [name, setName] = useState("Q3 Latency Reduction");
    const [goals, setGoals] = useState("Cut p95 checkout latency by 40%\nRemove N+1 queries from order flows\nAdd caching for category tree");
    // A plan targets one connected GitHub repository.
    const ghRepos = window.VS_GH_REPOS || [];
    const [repo, setRepo] = useState(ghRepos[0] ? ghRepos[0].name : "");

    function validate() {
      if (!name.trim()) {
        setName("Custom Optimization Plan");
      }
      setPhase("validating");
      setTimeout(() => setPhase("issues"), 2600);
    }

    return h(Modal, { onClose, width: 540 },
      h("div", { style: { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("h3", { style: { fontSize: 15, fontWeight: 650 } },
          phase === "form" ? "Create optimization plan" : phase === "validating" ? "AI validating plan…" : "Plan check complete"),
        h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 16 }))),
      h("div", { style: { padding: 22 } },
        phase === "form" && ghRepos.length === 0 && h("div", { className: "empty-state", style: { padding: "20px 0" } },
          h(Icons.github, { size: 26, style: { color: "var(--text-3)", margin: "0 auto 8px" } }),
          h("h3", null, "Connect a GitHub repo first"),
          h("p", null, "Optimization plans target a connected GitHub repository. Connect GitHub and scan a repo, then create a plan for it.")),
        phase === "form" && ghRepos.length > 0 && h("div", { className: "step-panel" },
          h("label", { className: "flabel" }, "Repository"),
          h("div", { style: { marginBottom: 6 } },
            h(Dropdown, { width: "100%", value: repo, onChange: setRepo,
              options: ghRepos.map((r) => ({ value: r.name, label: r.name + (r.private ? "  (private)" : "") })) })),
          h("p", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 14 } }, "Goals will track findings from this repo's scans."),
          h("label", { className: "flabel" }, "Plan name"),
          h("input", { className: "field", placeholder: "e.g. Q3 Latency Reduction", value: name, onChange: (e) => setName(e.target.value), style: { marginBottom: 14 } }),
          h("label", { className: "flabel" }, "Goals (one per line)"),
          h("textarea", { className: "field", rows: 4, placeholder: "Cut p95 checkout latency by 40%\nRemove N+1 queries from order flows\nAdd caching for category tree", value: goals, onChange: (e) => setGoals(e.target.value), style: { resize: "none", marginBottom: 4 } })),
        phase === "validating" && h("div", { className: "step-panel", style: { textAlign: "center", padding: "26px 0" } },
          h("div", { style: { display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 22px", borderRadius: "var(--r-lg)", background: "var(--bg-inset)", border: "1px solid var(--border)" } },
            h("div", { className: "spinner" }),
            h("div", { style: { textAlign: "left" } },
              h("div", { style: { fontSize: 13.5, fontWeight: 600 } }, "AI validating your plan…"),
              h("div", { style: { fontSize: 12, color: "var(--text-3)" } }, "Checking goals for measurability and conflicts")))),
        phase === "issues" && h("div", { className: "step-panel" },
          h("div", { className: "card", style: { padding: 16, background: "var(--sev-high-bg)", border: "1px solid var(--sev-high)", marginBottom: 12, display: "flex", gap: 10 } },
            h(Icons.alert, { size: 17, style: { color: "var(--sev-high)", flexShrink: 0, marginTop: 1 } }),
            h("div", null,
              h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, "2 goals need attention"),
              h("ul", { style: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 16 } },
                h("li", null, "Goal 2 needs a baseline first — no current p95 metric exists for checkout. Suggest adding: “Instrument checkout latency”."),
                h("li", null, "Goal 3 overlaps with your existing plan “Q3 Latency Reduction”. Consider merging.")))),
          h("div", { style: { fontSize: 12.5, color: "var(--text-2)" } }, "You can accept the suggested revisions, revise manually, or save as-is.")),
      ),
      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 } },
        phase === "form" && h(React.Fragment, null,
          h("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
          h("button", { className: "btn btn-primary", disabled: !goals.trim(), onClick: validate }, h(Icons.shieldCheck, { size: 15 }), "Validate Plan")
        ),
        phase === "issues" && h(React.Fragment, null,
          h("button", { className: "btn btn-ghost", onClick: () => setPhase("form") }, "Revise"),
          h("button", { className: "btn btn-secondary", onClick: () => { toast({ kind: "success", msg: "Plan saved with suggestions applied" }); onClose(); } }, "Accept Suggestions"),
          h("button", { className: "btn btn-primary", onClick: () => { toast({ kind: "success", msg: "Plan saved" }); onClose(); } }, "Save Anyway"))));
  }

  // ============ WATCHLIST ============
  function WatchlistPage({ toast, nav }) {
    const [scanning, setScanning] = useState({});
    const [freqs, setFreqs] = useState(() => Object.fromEntries((window.VS_WATCHLIST || []).map((w) => [w.repo, w.freq])));
    const items = window.VS_WATCHLIST;
    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Watchlist" },
      h(PageHead, { title: "Watchlist", desc: "Pinned repositories monitored for new findings." }),
      h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 } },
        items.map((w) =>
          h("div", { key: w.repo, className: "card card-hover", style: { padding: 18 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } },
              h(Icons.github, { size: 16, style: { color: "var(--text-2)" } }),
              h("span", { style: { fontWeight: 650, fontSize: 13.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.repo),
              (w.changeDir === "up" || w.changeDir === "down")
                ? h("button", { className: "badge", title: "View what changed",
                    onClick: () => nav && nav("report"),
                    style: { cursor: "pointer", border: "none",
                      background: w.changeDir === "up" ? "var(--sev-critical-bg)" : "var(--sev-clean-bg)",
                      color: w.changeDir === "up" ? "var(--sev-critical)" : "var(--sev-clean)" } },
                    w.changeDir === "up" && h(Icons.arrowUp, { size: 11 }), w.changeDir === "down" && h(Icons.arrowDown, { size: 11 }), w.change, h(Icons.chevR, { size: 10, style: { opacity: 0.6 } }))
                : h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-3)" } }, w.change)),
            h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 14 } },
              h("div", null,
                h("div", { style: { fontSize: 26, fontWeight: 700, color: scoreColor(w.score) } }, w.score),
                h("div", { style: { fontSize: 11, color: "var(--text-3)" } }, "security score")),
              h("div", { style: { flex: 1 } }),
              h("div", { style: { textAlign: "right", fontSize: 11.5, color: "var(--text-3)" } }, "last scan", h("br", null), w.last)),
            h("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-3)" } },
                "Frequency",
                h(Dropdown, { size: "sm", minWidth: 104, value: freqs[w.repo] || w.freq,
                  options: [{ value: "manual", label: "Manual" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }],
                  onChange: (v) => { setFreqs((f) => Object.assign({}, f, { [w.repo]: v })); toast({ kind: "info", msg: "Re-scan frequency set to " + v }); } })),
              h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 },
                onClick: () => { setScanning((s) => Object.assign({}, s, { [w.repo]: true })); setTimeout(() => { setScanning((s) => Object.assign({}, s, { [w.repo]: false })); toast({ kind: "success", msg: "Re-scan complete — no new findings" }); }, 2600); } },
                scanning[w.repo] ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : h(Icons.refresh, { size: 13 }),
                scanning[w.repo] ? "Scanning…" : "Re-scan"))))));
  }
  window.WatchlistPage = WatchlistPage;

  // ============ REPORTS ============
  function ReportsPage({ toast, nav }) {
    const reports = [
      { name: "ecommerce-api — Jun 10", repo: "user/ecommerce-api", score: 38, findings: 43, date: "Jun 10, 2026" },
      { name: "ecommerce-api — Jun 2", repo: "user/ecommerce-api", score: 33, findings: 42, date: "Jun 2, 2026" },
      { name: "payments-gateway — Jun 8", repo: "user/payments-gateway", score: 61, findings: 19, date: "Jun 8, 2026" },
      { name: "marketing-site — Jun 9", repo: "acme/marketing-site", score: 94, findings: 2, date: "Jun 9, 2026" },
      { name: "auth-service — Jun 8", repo: "user/auth-service", score: 67, findings: 14, date: "Jun 8, 2026" },
    ];
    const links = [
      { url: "akira.ai/r/8fk2-demo", views: 14, created: "Jun 10" },
      { url: "akira.ai/r/3xp9-board", views: 3, created: "Jun 4" },
    ];
    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Reports" },
      h(PageHead, { title: "Reports", desc: "Saved and exported scan reports." }),
      h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 24 } },
        reports.map((r) =>
          h("div", { key: r.name, className: "card card-hover", onClick: () => nav("report"),
            style: { padding: 16, cursor: "pointer", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
              h(Icons.report, { size: 16, style: { color: "var(--text-2)" } }),
              h("span", { style: { fontWeight: 650, fontSize: 13, flex: 1 } }, r.name)),
            h("div", { style: { display: "flex", gap: 14, fontSize: 12, color: "var(--text-2)", marginBottom: 12 } },
              h("span", null, h("strong", { style: { color: scoreColor(r.score), fontSize: 16 } }, r.score), " score"),
              h("span", null, h("strong", { style: { color: "var(--text-1)", fontSize: 16 } }, r.findings), " findings"),
              h("span", { style: { marginLeft: "auto", color: "var(--text-3)" } }, r.date)),
            h("div", { style: { display: "flex", gap: 6 } },
              ["PDF", "JSON", "CSV"].map((fmt) =>
                h("button", { key: fmt, className: "btn btn-secondary btn-sm", style: { fontSize: 11 }, onClick: (e) => { e.stopPropagation(); toast({ kind: "success", msg: fmt + " download started" }); } },
                  h(Icons.download, { size: 12 }), fmt))))),
      ),
      h("h3", { style: { fontSize: 15, fontWeight: 650, marginBottom: 10 } }, "Active share links"),
      h("div", { className: "card" },
        links.map((l, i) =>
          h("div", { key: l.url, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i ? "1px solid var(--border)" : "none" } },
            h(Icons.link, { size: 15, style: { color: "var(--text-3)" } }),
            h("span", { className: "mono", style: { fontSize: 12.5, flex: 1 } }, l.url),
            h("span", { style: { fontSize: 12, color: "var(--text-3)" } }, l.views + " views · created " + l.created),
            h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, onClick: () => toast({ kind: "info", msg: "Link revoked" }) }, "Revoke")))));
  }
  window.ReportsPage = ReportsPage;
})();
