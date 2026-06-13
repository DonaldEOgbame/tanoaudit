// VaultScan — Report tabs: Heatmap, Dependencies, AI-Gen, History
(function () {
  const React = window.React;
  const { useState, useEffect, useMemo } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, SevDot, Tag, Donut, CountUp, scoreColor } = window;

  const FILES = window.VS_REPO_FILES;
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
  function HeatmapTab({ onFileClick, findings }) {
    const ALL = findings || window.VS_FINDINGS || [];
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
    // build folder tree
    const tree = useMemo(() => {
      const root = { name: "ecommerce-api", children: {}, files: [] };
      FILES.forEach((f) => {
        const parts = f.path.split("/");
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!node.children[parts[i]]) node.children[parts[i]] = { name: parts[i], children: {}, files: [] };
          node = node.children[parts[i]];
        }
        node.files.push(f);
      });
      return root;
    }, []);

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

  // ============ DEPENDENCIES ============
  function DepsTab() {
    const deps = window.VS_DEPS;
    const DASH = "—";
    const statusStyle = {
      Vulnerable: { bg: "var(--sev-critical-bg)", color: "var(--sev-critical)" },
      Outdated: { bg: "var(--sev-high-bg)", color: "var(--sev-high)" },
      Clean: { bg: "var(--sev-clean-bg)", color: "var(--sev-clean)" },
    };
    const vCount = deps.filter((d) => d.status === "Vulnerable").length;
    const oCount = deps.filter((d) => d.status === "Outdated").length;
    const cCount = deps.filter((d) => d.status === "Clean").length;
    return h("div", { style: { height: "100%", overflowY: "auto", padding: "20px 24px 60px" } },
      h(DemoBanner, { what: "Dependency analysis" }),
      h("div", { className: "card", style: { overflow: "hidden" } },
        h("div", { style: { padding: "14px 20px", borderBottom: "1px solid var(--border)" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Package inventory"),
          h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 2 } }, deps.length + " runtime + dev dependencies analyzed")),
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
                  ? h("a", { href: "#", onClick: (e) => e.preventDefault(), className: "mono", style: { fontSize: 12, color: "var(--sev-low)", textDecoration: "none" } }, d.cve)
                  : h("span", { style: { color: "var(--text-3)", fontSize: 12 } }, d.note)),
              h("td", { className: "mono", style: { padding: "11px 20px", fontSize: 12, color: d.suggested === DASH ? "var(--text-3)" : "var(--sev-clean)", fontWeight: d.suggested === DASH ? 400 : 600 } }, d.suggested));
          })))));
  }
  window.DepsTab = DepsTab;

  // ============ AI-GEN ANALYSIS ============
  function AiGenTab() {
    const A = window.VS_AIGEN;
    return h("div", { style: { height: "100%", overflowY: "auto", padding: "20px 24px 60px" } },
      h(DemoBanner, { what: "AI-generation analysis" }),
      h("div", { style: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, alignItems: "start" } },
        // LEFT: ring + headline
        h("div", { className: "card", style: { padding: "24px 22px", textAlign: "center", position: "relative", overflow: "hidden" } },
          h("div", { style: { position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, var(--sev-opt) 0%, transparent 70%)", opacity: 0.18, pointerEvents: "none" } }),
          h("div", { style: { fontSize: 10.5, fontWeight: 650, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 } }, "AI Composition"),
          h("div", { style: { display: "flex", justifyContent: "center", padding: "10px 0 4px" } },
            h(window.RingStat, {
              segments: [{ value: A.percent, color: "var(--sev-opt)" }],
              size: 180, stroke: 14, centerBig: A.percent + "%", centerSmall: "AI-generated",
              total: 100,
            })),
          h("div", { style: { fontSize: 13.5, fontWeight: 600, marginTop: 14, lineHeight: 1.5 } }, "of this codebase appears AI-generated"),
          h("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 4 } }, "Detected via stylistic & structural heuristics across 318 segments"),
          h("div", { style: { marginTop: 18, padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--sev-opt-bg)", border: "1px solid color-mix(in srgb, var(--sev-opt) 30%, transparent)", textAlign: "left", display: "flex", gap: 12 } },
            h(Icons.alert, { size: 18, style: { color: "var(--sev-opt)", flexShrink: 0, marginTop: 1 } }),
            h("div", { style: { fontSize: 12.5, lineHeight: 1.55, color: "var(--text-1)" } },
              "AI-generated sections are ", h("strong", { style: { color: "var(--sev-opt)" } }, A.delta + "× more likely"), " to contain a security finding than human-written sections in this repo."))),
        // RIGHT: patterns
        h("div", { className: "card", style: { overflow: "hidden" } },
          h("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--border)" } },
            h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "AI-generation patterns detected"),
            h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 2 } }, "Signature patterns that typically indicate machine-generated code")),
          A.patterns.map((p, i) =>
            h("div", { key: p.name, className: "stagger-in", style: { display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: i ? "1px solid var(--border)" : "none", transition: "background var(--dur-micro) ease" },
              onMouseEnter: (e) => { e.currentTarget.style.background = "var(--bg-hover)"; },
              onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; } },
              h("div", { style: { position: "relative", width: 38, height: 38, borderRadius: 10, background: "var(--sev-opt-bg)", color: "var(--sev-opt)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 750, fontVariantNumeric: "tabular-nums", border: "1px solid color-mix(in srgb, var(--sev-opt) 30%, transparent)" } }, p.count),
              h("div", { style: { flex: 1 } },
                h("div", { style: { fontSize: 13, fontWeight: 600 } }, p.name),
                h("div", { style: { fontSize: 12, color: "var(--text-2)", marginTop: 2 } }, p.desc)))))));
  }
  window.AiGenTab = AiGenTab;

  // ============ HISTORY ============
  function HistoryTab({ justScanned, meta }) {
    const H = window.VS_HISTORY;
    const cols = [
      { id: "new", label: "What's new", items: H.diffNew, color: "var(--sev-critical)", icon: "arrowUp" },
      { id: "fixed", label: "What's fixed", items: H.diffFixed, color: "var(--sev-clean)", icon: "check" },
      { id: "open", label: "Still open", items: H.diffOpen, color: "var(--sev-high)", icon: "clock" },
    ];
    const trend = H.trend;

    return h("div", { style: { height: "100%", overflowY: "auto", padding: "18px 24px 60px" } },
      h(DemoBanner, { what: "Scan history & diff" }),
      justScanned && h("div", { className: "card", style: { padding: "11px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, background: "var(--accent-soft)", border: "1px solid var(--accent)" } },
        h(Icons.sparkle, { size: 16, style: { color: "var(--accent)" } }),
        h("span", { style: { fontSize: 13 } }, h("strong", null, "Scan complete."), " Here's what changed since your last scan of this repo.")),




      // timeline
      h("div", { className: "card", style: { marginTop: 18, padding: "4px 0", position: "relative" } },
        h("div", { style: { padding: "14px 22px 8px", fontSize: 13, fontWeight: 650, borderBottom: "1px solid var(--border)", marginBottom: 4 } }, "Scan history"),
        [["Jun 10, 2026 · 09:14", "Deep scan · 43 findings · score 38", true],
         ["Jun 2, 2026 · 14:02", "Deep scan · 42 findings · score 33", false],
         ["May 19, 2026 · 11:30", "Fast scan · 38 findings · score 35", false],
         ["May 5, 2026 · 16:44", "Deep scan · 41 findings · score 31", false],
         ["Apr 21, 2026 · 10:12", "Thorough scan · 45 findings · score 28", false],
         ["Apr 7, 2026 · 09:01", "First scan · 47 findings · score 22", false]].map(([when, desc, current], i) =>
          h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderTop: i ? "1px solid var(--border)" : "none" } },
            h("div", { style: { width: 9, height: 9, borderRadius: "50%", background: current ? "var(--accent)" : "var(--bg-active)", border: current ? "none" : "1.5px solid var(--border-strong)", flexShrink: 0 } }),
            h("span", { style: { fontSize: 12.5, fontWeight: 600, width: 170 } }, when),
            h("span", { style: { fontSize: 12.5, color: "var(--text-2)" } }, desc),
            current && h("span", { className: "badge", style: { background: "var(--accent-soft)", color: "var(--accent)" } }, "Current")))));
  }
  window.HistoryTab = HistoryTab;
})();
