// VaultScan — Report tabs: Heatmap, Dependencies, AI-Gen, History
(function () {
  const React = window.React;
  const { useState, useEffect, useMemo } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, SevDot, Tag, Donut, CountUp, scoreColor } = window;

  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4, opt: 5 };

  // Honest banner for tabs whose backend endpoint doesn't exist yet (these still
  // render demo data so the UI is complete; see WIRING.md → Gaps).
  function DemoBanner({ what }) {
    return h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", margin: "0 0 14px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", border: "1px dashed var(--border-strong)", fontSize: 12, color: "var(--text-3)" } },
      h(Icons.alert, { size: 14, style: { flexShrink: 0 } }),
      h("span", null, what + " uses sample data — no backend endpoint yet."));
  }
  window.ReportDemoBanner = DemoBanner;

  // ============ FILE HEATMAP ============
  function HeatmapTab({ onFileClick, findings, meta }) {
    const ALL = findings || window.VS_FINDINGS || [];
    const repoName = (meta && meta.repo) ? meta.repo.split("/").pop() : "repo";
    const [collapsed, setCollapsed] = useState({});
    const SEV_COLS = ["critical", "high", "medium", "low", "info", "opt"];
    const heat = useMemo(() => {
      const folderOf = (p) => {
        if (!p || !p.includes("/")) return "root";
        const parts = p.split("/");
        return parts[0] === "src" ? (parts.length > 2 ? parts[1] : "src") : parts[0];
      };
      const map = {};
      ALL.forEach((f) => {
        const fo = folderOf(f.file);
        if (!map[fo]) map[fo] = { critical: 0, high: 0, medium: 0, low: 0, info: 0, opt: 0 };
        if (map[fo][f.sev] != null) map[fo][f.sev]++;
      });
      const order = Object.keys(map);
      return { rows: order, values: order.map((r) => SEV_COLS.map((s) => map[r][s])) };
    }, [ALL]);
    // Build folder tree from real findings data (grouped by file path).
    const tree = useMemo(() => {
      const root = { name: repoName, children: {}, files: [] };
      const fileMap = {};
      ALL.forEach((f) => {
        if (!f.file) return;
        if (!fileMap[f.file]) fileMap[f.file] = { path: f.file, sec: 0, opt: 0, sev: "info" };
        if (f.type === "opt") { fileMap[f.file].opt++; }
        else {
          fileMap[f.file].sec++;
          if (SEV_ORDER[f.sev] < SEV_ORDER[fileMap[f.file].sev]) fileMap[f.file].sev = f.sev;
        }
      });
      Object.values(fileMap).forEach((fi) => {
        const parts = fi.path.split("/");
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!node.children[parts[i]]) node.children[parts[i]] = { name: parts[i], children: {}, files: [] };
          node = node.children[parts[i]];
        }
        node.files.push(fi);
      });
      return root;
    }, [ALL]);

    function worstOf(node) {
      let worst = "opt", total = 0;
      node.files.forEach((f) => { total += f.sec + f.opt; if (SEV_ORDER[f.sev] < SEV_ORDER[worst]) worst = f.sev; });
      Object.values(node.children).forEach((c) => { const r = worstOf(c); total += r.total; if (SEV_ORDER[r.worst] < SEV_ORDER[worst]) worst = r.worst; });
      return { worst, total };
    }

    function renderNode(node, path, depth) {
      const agg = worstOf(node);
      const isCollapsed = collapsed[path];
      return h("div", { key: path },
        h("button", { onClick: () => setCollapsed((c) => Object.assign({}, c, { [path]: !c[path] })),
          style: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", paddingLeft: 10 + depth * 18, borderRadius: 7, fontSize: 13, fontWeight: 600, color: "var(--text-1)", transition: "background var(--dur-micro) ease" },
          onMouseEnter: (e) => e.currentTarget.style.background = "var(--bg-hover)", onMouseLeave: (e) => e.currentTarget.style.background = "transparent" },
          h(Icons.chevD, { size: 13, style: { transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform var(--dur-micro) ease", color: "var(--text-3)" } }),
          h(Icons.folder, { size: 15, style: { color: (window.SEV[agg.worst] || window.SEV.info).color } }),
          h("span", { className: "mono" }, node.name, "/"),
          h(SevDot, { sev: agg.worst, size: 7 }),
          h("span", { style: { fontSize: 11.5, color: "var(--text-3)", fontWeight: 500 } }, agg.total + " issues")),
        !isCollapsed && h("div", null,
          Object.values(node.children).map((c) => renderNode(c, path + "/" + c.name, depth + 1)),
          node.files.map((f) => {
            const total = f.sec + f.opt;
            const s = window.SEV[f.sev] || window.SEV.info;
            return h("button", { key: f.path, className: "heat-cell", onClick: () => onFileClick(f.path),
              "data-tip": f.sec + " security · " + f.opt + " optimization",
              style: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 10px", paddingLeft: 10 + (depth + 1) * 18 + 21, borderRadius: 7, background: total > 0 ? s.bg : "transparent", marginBottom: 2, position: "relative" } },
              h(Icons.file, { size: 13, style: { color: s.color, flexShrink: 0 } }),
              h("span", { className: "mono", style: { fontSize: 12, color: "var(--text-1)", flexShrink: 0 } }, f.path.split("/").pop()),
              h("span", { style: { fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", width: 50, textAlign: "right" } }, total, " issue", total === 1 ? "" : "s"));
          })));
    }

    return h("div", { style: { height: "100%", overflowY: "auto", padding: "18px 24px 60px" } },
      h("div", { style: { display: "flex", gap: 16, marginBottom: 14, alignItems: "center" } },
        h("span", { style: { fontSize: 12.5, color: "var(--text-2)" } }, "Click a file to open its findings."),
        h("span", { style: { flex: 1 } }),
        ["critical", "high", "medium", "low", "info", "opt"].map((s) =>
          h("span", { key: s, style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-3)" } },
            h(SevDot, { sev: s, size: 7 }), (window.SEV[s]).label))),
      h("div", { className: "card", style: { padding: "16px 20px", marginBottom: 14 } },
        h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" } },
          h("div", null,
            h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Findings density"),
            h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 1 } }, "Folder \u00d7 severity \u2014 darker cells mean more findings")),
          h("div", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-3)" } },
            "Less",
            [18, 40, 60, 80, 100].map((o, i) => h("span", { key: i, style: { width: 12, height: 12, borderRadius: 3, background: "color-mix(in srgb, var(--accent) " + o + "%, transparent)" } })),
            "More")),
        h("div", { style: { overflowX: "auto", paddingBottom: 4 } },
          h(window.HeatGrid, {
            rows: heat.rows, cols: ["Crit", "High", "Med", "Low", "Info", "Opt"], values: heat.values,
            colorFor: (ci) => "var(--sev-" + SEV_COLS[ci] + ")", cell: 22,
            tipFor: (ri, ci, v) => heat.rows[ri] + " \u00b7 " + (window.SEV[SEV_COLS[ci]]).label + ": " + v + " finding" + (v === 1 ? "" : "s"),
          }))),
      h("div", { className: "card", style: { padding: 10 } }, renderNode(tree, "root", 0)));
  }
  window.HeatmapTab = HeatmapTab;

  // Map a backend ScanDependency dict to the table's display shape.
  function normalizeDep(d) {
    const cap = { vulnerable: "Vulnerable", outdated: "Outdated", clean: "Clean" };
    const adv = d.advisory_id || "—";
    return {
      name: d.name,
      version: d.version || "—",
      status: cap[d.status] || "Clean",
      cve: adv,
      note: d.note || (d.latest_version ? ("latest " + d.latest_version) : "—"),
      suggested: d.suggested || "—",
      advisorySummary: d.advisory_summary || "",
    };
  }

  // ============ DEPENDENCIES ============
  function DepsTab({ meta }) {
    const API = window.AkiraAPI;
    const scanId = meta && meta.id;
    const DASH = "—";
    // Real dependency inventory from GET /scans/{id}/dependencies; falls back to
    // the demo list only when there's no real scan (showcase mode).
    const [state, setState] = useState({ loading: !!(scanId && API), error: null, deps: null });
    useEffect(() => {
      if (!scanId || !API) { setState({ loading: false, error: null, deps: null }); return; }
      let alive = true;
      setState({ loading: true, error: null, deps: null });
      API.scans.dependencies(scanId)
        .then((res) => {
          if (!alive) return;
          const items = (res && res.items) || [];
          setState({ loading: false, error: null, deps: items.map(normalizeDep) });
        })
        .catch((e) => { if (alive) setState({ loading: false, error: (e && e.message) || "Failed to load dependencies", deps: null }); });
      return () => { alive = false; };
    }, [scanId]);

    const isReal = Array.isArray(state.deps);
    const deps = isReal ? state.deps : (window.VS_DEPS || []);
    const statusStyle = {
      Vulnerable: { bg: "var(--sev-critical-bg)", color: "var(--sev-critical)" },
      Outdated: { bg: "var(--sev-high-bg)", color: "var(--sev-high)" },
      Clean: { bg: "var(--sev-clean-bg)", color: "var(--sev-clean)" },
    };

    if (state.loading) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 10 } },
        h("div", { className: "spinner", style: { width: 18, height: 18 } }), "Analyzing dependencies…");
    }
    if (state.error) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" } }, "⚠️ " + state.error);
    }
    if (isReal && deps.length === 0) {
      return h("div", { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 8 } },
        h(Icons.package ? Icons.package : Icons.layers, { size: 28, style: { opacity: 0.5 } }),
        h("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--text-2)" } }, "No dependency manifests found"),
        h("div", { style: { fontSize: 12.5 } }, "No package.json, requirements.txt, or pyproject.toml in this repo."));
    }

    return h("div", { style: { height: "100%", overflowY: "auto", padding: "20px 24px 60px" } },
      !isReal && h(DemoBanner, { what: "Dependency analysis" }),
      h("div", { className: "card", style: { overflow: "hidden" } },
        h("div", { style: { padding: "14px 20px", borderBottom: "1px solid var(--border)" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Package inventory"),
          h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 2 } }, deps.length + " dependencies analyzed · checked against OSV advisories")),
        h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
          h("thead", null, h("tr", { style: { color: "var(--text-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--bg-inset)" } },
            ["Package", "Version", "Status", "Advisory", "Suggested"].map((c) =>
              h("th", { key: c, style: { textAlign: "left", padding: "10px 20px", fontWeight: 600, borderBottom: "1px solid var(--border)" } }, c)))),
          h("tbody", null, deps.map((d, i) => {
            const initial = d.name[0].toUpperCase();
            const st = statusStyle[d.status];
            const techIcon = Icons.getTechIcon 
              ? Icons.getTechIcon(d.name, { size: 15, initial, bg: st.bg, color: st.color }) 
              : h("div", { style: { width: 28, height: 28, borderRadius: 7, background: st.bg, color: st.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0, border: "1px solid color-mix(in srgb, " + st.color + " 25%, transparent)" } }, initial);
            return h("tr", { key: d.name, className: "dep-row" + (d.status === "Vulnerable" ? " row-pulse" : ""),
              style: { borderBottom: "1px solid var(--border)", animationDelay: i * 120 + "ms", transition: "background var(--dur-micro) ease" },
              onMouseEnter: (e) => { e.currentTarget.style.background = "var(--bg-hover)"; },
              onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; } },
              h("td", { style: { padding: "11px 20px" } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                  techIcon,
                  h("span", { className: "mono", style: { fontWeight: 600 } }, d.name))),
              h("td", { className: "mono", style: { padding: "11px 20px", color: "var(--text-3)", fontSize: 12 } }, d.version),
              h("td", { style: { padding: "11px 20px" } },
                h("span", { className: "badge", style: Object.assign({}, st, { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px" }) },
                  h("span", { style: { width: 5, height: 5, borderRadius: "50%", background: st.color } }), d.status)),
              h("td", { style: { padding: "11px 20px" } },
                d.cve !== DASH
                  ? h("a", { href: (/^CVE-/i.test(d.cve) ? "https://nvd.nist.gov/vuln/detail/" : "https://osv.dev/vulnerability/") + encodeURIComponent(d.cve), target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), title: d.advisorySummary || undefined, className: "mono", style: { fontSize: 12, color: "var(--sev-low)", textDecoration: "none" } }, d.cve)
                  : h("span", { style: { color: "var(--text-3)", fontSize: 12 } }, d.note)),
              h("td", { className: "mono", style: { padding: "11px 20px", fontSize: 12, color: d.suggested === DASH ? "var(--text-3)" : "var(--sev-clean)", fontWeight: d.suggested === DASH ? 400 : 600 } }, d.suggested));
          })))));
  }
  window.DepsTab = DepsTab;

  // ============ ATTACK PATHS ============
  // Detected vulnerability *combinations* that form real exploitation chains
  // (e.g. SSRF → cloud metadata → credential theft). Backend:
  // GET /scans/{id}/attack-paths (app.services.attack_chains correlation pass).
  // Each path links its constituent findings by public id; clicking one jumps to
  // the Vulnerabilities tab focused on that finding's file.
  function AttackPathsTab({ meta, findings, setTab, setSelFile, nav }) {
    const API = window.AkiraAPI;
    const scanId = meta && meta.id;
    const [state, setState] = useState({ loading: !!(scanId && API), error: null, paths: null });
    useEffect(() => {
      if (!scanId || !API) { setState({ loading: false, error: null, paths: null }); return; }
      let alive = true;
      setState({ loading: true, error: null, paths: null });
      API.scans.attackPaths(scanId)
        .then((rows) => { if (alive) setState({ loading: false, error: null, paths: Array.isArray(rows) ? rows : [] }); })
        .catch((e) => { if (alive) setState({ loading: false, error: (e && e.message) || "Failed to load attack paths", paths: null }); });
      return () => { alive = false; };
    }, [scanId]);

    // public_id → normalized finding, so a chain step resolves to a real finding.
    const byPid = useMemo(() => {
      const m = {};
      (findings || []).forEach((f) => { if (f.publicId) m[f.publicId] = f; });
      return m;
    }, [findings]);

    function openFinding(pid) {
      const f = byPid[pid];
      if (f && f.file && setSelFile && setTab) { setSelFile(f.file); setTab("findings"); }
    }
    function learnMore(p) {
      if (p.learn_slug && nav) { nav("learning", p.learn_slug); return; }
      if (nav) nav("learning");
    }

    if (state.loading) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 10 } },
        h("div", { className: "spinner", style: { width: 18, height: 18 } }), "Correlating findings into attack chains…");
    }
    if (state.error) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" } }, "⚠️ " + state.error);
    }
    const isReal = Array.isArray(state.paths);
    const paths = isReal ? state.paths : [];
    if (isReal && paths.length === 0) {
      return h("div", { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 8, padding: 24, textAlign: "center" } },
        h(Icons.shieldCheck ? Icons.shieldCheck : Icons.shield, { size: 30, style: { color: "var(--sev-clean)", opacity: 0.8 } }),
        h("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--text-2)" } }, "No attack chains detected"),
        h("div", { style: { fontSize: 12.5, maxWidth: 440 } }, "We didn't find combinations of these findings that compose into a known exploitation path. Individual findings still matter — see the Vulnerabilities tab."));
    }

    return h("div", { style: { height: "100%", overflowY: "auto", padding: "20px 24px 60px" } },
      h("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 } },
        h(Icons.target, { size: 18, style: { color: "var(--sev-critical)", flexShrink: 0, marginTop: 1 } }),
        h("div", null,
          h("h3", { style: { fontSize: 14.5, fontWeight: 650 } }, paths.length + " attack chain" + (paths.length === 1 ? "" : "s") + " detected"),
          h("p", { style: { fontSize: 12.5, color: "var(--text-3)", marginTop: 2, lineHeight: 1.5, maxWidth: 620 } },
            "Each chain is a combination of findings that, exploited together, becomes a real hack. Fixing any one link breaks the chain — but the more you close, the better."))),
      paths.map((p, i) => h(AttackPathCard, { key: p.public_id || i, path: p, byPid, openFinding, learnMore })));
  }

  function AttackPathCard({ path, byPid, openFinding, learnMore }) {
    const sev = (path.severity || "high").toLowerCase();
    const sc = (window.SEV[sev] || window.SEV.high);
    const pids = path.finding_public_ids || [];
    const steps = path.steps || [];
    return h("div", { className: "card", style: { padding: 0, marginBottom: 14, overflow: "hidden", borderLeft: "3px solid " + sc.color } },
      // Header
      h("div", { style: { display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", borderBottom: "1px solid var(--border)" } },
        h(SevBadge, { sev }, sc.label),
        h("span", { className: "mono", style: { fontSize: 11, color: "var(--text-3)" } }, path.public_id),
        h("h4", { style: { fontSize: 14, fontWeight: 650, flex: 1, lineHeight: 1.35 } }, path.name),
        path.tier === "potential"
          && h("span", { className: "badge", style: { background: "var(--sev-medium-bg)", color: "var(--sev-medium)" }, title: "Entry point + at least one link present — a plausible partial path, not all links confirmed" }, "Potential"),
        path.source === "catalog"
          ? h("span", { className: "badge", style: { background: "var(--bg-inset)", color: "var(--text-3)" }, title: "Matches a known real-world attack chain" }, "Known chain")
          : h("span", { className: "badge", style: { background: "var(--accent-soft)", color: "var(--accent)" }, title: "Combination identified for this codebase" }, "Detected")),
      h("div", { style: { padding: "14px 18px 16px" } },
        // The chain: clickable finding links joined by arrows.
        h("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 12 } },
          pids.map((pid, i) => {
            const f = byPid[pid];
            const label = (f && f.name) || pid;
            return h(React.Fragment, { key: pid },
              i > 0 && h(Icons.chevR, { size: 14, style: { color: "var(--text-3)", flexShrink: 0 } }),
              h("button", { onClick: () => openFinding(pid),
                title: f ? (label + " — " + (f.file || "")) : ("Finding " + pid),
                style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: f ? sc.bg : "var(--bg-inset)", color: f ? sc.color : "var(--text-3)", fontSize: 12, fontWeight: 600, border: "1px solid color-mix(in srgb, " + sc.color + " 22%, transparent)", cursor: f ? "pointer" : "default", transition: "filter var(--dur-micro) ease" },
                onMouseEnter: (e) => { if (f) e.currentTarget.style.filter = "brightness(1.08)"; },
                onMouseLeave: (e) => { e.currentTarget.style.filter = "none"; } },
                h("span", { className: "mono", style: { fontSize: 10.5, opacity: 0.8 } }, pid),
                h("span", null, label)));
          })),
        // Narrative steps (the attacker's progression), when present.
        steps.length > 0 && h("ol", { style: { margin: "0 0 12px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 } },
          steps.map((s, i) => h("li", { key: i, style: { display: "flex", gap: 9, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 } },
            h("span", { style: { flexShrink: 0, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-inset)", color: "var(--text-3)", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } }, i + 1),
            h("span", null, s)))),
        // Impact + real-world grounding + remediation.
        path.impact && h(InfoRow, { icon: Icons.zap, color: "var(--sev-critical)", label: "Impact", text: path.impact }),
        path.real_world && h(InfoRow, { icon: Icons.book, color: "var(--text-2)", label: "Seen in the wild", text: path.real_world }),
        path.remediation && h(InfoRow, { icon: Icons.shield, color: "var(--sev-clean)", label: "Break the chain", text: path.remediation }),
        // Learn more.
        h("button", { className: "btn btn-secondary btn-sm", style: { marginTop: 12 }, onClick: () => learnMore(path) },
          h(Icons.book, { size: 13 }), "Learn about this attack")));
  }

  function InfoRow({ icon, color, label, text }) {
    return h("div", { style: { display: "flex", gap: 9, marginTop: 8 } },
      h(icon, { size: 14, style: { color, flexShrink: 0, marginTop: 2 } }),
      h("div", { style: { fontSize: 12.5, lineHeight: 1.55 } },
        h("span", { style: { fontWeight: 650, color: "var(--text-1)" } }, label + ": "),
        h("span", { style: { color: "var(--text-2)" } }, text)));
  }
  window.AttackPathsTab = AttackPathsTab;

  // ============ AI-GEN ANALYSIS ============
  function AiGenTab({ meta }) {
    const API = window.AkiraAPI;
    const scanId = meta && meta.id;
    // Real AI-generation composition from GET /scans/{id}/ai-generation, derived
    // from this scan's findings. Falls back to the demo when there's no scan.
    const [state, setState] = useState({ loading: !!(scanId && API), data: null, real: false });
    useEffect(() => {
      if (!scanId || !API) { setState({ loading: false, data: window.VS_AIGEN, real: false }); return; }
      let alive = true;
      setState({ loading: true, data: null, real: false });
      API.scans.aigen(scanId)
        .then((d) => { if (alive) setState({ loading: false, data: d || window.VS_AIGEN, real: true }); })
        .catch(() => { if (alive) setState({ loading: false, data: window.VS_AIGEN, real: false }); });
      return () => { alive = false; };
    }, [scanId]);

    if (state.loading) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 10 } },
        h("div", { className: "spinner", style: { width: 18, height: 18 } }), "Scanning for AI-generation signals…");
    }
    const A = state.data || { percent: 0, delta: 1, patterns: [] };
    const real = state.real;

    // We deliberately do NOT show a "% AI-generated" composition number: reliable
    // AI-code detection doesn't exist (even the best research detectors are ~84%
    // in a lab and fail on clean, polished AI code), so any percentage would be
    // false precision. We instead surface the concrete, defensible signals we can
    // actually count — leftover stubs, copy-pasted validation, hardcoded values,
    // etc. — and let the reader judge.
    const patterns = (A.patterns && A.patterns.length) ? A.patterns : [];
    const totalSignals = patterns.reduce((s, p) => s + (p.count || 0), 0);

    // Risk comparison stays — it's a real finding-density ratio, not a detector.
    const d = typeof A.delta === "number" ? A.delta : 1;
    const riskCopy = Math.abs(d - 1) < 0.15
      ? h(React.Fragment, null, "Code carrying these signals has ", h("strong", { style: { color: "var(--sev-opt)" } }, "about the same risk"), " as the rest of this repo.")
      : d > 1
        ? h(React.Fragment, null, "Code carrying these signals is ", h("strong", { style: { color: "var(--sev-opt)" } }, d + "× more likely"), " to contain a high-severity finding than the rest of this repo.")
        : h(React.Fragment, null, "Code carrying these signals is ", h("strong", { style: { color: "var(--sev-opt)" } }, Math.round((1 - d) * 100) + "% less likely"), " to contain a high-severity finding than the rest of this repo.");
    return h("div", { style: { height: "100%", overflowY: "auto", padding: "20px 24px 60px" } },
      !real && h(DemoBanner, { what: "AI-generation analysis" }),
      h("div", { style: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, alignItems: "start" } },
        // LEFT: signal summary (no fabricated composition percentage)
        h("div", { className: "card", style: { padding: "24px 22px", textAlign: "center", position: "relative", overflow: "hidden" } },
          h("div", { style: { position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, var(--sev-opt) 0%, transparent 70%)", opacity: 0.18, pointerEvents: "none" } }),
          h("div", { style: { fontSize: 10.5, fontWeight: 650, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 } }, "AI-pattern signals"),
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 2px" } },
            h("div", { style: { fontSize: 52, fontWeight: 800, lineHeight: 1, color: "var(--sev-opt)", fontVariantNumeric: "tabular-nums" } }, totalSignals),
            h("div", { style: { fontSize: 12.5, color: "var(--text-3)", marginTop: 6 } }, totalSignals === 1 ? "signal detected" : "signals detected")),
          h("div", { style: { fontSize: 13.5, fontWeight: 600, marginTop: 16, lineHeight: 1.5 } },
            totalSignals === 0
              ? "No common AI-generation patterns detected"
              : "Patterns often left by code-generation tools"),
          h("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 6, lineHeight: 1.5 } },
            "These are heuristics, not a verdict — clean AI-written code may show none, and human code can trip them. Reliable AI-vs-human code detection isn't currently possible."),
          totalSignals > 0 && h("div", { style: { marginTop: 18, padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--sev-opt-bg)", border: "1px solid color-mix(in srgb, var(--sev-opt) 30%, transparent)", textAlign: "left", display: "flex", gap: 12 } },
            h(Icons.alert, { size: 18, style: { color: "var(--sev-opt)", flexShrink: 0, marginTop: 1 } }),
            h("div", { style: { fontSize: 12.5, lineHeight: 1.55, color: "var(--text-1)" } }, riskCopy))),
        // RIGHT: patterns
        h("div", { className: "card", style: { overflow: "hidden" } },
          h("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--border)" } },
            h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "AI-generation patterns detected"),
            h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 2 } }, "Signature patterns commonly associated with machine-generated code")),
          (A.patterns && A.patterns.length)
            ? A.patterns.map((p, i) =>
              h("div", { key: p.name, className: "stagger-in", style: { display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: i ? "1px solid var(--border)" : "none", transition: "background var(--dur-micro) ease" },
                onMouseEnter: (e) => { e.currentTarget.style.background = "var(--bg-hover)"; },
                onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; } },
                h("div", { style: { position: "relative", width: 38, height: 38, borderRadius: 10, background: "var(--sev-opt-bg)", color: "var(--sev-opt)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 750, fontVariantNumeric: "tabular-nums", border: "1px solid color-mix(in srgb, var(--sev-opt) 30%, transparent)" } }, p.count),
                h("div", { style: { flex: 1 } },
                  h("div", { style: { fontSize: 13, fontWeight: 600 } }, p.name),
                  h("div", { style: { fontSize: 12, color: "var(--text-2)", marginTop: 2 } }, p.desc))))
            : h("div", { style: { padding: "18px 20px", fontSize: 12.5, color: "var(--text-3)" } }, "No AI-generation signature patterns detected in this scan."))));
  }
  window.AiGenTab = AiGenTab;

  // Format a backend ISO timestamp into the timeline's "Mon D, YYYY · HH:MM".
  function fmtScanTime(iso) {
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      return date + " · " + time;
    } catch (e) { return iso || ""; }
  }

  // ============ HISTORY ============
  // Trimmed to two real sections: the security-score trend chart and the scan
  // history list. The diff (what's new/fixed/still-open) columns were removed —
  // the diff endpoint still exists, but this tab is now just trend + history.
  function HistoryTab({ meta }) {
    const API = window.AkiraAPI;
    const repo = meta && meta.repo;
    const curId = meta && meta.id;

    // Real scan history for this repo (most recent first).
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(!!(API && curId));
    useEffect(() => {
      if (!API || !curId) { setHistory(null); setLoading(false); return; }
      let alive = true;
      setLoading(true);
      API.scans.list({ limit: 50 })
        .then((res) => {
          if (!alive) return;
          const items = (res && res.items) || [];
          const mine = items.filter((s) => !repo || s.repo === repo || s.repository_id === (meta && meta.repository_id));
          setHistory(mine);
          setLoading(false);
        })
        .catch(() => { if (alive) { setHistory([]); setLoading(false); } });
      return () => { alive = false; };
    }, [curId, repo]);

    // Risk trend = security RISK (100 − score) across completed scans, oldest →
    // newest. Higher = worse, consistent with the rest of the app.
    const trend = (history || [])
      .filter((s) => s.security_score != null)
      .slice().reverse()
      .map((s) => ({ score: window.riskFromScore(s.security_score), when: s.created_at }));

    if (loading) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", gap: 10 } },
        h("div", { className: "spinner", style: { width: 18, height: 18 } }), "Loading scan history…");
    }

    return h("div", { style: { height: "100%", overflowY: "auto", padding: "18px 24px 60px" } },
      h(ScoreTrendChart, { points: trend }),
      h("div", { className: "card", style: { marginTop: 18, padding: "4px 0" } },
        h("div", { style: { padding: "14px 22px 8px", fontSize: 13, fontWeight: 650, borderBottom: "1px solid var(--border)", marginBottom: 4 } }, "Scan history"),
        (history || []).length === 0
          ? h("div", { style: { padding: "18px 22px", fontSize: 12.5, color: "var(--text-3)" } }, "No scans yet for this repository.")
          : history.map((s, i) => {
              const depth = (s.depth || "deep");
              const depthLabel = depth.charAt(0).toUpperCase() + depth.slice(1);
              const score = s.security_score != null ? (" · risk " + window.riskFromScore(s.security_score)) : "";
              const status = s.status && s.status !== "completed" ? (" · " + s.status) : "";
              const current = s.id === curId;
              return h("div", { key: s.id, style: { display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderTop: i ? "1px solid var(--border)" : "none" } },
                h("div", { style: { width: 9, height: 9, borderRadius: "50%", background: current ? "var(--accent)" : "var(--bg-active)", border: current ? "none" : "1.5px solid var(--border-strong)", flexShrink: 0 } }),
                h("span", { style: { fontSize: 12.5, fontWeight: 600, width: 170 } }, fmtScanTime(s.created_at)),
                h("span", { style: { fontSize: 12.5, color: "var(--text-2)" } }, depthLabel + " scan" + score + status),
                current && h("span", { className: "badge", style: { marginLeft: "auto", background: "var(--accent-soft)", color: "var(--accent)" } }, "Current"));
            })));
  }
  window.HistoryTab = HistoryTab;

  // Security-RISK trend: an SVG area+line chart with gridlines and value labels.
  // points[].score carries the RISK value (higher = worse). Needs >=2 scans.
  function ScoreTrendChart({ points }) {
    const W = 680, Hgt = 240, padL = 30, padR = 14, padT = 20, padB = 30;
    const card = (body) => h("div", { className: "card", style: { padding: "16px 20px" } },
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, "Security risk trend"),
      h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 12 } }, "Across this repo's scans (oldest → newest · higher = more risk)"),
      body);

    if (!points || points.length < 2) {
      return card(h("div", { style: { fontSize: 12.5, color: "var(--text-3)", padding: "8px 0" } },
        points && points.length === 1
          ? "Only one scored scan so far — the trend appears after the next scan."
          : "No scored scans yet to chart."));
    }

    const n = points.length;
    const plotW = W - padL - padR, plotH = Hgt - padT - padB;
    const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = (v) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;
    const linePts = points.map((p, i) => x(i) + "," + y(p.score));
    const areaPts = padL + "," + (padT + plotH) + " " + linePts.join(" ") + " " + (padL + plotW) + "," + (padT + plotH);
    const accent = "var(--accent)";

    return card(h("svg", { viewBox: "0 0 " + W + " " + Hgt, width: "100%", height: Hgt, preserveAspectRatio: "none", style: { display: "block", overflow: "visible" } },
      // horizontal gridlines at 0/25/50/75/100
      [0, 25, 50, 75, 100].map((g) =>
        h("g", { key: g },
          h("line", { x1: padL, x2: padL + plotW, y1: y(g), y2: y(g), stroke: "var(--border)", strokeWidth: 1, strokeDasharray: g === 0 ? "0" : "3 3" }),
          h("text", { x: padL - 6, y: y(g) + 3, textAnchor: "end", fontSize: 9, fill: "var(--text-3)" }, g))),
      // area fill under the line
      h("polygon", { points: areaPts, fill: accent, opacity: 0.12 }),
      // the trend line
      h("polyline", { points: linePts.join(" "), fill: "none", stroke: accent, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      // points + value labels
      points.map((p, i) =>
        h("g", { key: i },
          h("circle", { cx: x(i), cy: y(p.score), r: 3.5, fill: window.riskColor ? window.riskColor(p.score) : accent, stroke: "var(--bg-surface)", strokeWidth: 1.5 }),
          h("text", { x: x(i), y: y(p.score) - 8, textAnchor: "middle", fontSize: 10, fontWeight: 600, fill: "var(--text-1)" }, p.score)))));
  }
  window.ScoreTrendChart = ScoreTrendChart;
})();
