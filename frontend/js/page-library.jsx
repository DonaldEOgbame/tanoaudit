// VaultScan — Custom Vulnerabilities, Optimization Plans, Watchlist, Reports
// Wired to the live backend through window.AkiraAPI (Agent C / Vault).
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useCallback } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, SevDot, Switch, Ring, Tag, Modal, scoreColor, ProgressBar, Dropdown } = window;
  const API = window.AkiraAPI;

  // One labelled section of a research result: small uppercase heading + body.
  // Returns null when there's no content so empty sections are skipped.
  function ResultSection(label, body) {
    if (!body || !String(body).trim()) return null;
    return h("div", { key: label },
      h("div", { style: { fontSize: 10.5, fontWeight: 650, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 } }, label),
      h("p", { style: { fontSize: 12.5, lineHeight: 1.6, color: "var(--text-1)", margin: 0 } }, body));
  }

  // Map backend severity (may include "info") onto the badge set the UI knows.
  function uiSev(sev) {
    const s = (sev || "medium").toLowerCase();
    return s === "info" ? "low" : s;
  }

  function errMsg(e) {
    if (e && e.message) return e.message;
    if (e && e.code) return e.code;
    return "Something went wrong";
  }

  function PageHead({ title, desc, action }) {
    return h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" } },
      h("div", null,
        h("h1", { style: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } }, title),
        desc && h("p", { style: { color: "var(--text-2)", fontSize: 13, marginTop: 2 } }, desc)),
      action);
  }
  window.PageHead = PageHead;

  // Shared loading / error placeholders ------------------------------------
  function LoadingBlock({ label }) {
    return h("div", { className: "empty-state", style: { padding: "40px 0" } },
      h("div", { className: "spinner", style: { margin: "0 auto 12px" } }),
      h("p", null, label || "Loading…"));
  }
  function ErrorBlock({ msg, onRetry }) {
    return h("div", { className: "empty-state", style: { padding: "36px 0" } },
      h("div", { className: "es-icon" }, h(Icons.alert, { size: 24, style: { color: "var(--sev-high)" } })),
      h("h3", null, "Couldn't load"),
      h("p", null, msg || "Please try again."),
      onRetry && h("button", { className: "btn btn-secondary btn-sm", style: { marginTop: 10 }, onClick: onRetry }, "Retry"));
  }

  // ============ CUSTOM VULNERABILITIES ============
  function CustomVulnsPage({ toast }) {
    const [vulns, setVulns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState({}); // id -> bool (toggle/delete in flight)

    const load = useCallback(async () => {
      setLoading(true); setError(null);
      try {
        const rows = await API.customVulns.list();
        setVulns(rows || []);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function toggleActive(v, on) {
      // Optimistic; revert on failure.
      setVulns((vs) => vs.map((x) => x.id === v.id ? Object.assign({}, x, { active: on }) : x));
      setBusy((b) => Object.assign({}, b, { [v.id]: true }));
      try {
        await API.customVulns.update(v.id, { active: on });
      } catch (e) {
        setVulns((vs) => vs.map((x) => x.id === v.id ? Object.assign({}, x, { active: !on }) : x));
        toast({ kind: "error", msg: errMsg(e) });
      } finally {
        setBusy((b) => Object.assign({}, b, { [v.id]: false }));
      }
    }

    async function remove(v) {
      setBusy((b) => Object.assign({}, b, { [v.id]: true }));
      try {
        await API.customVulns.remove(v.id);
        setVulns((vs) => vs.filter((x) => x.id !== v.id));
        toast({ kind: "info", msg: "Rule deleted" });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        setBusy((b) => Object.assign({}, b, { [v.id]: false }));
      }
    }

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Custom Vulnerabilities" },
      h(PageHead, { title: "Custom Vulnerabilities", desc: "Your own detection rules, researched and added to every scan.",
        action: h("button", { className: "btn btn-primary", onClick: () => setAdding(true) }, h(Icons.plus, { size: 15, sw: 2.2 }), "Add Custom Vulnerability") }),
      h("div", { className: "card", style: { overflow: "visible" } },
        loading ? h(LoadingBlock, { label: "Loading custom rules…" }) :
        error ? h(ErrorBlock, { msg: error, onRetry: load }) :
        h(React.Fragment, null,
          vulns.map((v, i) =>
            h("div", { key: v.id, style: { display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderTop: i ? "1px solid var(--border)" : "none", opacity: v.active ? 1 : 0.55, transition: "opacity var(--dur-med) ease" } },
              h(SevBadge, { sev: uiSev(v.severity) }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 } },
                  v.name,
                  v.researched && h("span", { className: "badge", style: { background: "var(--accent-soft)", color: "var(--accent)", fontSize: 10.5 } }, "researched")),
                h("div", { style: { fontSize: 12, color: "var(--text-2)", marginTop: 1 } }, v.description || "No description")),
              h(Switch, { on: v.active, onChange: (on) => toggleActive(v, on) }),
              h("button", { className: "icon-btn", "data-tip": "Edit", onClick: () => setEditing(v) }, h(Icons.edit, { size: 14 })),
              h("button", { className: "icon-btn", "data-tip": "Delete", disabled: !!busy[v.id], onClick: () => remove(v) }, h(Icons.trash, { size: 14 })))),
          vulns.length === 0 && h("div", { className: "empty-state" },
            h("div", { className: "es-icon" }, h(Icons.bug, { size: 24 })),
            h("h3", null, "No custom rules yet"),
            h("p", null, "Describe a vulnerability unique to your stack and Akira AI will research it and add it to every scan.")))),
      adding && h(AddVulnModal, { toast, onClose: () => setAdding(false), onSaved: () => { setAdding(false); load(); } }),
      editing && h(AddVulnModal, { toast, vuln: editing, onClose: () => setEditing(null), onSaved: () => { setEditing(null); load(); } }));
  }
  window.CustomVulnsPage = CustomVulnsPage;

  function AddVulnModal({ onClose, onSaved, vuln, toast }) {
    const [phase, setPhase] = useState("form"); // form | research | result
    const [name, setName] = useState(vuln ? vuln.name : "");
    const [desc, setDesc] = useState(vuln ? (vuln.description || "") : "");
    const [sev, setSev] = useState(vuln ? uiSev(vuln.severity) : "high");
    const [saving, setSaving] = useState(false);
    // Live research SSE state.
    const [queries, setQueries] = useState([]);
    const [synth, setSynth] = useState(false);
    const [result, setResult] = useState(null); // { what_it_is, detection_patterns, what_to_look_for, how_to_fix, source_urls }
    const [researchErr, setResearchErr] = useState(null);
    const streamRef = useRef(null);

    useEffect(() => () => { if (streamRef.current) try { streamRef.current.abort(); } catch (e) {} }, []);

    // Save without research: straight create / update.
    async function saveBasic() {
      setSaving(true);
      try {
        if (vuln) {
          await API.customVulns.update(vuln.id, { name, description: desc, severity: sev });
          toast({ kind: "success", msg: "Saved vulnerability details" });
        } else {
          await API.customVulns.create({ name, description: desc, severity: sev, active: true });
          toast({ kind: "success", msg: "Added to your library" });
        }
        onSaved();
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        setSaving(false);
      }
    }

    // Research pipeline streams SSE events; the backend persists the definition
    // (creating the vuln if needed, or updating vuln.id when editing).
    async function startResearch() {
      setPhase("research"); setQueries([]); setSynth(false); setResult(null); setResearchErr(null);
      const body = { name, description: desc };
      if (vuln) body.custom_vuln_id = vuln.id;
      let gotDefinition = null;
      let streamErr = null;
      try {
        const handle = API.stream("/custom-vulnerabilities/research", body, (ev) => {
          // Each data payload carries an explicit `event` field (the SSE helper
          // only reads `data:` lines, not the `event:` line). Drive the animation
          // off that so the synthesizing stage and completion are accurate.
          if (!ev || typeof ev !== "object") return;
          // Capture animation stages.
          if (ev.event === "search_query_sent" && ev.query) {
            setQueries((qs) => qs.includes(ev.query) ? qs : [...qs, ev.query]);
          } else if (ev.event === "synthesizing") {
            setSynth(true);
          } else if (ev.event === "research_failed") {
            streamErr = ev.error || "Research failed";
          } else if (!ev.event && ev.query) {
            // back-compat: payloads without an explicit event field
            setQueries((qs) => qs.includes(ev.query) ? qs : [...qs, ev.query]);
          }
          // Capture the definition from ANY event that carries one (normally
          // research_completed). Robust to event-name changes / reorderings.
          if (ev.definition && (ev.definition.what_it_is || ev.definition.detection_patterns)) {
            gotDefinition = ev.definition;
            setSynth(true);
            setResult(ev.definition);
          }
        });
        streamRef.current = handle;
        await handle.promise;
        // Only show "complete" once we actually have the researched definition.
        if (gotDefinition) {
          setPhase("result");
        } else {
          // Stream ended without a definition — surface honestly, don't claim done.
          const msg = streamErr || "Research didn't return a result. Try again.";
          setResearchErr(msg);
          setPhase("form");
          toast({ kind: "error", msg });
        }
      } catch (e) {
        setResearchErr(errMsg(e));
        setPhase("form");
        toast({ kind: "error", msg: "Research failed: " + errMsg(e) });
      }
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
              ))),
          researchErr && h("p", { style: { fontSize: 12, color: "var(--sev-high)", marginTop: 10 } }, researchErr)),
        phase === "research" && h("div", { className: "step-panel" },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } },
            h("div", { className: "spinner" }),
            h("span", { style: { fontSize: 13.5, fontWeight: 600 } }, synth ? "Synthesizing findings…" : "Running web research")),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            queries.length === 0 && !synth && h("div", { style: { fontSize: 12.5, color: "var(--text-3)" } }, "Dispatching research queries…"),
            queries.map((q, i) =>
              h("div", { key: i, className: "research-q", style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", border: "1px solid var(--border)" } },
                h(Icons.search, { size: 14, style: { color: "var(--accent)", flexShrink: 0 } }),
                h("span", { className: "mono", style: { fontSize: 12, color: "var(--text-1)" } }, q),
                h("span", { style: { marginLeft: "auto", display: "flex" } },
                  i < queries.length - 1 || synth ? h(Icons.check, { size: 14, style: { color: "var(--sev-clean)" } }) : h("div", { className: "spinner", style: { width: 12, height: 12 } })))),
            synth && h("div", { className: "research-q", style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: "var(--r-md)", background: "var(--accent-soft)", border: "1px solid var(--accent)" } },
              h(Icons.sparkle, { size: 14, style: { color: "var(--accent)" } }),
              h("span", { style: { fontSize: 12.5, fontWeight: 550 } }, "Cross-referencing sources · extracting detection patterns…")))),
        phase === "result" && h("div", { className: "step-panel" },
          h("div", { className: "card", style: { padding: 18, marginBottom: 12, background: "var(--bg-inset)" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" } },
              h(SevBadge, { sev }), h("span", { style: { fontWeight: 650, fontSize: 14.5 } }, name || "Custom vulnerability")),
            result ? h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
              ResultSection("What it is", result.what_it_is),
              ResultSection("Detection patterns", result.detection_patterns),
              ResultSection("What to look for", result.what_to_look_for),
              ResultSection("How to fix", result.how_to_fix),
              (Array.isArray(result.source_urls) && result.source_urls.length > 0) && h("div", null,
                h("div", { style: { fontSize: 10.5, fontWeight: 650, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 } }, "Sources"),
                h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
                  result.source_urls.map((u, i) =>
                    h("a", { key: i, href: u, target: "_blank", rel: "noopener noreferrer", style: { fontSize: 12, color: "var(--accent)", wordBreak: "break-all", textDecoration: "none" } }, u)))))
              : h("p", { style: { fontSize: 12.5, color: "var(--text-2)" } }, "Research complete and saved to your library.")),
          h("div", { style: { fontSize: 12, color: "var(--text-3)" } }, "This rule runs in every future scan. You can edit it any time."))),
      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 } },
        phase === "form" && (vuln ?
          h(React.Fragment, null,
            h("button", { className: "btn btn-secondary", onClick: onClose, disabled: saving }, "Cancel"),
            h("button", { className: "btn btn-secondary", disabled: saving || (!name.trim() && !desc.trim()), onClick: startResearch }, h(Icons.search, { size: 14 }), "Re-research"),
            h("button", { className: "btn btn-primary", disabled: saving || (!name.trim() && !desc.trim()), onClick: saveBasic }, saving ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : null, "Save Changes")
          ) :
          h(React.Fragment, null,
            h("button", { className: "btn btn-secondary", onClick: saveBasic, disabled: saving || (!name.trim() && !desc.trim()) }, "Add without research"),
            h("button", { className: "btn btn-primary", disabled: saving || (!name.trim()), onClick: startResearch }, h(Icons.search, { size: 14 }), "Research & Add"))),
        phase === "result" && h("button", { className: "btn btn-primary", onClick: onSaved }, "Done")));
  }

  // ============ OPTIMIZATION PLANS ============
  function PlansPage({ toast }) {
    const [plans, setPlans] = useState([]);
    const [repos, setRepos] = useState([]); // github repos for the picker + repo labels
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);
    const [detailId, setDetailId] = useState(null);
    const statusColor = { "Done": "var(--sev-clean)", "In progress": "var(--sev-low)", "Pending": "var(--text-3)" };

    const load = useCallback(async () => {
      setLoading(true); setError(null);
      try {
        const [pl, rp] = await Promise.all([
          API.plans.list(),
          API.watchlist.repositories({ github_only: true }).catch(() => []),
        ]);
        setPlans(pl || []);
        setRepos(rp || []);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect(() => { load(); }, [load]);

    const repoLabel = useCallback((id) => {
      const r = repos.find((x) => x.id === id);
      return r ? r.identifier : null;
    }, [repos]);

    async function deletePlan(p) {
      try {
        await API.plans.remove(p.id);
        setPlans((ps) => ps.filter((x) => x.id !== p.id));
        toast({ kind: "info", msg: "Plan deleted" });
        setDetailId(null);
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      }
    }

    async function toggleGoal(goal) {
      const next = goal.status === "Done" ? "Pending" : "Done";
      try {
        const updatedGoal = await API.plans.updateGoal(goal.id, { status: next });
        // updateGoal returns the updated goal, not a plan — patch it into the
        // correct plan's goals array.
        setPlans((ps) => ps.map((plan) => {
          if (!plan.goals.some((g) => g.id === goal.id)) return plan;
          return Object.assign({}, plan, {
            goals: plan.goals.map((g) => g.id === goal.id ? (updatedGoal || Object.assign({}, g, { status: next })) : g),
          });
        }));
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      }
    }

    if (loading) return h("div", { className: "vs-page-pad vs-page-enter" }, h(PageHead, { title: "Optimization Plans" }), h("div", { className: "card" }, h(LoadingBlock, { label: "Loading plans…" })));
    if (error) return h("div", { className: "vs-page-pad vs-page-enter" }, h(PageHead, { title: "Optimization Plans" }), h("div", { className: "card" }, h(ErrorBlock, { msg: error, onRetry: load })));

    if (detailId) {
      const p = plans.find((x) => x.id === detailId);
      if (!p) { setDetailId(null); return null; }
      const repoName = repoLabel(p.repository_id);
      const doneCount = p.goals.filter((g) => g.status === "Done").length;
      return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Plan Detail" },
        h("button", { className: "btn btn-ghost btn-sm", style: { marginBottom: 14 }, onClick: () => setDetailId(null) }, h(Icons.chevL, { size: 14 }), "All plans"),
        h(PageHead, { title: p.name, desc: (repoName ? repoName + " · " : "") + p.priority + " priority · " + p.linked + " linked findings",
          action: h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, onClick: () => deletePlan(p) }, h(Icons.trash, { size: 14 }), "Delete plan") }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" } },
          h("div", { className: "card", style: { padding: 6 } },
            p.goals.length === 0 && h("div", { className: "empty-state", style: { padding: "26px 0" } }, h("p", null, "No goals yet.")),
            p.goals.map((g, i) =>
              h("div", { key: g.id, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--border)" : "none" } },
                h("button", { className: "icon-btn", title: g.status === "Done" ? "Mark not done" : "Mark done", onClick: () => toggleGoal(g),
                  style: { width: 22, height: 22, padding: 0, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
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
              h("div", { style: { fontSize: 12.5, fontWeight: 650, marginBottom: 8 } }, "Progress"),
              h("div", { style: { fontSize: 12, color: "var(--text-2)" } }, doneCount + " of " + p.goals.length + " goals done"),
              h("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 4 } }, p.linked + " linked findings")))));
    }

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Optimization Plans" },
      h(PageHead, { title: "Optimization Plans", desc: "Goal-driven optimization tracked across scans.",
        action: h("button", { className: "btn btn-primary", onClick: () => setCreating(true) }, h(Icons.plus, { size: 15, sw: 2.2 }), "Create plan") }),
      plans.length === 0
        ? h("div", { className: "card" }, h("div", { className: "empty-state", style: { padding: "40px 0" } },
            h("div", { className: "es-icon" }, h(Icons.target ? Icons.target : Icons.shieldCheck, { size: 24 })),
            h("h3", null, "No optimization plans yet"),
            h("p", null, "Create a goal-driven plan tied to one of your connected repositories.")))
        : h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 } },
            plans.map((p) => {
              const repoName = repoLabel(p.repository_id);
              return h("button", { key: p.id, className: "card card-hover", style: { padding: 18, textAlign: "left", display: "flex", gap: 16, alignItems: "center" }, onClick: () => setDetailId(p.id) },
                h(Ring, { value: p.progress, size: 56, stroke: 5, color: "var(--sev-clean)" }),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontSize: 14, fontWeight: 650 } }, p.name),
                  repoName && h("div", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-3)", marginTop: 2, overflow: "hidden" } },
                    h(Icons.github, { size: 12, style: { flexShrink: 0 } }),
                    h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, repoName)),
                  h("div", { style: { fontSize: 12, color: "var(--text-2)", marginTop: 3 } }, p.goals.filter((g) => g.status === "Done").length + " of " + p.goals.length + " goals done"),
                  h("div", { style: { display: "flex", gap: 6, marginTop: 7 } },
                    h(Tag, null, p.priority),
                    h(Tag, null, p.linked + " findings"))));
            })),
      creating && h(CreatePlanModal, { onClose: () => setCreating(false), toast, repos, onCreated: () => { setCreating(false); load(); } }));
  }
  window.PlansPage = PlansPage;

  function CreatePlanModal({ onClose, toast, repos, onCreated }) {
    const [phase, setPhase] = useState("form"); // form | validating | issues
    const [name, setName] = useState("");
    const [goalsText, setGoalsText] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [repoId, setRepoId] = useState(repos[0] ? repos[0].id : "");
    const [issues, setIssues] = useState([]);
    const [validationOk, setValidationOk] = useState(false);
    const [saving, setSaving] = useState(false);
    const streamRef = useRef(null);

    useEffect(() => () => { if (streamRef.current) try { streamRef.current.abort(); } catch (e) {} }, []);

    const goalList = () => goalsText.split("\n").map((s) => s.trim()).filter(Boolean);

    async function persist() {
      setSaving(true);
      try {
        await API.plans.create({
          repository_id: repoId,
          name: name.trim() || "Optimization Plan",
          priority,
          goals: goalList().map((text) => ({ text, status: "Pending" })),
        });
        toast({ kind: "success", msg: "Plan saved" });
        onCreated();
      } catch (e) {
        setSaving(false);
        // The backend also validates (source of truth). If it rejects with
        // per-goal issues, surface them in the issues view instead of a plain
        // error so the user can fix and re-validate.
        if (e && e.code === "plan_validation_failed" && e.details && Array.isArray(e.details.issues)) {
          setIssues(e.details.issues);
          setValidationOk(false);
          setPhase("issues");
          toast({ kind: "error", msg: "Some goals need attention before saving." });
          return;
        }
        toast({ kind: "error", msg: errMsg(e) });
      }
    }

    // Validate streams SSE: approved | issues_found | error. AI-only — there is no
    // heuristic fallback, so an error means validation genuinely couldn't run and
    // we must NOT show "looks good".
    async function validate() {
      const goals = goalList();
      if (goals.length === 0) { toast({ kind: "error", msg: "Add at least one goal" }); return; }
      setPhase("validating"); setIssues([]); setValidationOk(false);
      let streamError = null;
      try {
        const handle = API.stream("/optimization-plans/validate", { goals, repository_id: repoId || null }, (ev) => {
          if (!ev || typeof ev !== "object") return;
          if (ev.status === "error") { streamError = ev.error || "Validation is unavailable."; return; }
          if (Array.isArray(ev.issues)) setIssues(ev.issues);
          if (ev.status === "approved" || ev.approved) setValidationOk(true);
        });
        streamRef.current = handle;
        await handle.promise;
        if (streamError) {
          toast({ kind: "error", msg: streamError });
          setPhase("form");
          return;
        }
        setPhase("issues");
      } catch (e) {
        toast({ kind: "error", msg: "Validation failed: " + errMsg(e) });
        setPhase("form");
      }
    }

    const noRepos = repos.length === 0;

    return h(Modal, { onClose, width: 540 },
      h("div", { style: { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("h3", { style: { fontSize: 15, fontWeight: 650 } },
          phase === "form" ? "Create optimization plan" : phase === "validating" ? "AI validating plan…" : "Plan check complete"),
        h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 16 }))),
      h("div", { style: { padding: 22 } },
        phase === "form" && noRepos && h("div", { className: "empty-state", style: { padding: "20px 0" } },
          h(Icons.github, { size: 26, style: { color: "var(--text-3)", margin: "0 auto 8px" } }),
          h("h3", null, "Connect a GitHub repo first"),
          h("p", null, "Optimization plans target a connected GitHub repository. Connect GitHub and scan a repo, then create a plan for it.")),
        phase === "form" && !noRepos && h("div", { className: "step-panel" },
          h("label", { className: "flabel" }, "Repository"),
          h("div", { style: { marginBottom: 6 } },
            h(Dropdown, { width: "100%", value: repoId, onChange: setRepoId,
              options: repos.map((r) => ({ value: r.id, label: r.identifier })) })),
          h("p", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 14 } }, "Goals will track findings from this repo's scans."),
          h("label", { className: "flabel" }, "Plan name"),
          h("input", { className: "field", placeholder: "e.g. Q3 Latency Reduction", value: name, onChange: (e) => setName(e.target.value), style: { marginBottom: 14 } }),
          h("label", { className: "flabel" }, "Priority"),
          h("div", { style: { marginBottom: 14 } },
            h(Dropdown, { width: "100%", value: priority, onChange: setPriority,
              options: [{ value: "High", label: "High" }, { value: "Medium", label: "Medium" }, { value: "Low", label: "Low" }] })),
          h("label", { className: "flabel" }, "Goals (one per line)"),
          h("textarea", { className: "field", rows: 4, placeholder: "Cut p95 checkout latency by 40%\nRemove N+1 queries from order flows\nAdd caching for category tree", value: goalsText, onChange: (e) => setGoalsText(e.target.value), style: { resize: "none", marginBottom: 4 } })),
        phase === "validating" && h("div", { className: "step-panel", style: { textAlign: "center", padding: "26px 0" } },
          h("div", { style: { display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 22px", borderRadius: "var(--r-lg)", background: "var(--bg-inset)", border: "1px solid var(--border)" } },
            h("div", { className: "spinner" }),
            h("div", { style: { textAlign: "left" } },
              h("div", { style: { fontSize: 13.5, fontWeight: 600 } }, "AI validating your plan…"),
              h("div", { style: { fontSize: 12, color: "var(--text-3)" } }, "Checking goals for measurability and conflicts")))),
        phase === "issues" && h("div", { className: "step-panel" },
          (validationOk && issues.length === 0)
            ? h("div", { className: "card", style: { padding: 16, background: "var(--sev-clean-bg)", border: "1px solid var(--sev-clean)", marginBottom: 12, display: "flex", gap: 10 } },
                h(Icons.check, { size: 17, style: { color: "var(--sev-clean)", flexShrink: 0, marginTop: 1 } }),
                h("div", null, h("div", { style: { fontSize: 13, fontWeight: 650 } }, "Goals look good"), h("div", { style: { fontSize: 12.5, color: "var(--text-2)" } }, "All goals are measurable with no detected conflicts.")))
            : issues.length > 0
              ? h("div", { className: "card", style: { padding: 16, background: "var(--sev-high-bg)", border: "1px solid var(--sev-high)", marginBottom: 12, display: "flex", gap: 10 } },
                  h(Icons.alert, { size: 17, style: { color: "var(--sev-high)", flexShrink: 0, marginTop: 1 } }),
                  h("div", null,
                    h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, issues.length + (issues.length === 1 ? " goal needs" : " goals need") + " attention"),
                    h("ul", { style: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 16 } },
                      issues.map((iss, i) => h("li", { key: i }, typeof iss === "string" ? iss : (iss.message || iss.suggestion || JSON.stringify(iss)))))))
              : h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 12 } }, "Validation complete."),
          h("div", { style: { fontSize: 12.5, color: "var(--text-2)" } }, "You can revise the goals or save the plan as-is.")),
      ),
      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 } },
        // Form phase: validation is MANDATORY — the only way forward is Validate.
        // There is no Save here, so a plan can never be saved unvalidated.
        phase === "form" && h(React.Fragment, null,
          h("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
          !noRepos && h("button", { className: "btn btn-primary", disabled: !goalsText.trim() || !repoId, onClick: validate }, h(Icons.shieldCheck, { size: 15 }), "Validate")
        ),
        // Issues phase: Save is only allowed when validation APPROVED (clean).
        // If the AI flagged issues, the user must revise and re-validate.
        phase === "issues" && h(React.Fragment, null,
          h("button", { className: "btn btn-ghost", onClick: () => setPhase("form") }, "Revise"),
          (validationOk && issues.length === 0)
            ? h("button", { className: "btn btn-primary", disabled: saving, onClick: persist }, saving ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : null, "Save Plan")
            : h("button", { className: "btn btn-primary", disabled: true, title: "Fix the flagged goals and re-validate before saving" }, "Save Plan"))));
  }

  // ============ WATCHLIST ============
  function WatchlistPage({ toast, nav }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scanning, setScanning] = useState({}); // id -> bool
    const [freqBusy, setFreqBusy] = useState({}); // id -> bool

    const load = useCallback(async () => {
      setLoading(true); setError(null);
      try {
        const rows = await API.watchlist.list();
        setItems(rows || []);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function setFrequency(w, v) {
      setFreqBusy((b) => Object.assign({}, b, { [w.id]: true }));
      setItems((its) => its.map((x) => x.id === w.id ? Object.assign({}, x, { freq: v }) : x));
      try {
        await API.watchlist.frequency(w.id, v);
        toast({ kind: "info", msg: "Re-scan frequency set to " + v });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
        load();
      } finally {
        setFreqBusy((b) => Object.assign({}, b, { [w.id]: false }));
      }
    }

    async function unpin(w) {
      try {
        await API.watchlist.unpin(w.id);
        setItems((its) => its.filter((x) => x.id !== w.id));
        toast({ kind: "info", msg: "Removed from watchlist" });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      }
    }

    async function rescan(w) {
      setScanning((s) => Object.assign({}, s, { [w.id]: true }));
      try {
        await API.watchlist.rescan(w.id);
        toast({ kind: "success", msg: "Re-scan started for " + w.repo });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally {
        setScanning((s) => Object.assign({}, s, { [w.id]: false }));
      }
    }

    function fmtDate(d) {
      if (!d) return "—";
      try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch (e) { return String(d); }
    }

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Watchlist" },
      h(PageHead, { title: "Watchlist", desc: "Pinned repositories monitored for new findings." }),
      loading ? h("div", { className: "card" }, h(LoadingBlock, { label: "Loading watchlist…" })) :
      error ? h("div", { className: "card" }, h(ErrorBlock, { msg: error, onRetry: load })) :
      items.length === 0 ? h("div", { className: "card" }, h("div", { className: "empty-state", style: { padding: "40px 0" } },
        h("div", { className: "es-icon" }, h(Icons.github, { size: 24 })),
        h("h3", null, "Nothing on your watchlist"),
        h("p", null, "Pin a scanned repository to monitor it for new findings over time."))) :
      h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 } },
        items.map((w) =>
          h("div", { key: w.id, className: "card card-hover", style: { padding: 18 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } },
              h(Icons.github, { size: 16, style: { color: "var(--text-2)" } }),
              h("span", { style: { fontWeight: 650, fontSize: 13.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, w.repo),
              (w.change_dir === "up" || w.change_dir === "down")
                ? h("button", { className: "badge", title: "View what changed",
                    onClick: () => nav && nav("report", w.last_scan_id),
                    style: { cursor: "pointer", border: "none",
                      background: w.change_dir === "up" ? "var(--sev-critical-bg)" : "var(--sev-clean-bg)",
                      color: w.change_dir === "up" ? "var(--sev-critical)" : "var(--sev-clean)" } },
                    w.change_dir === "up" && h(Icons.arrowUp, { size: 11 }), w.change_dir === "down" && h(Icons.arrowDown, { size: 11 }), w.change, h(Icons.chevR, { size: 10, style: { opacity: 0.6 } }))
                : h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-3)" } }, w.change),
              h("button", { className: "icon-btn", "data-tip": "Unpin", onClick: () => unpin(w) }, h(Icons.x, { size: 14 }))),
            h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 14 } },
              h("div", null,
                h("div", { style: { fontSize: 26, fontWeight: 700, color: w.score == null ? "var(--text-3)" : window.riskColor(window.riskFromScore(w.score)) } }, w.score == null ? "—" : window.riskFromScore(w.score)),
                h("div", { style: { fontSize: 11, color: "var(--text-3)" } }, "security risk")),
              h("div", { style: { flex: 1 } }),
              h("div", { style: { textAlign: "right", fontSize: 11.5, color: "var(--text-3)" } }, "last scan", h("br", null), fmtDate(w.last))),
            h("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-3)" } },
                "Frequency",
                h(Dropdown, { size: "sm", minWidth: 104, value: w.freq || "manual",
                  options: [{ value: "manual", label: "Manual" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }],
                  onChange: (v) => setFrequency(w, v) })),
              h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, disabled: !!scanning[w.id],
                onClick: () => rescan(w) },
                scanning[w.id] ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : h(Icons.refresh, { size: 13 }),
                scanning[w.id] ? "Starting…" : "Re-scan"))))));
  }
  window.WatchlistPage = WatchlistPage;

  // ============ REPORTS ============
  // The Reports page has no single "scan" in scope, and the backend models
  // exports + share links per-scan (/scans/{id}/exports, /scans/{id}/share).
  // So we list the user's scans (scans.list) to provide that context, then wire
  // per-scan export + share against the selected scan.
  function ReportsPage({ toast, nav }) {
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState({}); // `${scanId}:${fmt}` -> bool
    const [shareBusy, setShareBusy] = useState({}); // scanId -> bool
    const [shares, setShares] = useState({}); // scanId -> [shareLink]

    const load = useCallback(async () => {
      setLoading(true); setError(null);
      try {
        const res = await API.scans.list({ limit: 50 });
        // scans.list returns { items, total, ... }
        const items = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
        setScans(items);
        // Pre-load existing share links for completed scans (best-effort).
        const completed = items.filter((s) => s.status === "completed");
        const entries = await Promise.all(completed.map(async (s) => {
          try { return [s.id, await API.reports.getShare(s.id)]; } catch (e) { return [s.id, []]; }
        }));
        const map = {};
        entries.forEach(([id, list]) => { map[id] = list || []; });
        setShares(map);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Create an export, poll until ready, then trigger the download.
    async function doExport(scan, fmt) {
      const key = scan.id + ":" + fmt;
      setExporting((e) => Object.assign({}, e, { [key]: true }));
      try {
        let report = await API.reports.createExport(scan.id, fmt.toLowerCase());
        // Poll list_exports until this report is ready (or fails).
        for (let i = 0; i < 20 && report && report.status !== "ready" && report.status !== "failed"; i++) {
          await new Promise((r) => setTimeout(r, 700));
          const list = await API.reports.listExports(scan.id);
          const found = (list || []).find((x) => x.id === report.id);
          if (found) report = found;
        }
        if (report && report.status === "ready") {
          window.open(API.reports.downloadExportUrl(report.id), "_blank");
          toast({ kind: "success", msg: fmt + " export ready" });
        } else if (report && report.status === "failed") {
          toast({ kind: "error", msg: "Export failed: " + (report.error || "unknown error") });
        } else {
          toast({ kind: "info", msg: "Export is still processing — check back shortly" });
        }
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally {
        setExporting((e) => Object.assign({}, e, { [key]: false }));
      }
    }

    async function createShare(scan) {
      setShareBusy((b) => Object.assign({}, b, { [scan.id]: true }));
      try {
        const link = await API.reports.createShare(scan.id);
        setShares((s) => Object.assign({}, s, { [scan.id]: [...(s[scan.id] || []), link] }));
        try { await navigator.clipboard.writeText(link.url); } catch (e) {}
        toast({ kind: "success", msg: "Share link created" + (link.url ? " · copied to clipboard" : "") });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      } finally {
        setShareBusy((b) => Object.assign({}, b, { [scan.id]: false }));
      }
    }

    async function revokeShare(scanId, link) {
      try {
        await API.reports.deleteShare(link.id);
        setShares((s) => Object.assign({}, s, { [scanId]: (s[scanId] || []).filter((x) => x.id !== link.id) }));
        toast({ kind: "info", msg: "Link revoked" });
      } catch (e) {
        toast({ kind: "error", msg: errMsg(e) });
      }
    }

    function fmtDate(d) {
      if (!d) return "";
      try { return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return String(d); }
    }

    const allShares = Object.keys(shares).reduce((acc, sid) => {
      (shares[sid] || []).filter((l) => !l.revoked).forEach((l) => acc.push({ scanId: sid, link: l }));
      return acc;
    }, []);

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Reports" },
      h(PageHead, { title: "Reports", desc: "Saved and exported scan reports." }),
      loading ? h("div", { className: "card" }, h(LoadingBlock, { label: "Loading reports…" })) :
      error ? h("div", { className: "card" }, h(ErrorBlock, { msg: error, onRetry: load })) :
      scans.length === 0 ? h("div", { className: "card" }, h("div", { className: "empty-state", style: { padding: "40px 0" } },
        h("div", { className: "es-icon" }, h(Icons.report, { size: 24 })),
        h("h3", null, "No reports yet"),
        h("p", null, "Run a scan to generate a report you can export and share."))) :
      h(React.Fragment, null,
        h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 24 } },
          scans.map((s) => {
            const label = (s.repo || s.source_url || "Scan") + " — " + fmtDate(s.created_at);
            const done = s.status === "completed";
            return h("div", { key: s.id, className: "card card-hover", onClick: () => nav("report", s.id),
              style: { padding: 16, cursor: "pointer", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
                h(Icons.report, { size: 16, style: { color: "var(--text-2)" } }),
                h("span", { style: { fontWeight: 650, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
                !done && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-3)" } }, s.status)),
              h("div", { style: { display: "flex", gap: 14, fontSize: 12, color: "var(--text-2)", marginBottom: 12 } },
                h("span", null, h("strong", { style: { color: s.security_score == null ? "var(--text-3)" : window.riskColor(window.riskFromScore(s.security_score)), fontSize: 16 } }, s.security_score == null ? "—" : window.riskFromScore(s.security_score)), " risk"),
                h("span", { style: { marginLeft: "auto", color: "var(--text-3)" } }, fmtDate(s.completed_at || s.created_at))),
              done
                ? h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                    ["PDF", "JSON", "CSV"].map((fmt) => {
                      const busy = exporting[s.id + ":" + fmt];
                      return h("button", { key: fmt, className: "btn btn-secondary btn-sm", style: { fontSize: 11 }, disabled: busy, onClick: (e) => { e.stopPropagation(); doExport(s, fmt); } },
                        busy ? h("div", { className: "spinner", style: { width: 11, height: 11 } }) : h(Icons.download, { size: 12 }), fmt);
                    }),
                    h("button", { className: "btn btn-secondary btn-sm", style: { fontSize: 11 }, disabled: !!shareBusy[s.id], onClick: (e) => { e.stopPropagation(); createShare(s); } },
                      shareBusy[s.id] ? h("div", { className: "spinner", style: { width: 11, height: 11 } }) : h(Icons.link, { size: 12 }), "Share"))
                : h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, "Export available once the scan completes."));
          })),
        h("h3", { style: { fontSize: 15, fontWeight: 650, marginBottom: 10 } }, "Active share links"),
        h("div", { className: "card" },
          allShares.length === 0
            ? h("div", { className: "empty-state", style: { padding: "26px 0" } }, h("p", null, "No active share links. Use “Share” on a completed report to create one."))
            : allShares.map(({ scanId, link }, i) =>
                h("div", { key: link.id, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i ? "1px solid var(--border)" : "none" } },
                  h(Icons.link, { size: 15, style: { color: "var(--text-3)" } }),
                  h("span", { className: "mono", style: { fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, link.url || link.slug),
                  link.last_viewed_at && h("span", { style: { fontSize: 12, color: "var(--text-3)" } }, "viewed " + fmtDate(link.last_viewed_at)),
                  h("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--sev-critical)" }, onClick: () => revokeShare(scanId, link) }, "Revoke"))))));
  }
  window.ReportsPage = ReportsPage;
})();
