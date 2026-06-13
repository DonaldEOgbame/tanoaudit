// VaultScan — Scan Report: top bar, exec summary, findings/optimizations tabs with diff panel
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useMemo } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { CountUp, ScoreGauge, SevBadge, SevDot, Tag, CodeBlock, Tabs, Avatar, scoreColor, Switch } = window;

  const META = window.VS_REPO_META;
  const ALL = window.VS_FINDINGS;
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4, opt: 5 };

  function ScanReport({ nav, toast, justScanned }) {
    const [tab, setTab] = useState("overview");
    const [selFile, setSelFile] = useState("src/routes/products.js");
    const [suppressed, setSuppressed] = useState({});
    const [shareOpen, setShareOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [handoffOpen, setHandoffOpen] = useState(false);
    const [watched, setWatched] = useState(false);

    const counts = useMemo(() => {
      const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0, opt: 0, stub: 0 };
      ALL.forEach((f) => {
        if (suppressed[f.id]) return;
        if (f.type === "stub") c.stub++;
        else if (f.sev === "opt") c.opt++;
        else c[f.sev]++;
      });
      return c;
    }, [suppressed]);
    const totalSec = counts.critical + counts.high + counts.medium + counts.low + counts.info;

    const tabs = [
      { id: "overview", label: "Overview" },
      { id: "findings", label: "Vulnerabilities", count: totalSec },
      { id: "optimizations", label: "Optimizations", count: counts.opt },
      { id: "stubs", label: "Stubs", count: counts.stub },
      { id: "dependencies", label: "Dependencies" },
      { id: "aigen", label: "AI-Gen Analysis" },
      { id: "history", label: "History" },
    ];

    return h("div", { className: "vs-page-enter", style: { height: "100%", display: "flex", flexDirection: "column" }, "data-screen-label": "Scan Report" },
      // ===== Top bar =====
      h("div", { style: { padding: "18px 24px 0", flexShrink: 0 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" } },
          h("div", { style: { flex: 1, minWidth: 260 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
              h(Icons.github, { size: 18, style: { color: "var(--text-2)" } }),
              h("h1", { style: { fontSize: 19, fontWeight: 700, letterSpacing: "-0.015em" } }, META.repo),
              h(Tag, null, META.branch + " @ " + META.commit)),
            h("div", { style: { fontSize: 12.5, color: "var(--text-3)", marginTop: 5, display: "flex", gap: 14, flexWrap: "wrap" } },
              h("span", null, META.files + " files"), h("span", null, META.segments + " segments"),
              h("span", null, META.duration), h("span", null, "3 models"))),
          // Actions
          h("div", { style: { display: "flex", gap: 8, position: "relative" } },
            h("button", { className: "btn btn-sm" + (watched ? " btn-primary" : " btn-secondary"),
              title: watched ? "Watching this repo — monitored for new findings" : "Watch this repo for new findings",
              onClick: () => { setWatched((v) => !v); toast({ kind: watched ? "info" : "success", msg: watched ? "Removed " + META.repo + " from watchlist" : "Watching " + META.repo + " · re-scan frequency: Manual (change it on the Watchlist)" }); } },
              h(Icons[watched ? "eye" : "eyeOff"], { size: 14 }), watched ? "Watching" : "Watch"),
            h("button", { className: "btn btn-secondary btn-sm", onClick: () => { toast({ kind: "info", msg: "Re-scan queued for " + META.repo }); } }, h(Icons.refresh, { size: 14 }), "Re-scan"),
            h("div", { style: { position: "relative" } },
              h("button", { className: "btn btn-secondary btn-sm", onClick: () => { setExportOpen((v) => !v); setShareOpen(false); } }, h(Icons.download, { size: 14 }), "Export", h(Icons.chevD, { size: 12 })),
              exportOpen && h("div", { className: "popover", style: { top: "calc(100% + 6px)", right: 0, minWidth: 160 } },
                ["PDF report", "JSON (full)", "CSV (findings)"].map((x) =>
                  h("button", { key: x, className: "menu-item", onClick: () => { setExportOpen(false); toast({ kind: "success", msg: x + " export started" }); } }, h(Icons.file, { size: 14, style: { color: "var(--text-3)" } }), x)))),
            h("div", { style: { position: "relative" } },
              h("button", { className: "btn btn-secondary btn-sm", onClick: () => { setShareOpen((v) => !v); setExportOpen(false); } }, h(Icons.share, { size: 14 }), "Share"),
              shareOpen && h(SharePopover, { toast, onClose: () => setShareOpen(false) })),
            h("button", { className: "btn btn-primary btn-sm", onClick: () => setHandoffOpen(true) }, h(Icons.terminal, { size: 14 }), "Hand off to Claude Code"))),

        handoffOpen && h(HandoffModal, { onClose: () => setHandoffOpen(false), toast, counts }),

        // ===== Tabs (no summary/strip here anymore) =====
        h("div", { style: { marginTop: 16 } }, h(Tabs, { tabs, active: tab, onChange: setTab }))),

      // ===== Tab content =====
      h("div", { style: { flex: 1, minHeight: 0, overflow: "hidden" } },
        tab === "overview" && h(OverviewTab, { setTab }),
        (tab === "findings" || tab === "optimizations" || tab === "stubs") && h(window.FindingsTab, { key: tab, mode: tab, selFile, setSelFile, suppressed, setSuppressed, toast, nav }),
        tab === "dependencies" && h(window.DepsTab, null),
        tab === "aigen" && h(window.AiGenTab, null),
        tab === "history" && h(window.HistoryTab, { justScanned })),
    );
  }
  window.ScanReport = ScanReport;

  // ===== Overview tab =====
  function OverviewTab({ setTab }) {
    return h("div", { style: { height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" } },
      h(window.ReportChat, { setTab }));
  }

  function SharePopover({ toast, onClose }) {
    const [copied, setCopied] = useState(false);
    const link = "https://akira.ai/r/8fk2-demo";
    return h("div", { className: "popover", style: { top: "calc(100% + 6px)", right: 0, width: 300, padding: 14 } },
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, "Share read-only report"),
      h("p", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 10 } }, "Anyone with the link can view this report. Code snippets are included."),
      h("div", { style: { display: "flex", gap: 6 } },
        h("input", { className: "field mono", readOnly: true, value: link, style: { fontSize: 11.5 } }),
        h("button", { className: "btn btn-primary btn-sm", style: { flexShrink: 0 }, onClick: () => { setCopied(true); toast({ kind: "success", msg: "Link copied to clipboard" }); setTimeout(() => setCopied(false), 1500); } },
          copied ? h(Icons.check, { size: 14 }) : h(Icons.copy, { size: 14 }))),
      h("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 10, color: "var(--sev-critical)" }, onClick: () => { toast({ kind: "info", msg: "Share link revoked" }); onClose(); } }, "Revoke link"));
  }

  // ===== Hand off to Claude Code (MCP handoff) =====
  function HandoffModal({ onClose, toast, counts }) {
    const { Modal } = window;
    const [scope, setScope] = useState("critical_high");
    const [phase, setPhase] = useState("config"); // config | generated
    const [copied, setCopied] = useState("");
    const base = (window.VS_API_BASE || "http://localhost:8000");
    const auditId = META.id || "scan-1";
    // Mock token — the real one comes from POST /audits/{id}/handoff/generate (once).
    const token = "h0_" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 10);
    const url = base + "/handoff/" + auditId + "?token=" + token;
    const mcpAdd = "claude mcp add --transport http akira " + base + "/mcp";

    const sec = counts.critical + counts.high + counts.medium + counts.low + counts.info;
    const stub = counts.stub || 0;
    const scopes = [
      ["all", "Everything", (sec + counts.opt + stub) + " findings (vulnerabilities + optimizations + stubs)"],
      ["critical_high", "Critical + High", (counts.critical + counts.high) + " highest-priority vulnerabilities"],
      ["security", "Vulnerabilities only", sec + " vulnerabilities"],
      ["optimizations", "Optimizations only", counts.opt + " optimization findings"],
      ["stubs", "Stubs & Placeholders only", stub + " stubs / placeholders"],
    ];
    const count = { all: sec + counts.opt + stub, critical_high: counts.critical + counts.high, security: sec, optimizations: counts.opt, stubs: stub }[scope];

    function copy(what, text) {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      setCopied(what); toast({ kind: "success", msg: "Copied" }); setTimeout(() => setCopied(""), 1400);
    }
    const copyBtn = (what, text) => h("button", { className: "btn btn-primary btn-sm", style: { flexShrink: 0 }, onClick: () => copy(what, text) }, copied === what ? h(Icons.check, { size: 14 }) : h(Icons.copy, { size: 14 }));
    const codeRow = (what, text) => h("div", { style: { display: "flex", gap: 6, alignItems: "stretch" } },
      h("input", { className: "field mono", readOnly: true, value: text, style: { fontSize: 11.5 } }), copyBtn(what, text));

    const step = (n, title, body) => h("div", { style: { display: "flex", gap: 11, marginBottom: 14 } },
      h("div", { style: { width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 } }, n),
      h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, title), body));

    return h(Modal, { onClose, width: 600 },
      h("div", { style: { padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 9 } },
          h("span", { style: { display: "flex", color: "var(--accent)" } }, h(Icons.terminal, { size: 18 })),
          h("h3", { style: { fontSize: 15, fontWeight: 650 } }, phase === "config" ? "Hand off to Claude Code" : "Ready for Claude Code")),
        h("button", { className: "icon-btn", onClick: onClose }, h(Icons.x, { size: 16 }))),

      h("div", { style: { padding: 22, maxHeight: "70vh", overflowY: "auto" } },
        phase === "config" && h("div", null,
          h("p", { style: { fontSize: 13, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.5 } },
            "Generate a single-use link Claude Code can fetch over MCP to pull these findings — with locations, explanations, and suggested fixes — then fix them and mark each one done."),
          h("label", { className: "flabel" }, "What to include"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 } },
            scopes.map(([id, label, desc]) =>
              h("button", { key: id, onClick: () => setScope(id), className: "sel-card", style: { padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, textAlign: "left", borderWidth: 1.5, borderColor: scope === id ? "var(--accent)" : "var(--border)", background: scope === id ? "var(--accent-soft)" : "var(--bg-surface)" } },
                h("div", { style: { flex: 1 } },
                  h("div", { style: { fontSize: 13, fontWeight: 600 } }, label),
                  h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, desc)),
                scope === id && h(Icons.check, { size: 16, style: { color: "var(--accent)" } })))),
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-3)", marginBottom: 4 } },
            h(Icons.clock, { size: 13 }), "Link expires in 24 hours · single-use · revocable anytime")),

        phase === "generated" && h("div", null,
          h("div", { style: { padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--sev-clean-bg)", border: "1px solid color-mix(in srgb, var(--sev-clean) 30%, transparent)", display: "flex", alignItems: "center", gap: 9, marginBottom: 18, fontSize: 12.5 } },
            h(Icons.check, { size: 15, style: { color: "var(--sev-clean)" } }),
            h("span", null, h("strong", null, count + " findings"), " packaged. Copy the link — it's shown once.")),

          h("label", { className: "flabel" }, "Handoff link (single-use)"),
          h("div", { style: { marginBottom: 18 } }, codeRow("url", url)),

          h("div", { style: { fontSize: 13, fontWeight: 650, margin: "4px 0 12px" } }, "Set up in Claude Code"),
          step("1", "Add the Akira MCP server (one time)",
            h("div", null,
              h("p", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 6 } }, "In your terminal, register Akira as an MCP server:"),
              codeRow("mcp", mcpAdd))),
          step("2", "Point Claude Code at the audit",
            h("div", null,
              h("p", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 6 } }, "In a Claude Code session, paste:"),
              codeRow("prompt", "Fetch the Akira audit from " + url + " and fix the findings."))),
          step("3", "Claude fixes & reports back",
            h("p", { style: { fontSize: 12, color: "var(--text-2)" } }, "Claude calls ", h("code", { className: "mono", style: { fontSize: 11 } }, "fetch_audit_handoff"), " to read the findings, applies fixes, then calls ", h("code", { className: "mono", style: { fontSize: 11 } }, "mark_finding_fixed"), " — each one flips to ", h("span", { style: { color: "var(--sev-clean)", fontWeight: 600 } }, "Fixed via Claude Code"), " here in real time.")),
          h("p", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 4 } }, "Manage or revoke this link anytime from Settings → Handoff links.")),

      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 } },
        phase === "config"
          ? h(React.Fragment, null,
              h("button", { className: "btn btn-ghost", onClick: onClose }, "Cancel"),
              h("button", { className: "btn btn-primary", onClick: () => { setPhase("generated"); toast({ kind: "success", msg: "Handoff link generated" }); } }, h(Icons.terminal, { size: 15 }), "Generate handoff"))
          : h("button", { className: "btn btn-primary", onClick: onClose }, "Done"))));
  }

  // ================= FILE TREE =================
  function FileTree({ files, filter, effFile, setSelFile, isOpt }) {
    const tree = useMemo(() => {
      const root = { name: "ecommerce-api", children: {}, files: [] };
      files.forEach(([filePath, info]) => {
        const parts = filePath.split("/");
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i];
          if (!node.children[p]) node.children[p] = { name: p, children: {}, files: [] };
          node = node.children[p];
        }
        node.files.push([filePath, info]);
      });
      return root;
    }, [files]);

    const [collapsed, setCollapsed] = useState({});
    const toggle = (key) => setCollapsed((c) => Object.assign({}, c, { [key]: !c[key] }));

    function worstOfNode(node) {
      let worst = "opt";
      node.files.forEach(([, info]) => { if (SEV_ORDER[info.worst] < SEV_ORDER[worst]) worst = info.worst; });
      Object.values(node.children).forEach((child) => { const w = worstOfNode(child); if (SEV_ORDER[w] < SEV_ORDER[worst]) worst = w; });
      return worst;
    }

    function nodeVisible(node) {
      if (node.files.some(([, info]) => filter === "all" || (filter === "security" ? info.sec > 0 : info.opt > 0))) return true;
      return Object.values(node.children).some(nodeVisible);
    }

    function matchFiles(fileList) {
      return fileList
        .filter(([, info]) => filter === "all" || (filter === "security" ? info.sec > 0 : info.opt > 0))
        .sort(([, a], [, b]) => SEV_ORDER[a.worst] - SEV_ORDER[b.worst]);
    }

    function renderDir(node, nodeKey, depth) {
      if (!nodeVisible(node)) return null;
      const isOpen = !collapsed[nodeKey];
      const worst = worstOfNode(node);
      const indent = 8 + depth * 14;
      const childDirs = Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b));
      const visFiles = matchFiles(node.files);
      return h("div", { key: nodeKey },
        h("button", {
          onClick: () => toggle(nodeKey),
          style: { display: "flex", alignItems: "center", gap: 5, width: "100%", padding: "4px 8px 4px " + indent + "px", borderRadius: 5, background: "transparent", transition: "background var(--dur-micro) ease" },
          onMouseEnter: (e) => { e.currentTarget.style.background = "var(--bg-hover)"; },
          onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; },
        },
          h(Icons.chevD, { size: 11, style: { transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform 120ms ease", color: "var(--text-3)", flexShrink: 0 } }),
          h(Icons.folder, { size: 13, style: { color: (window.SEV[worst] || window.SEV.info).color, flexShrink: 0 } }),
          h("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--text-2)", fontFamily: "var(--font-mono)" } }, node.name + "/"),
        ),
        isOpen && h("div", null,
          childDirs.map(([name, child]) => renderDir(child, nodeKey + "/" + name, depth + 1)),
          visFiles.map(([path, info]) =>
            h("button", {
              key: path, onClick: () => setSelFile(path),
              className: "sb-item" + (path === effFile ? " active" : ""),
              style: { paddingLeft: indent + 18 },
            },
              h(SevDot, { sev: info.worst, size: 7 }),
              h("span", { className: "sbi-label mono", style: { fontSize: 11.5, flex: 1 } }, path.split("/").pop()),
              info.sec > 0 && !isOpt && h("span", { style: { fontSize: 10.5, fontVariantNumeric: "tabular-nums", color: "var(--text-3)" } }, info.sec),
              info.opt > 0 && h("span", { style: { fontSize: 10.5, fontVariantNumeric: "tabular-nums", color: "var(--sev-opt)" } }, info.opt),
            )
          ),
        ),
      );
    }

    const rootDirs = Object.entries(tree.children).sort(([a], [b]) => a.localeCompare(b));
    const rootFiles = matchFiles(tree.files);
    return h("div", null,
      rootDirs.map(([name, child]) => renderDir(child, name, 1)),
      rootFiles.map(([path, info]) =>
        h("button", {
          key: path, onClick: () => setSelFile(path),
          className: "sb-item" + (path === effFile ? " active" : ""),
          style: { paddingLeft: 22 },
        },
          h(SevDot, { sev: info.worst, size: 7 }),
          h("span", { className: "sbi-label mono", style: { fontSize: 11.5, flex: 1 } }, path),
          info.sec > 0 && !isOpt && h("span", { style: { fontSize: 10.5, fontVariantNumeric: "tabular-nums", color: "var(--text-3)" } }, info.sec),
          info.opt > 0 && h("span", { style: { fontSize: 10.5, fontVariantNumeric: "tabular-nums", color: "var(--sev-opt)" } }, info.opt),
        )
      ),
    );
  }

  // ================= FINDINGS TAB =================
  function FindingsTab({ mode, selFile, setSelFile, suppressed, setSuppressed, toast, nav }) {
    const isOpt = mode === "optimizations";
    const isStub = mode === "stubs";
    const noun = isStub ? { one: "stub", many: "stubs" }
      : isOpt ? { one: "optimization", many: "optimizations" }
      : { one: "vulnerability", many: "vulnerabilities" };
    const [filter, setFilter] = useState("all");
    const [selIdx, setSelIdx] = useState(0);
    const panelRef = useRef();

    const findings = useMemo(() => ALL.filter((f) =>
      isStub ? f.type === "stub" : isOpt ? f.type === "opt" : (f.type !== "opt" && f.type !== "stub")
    ), [isOpt, isStub]);
    const files = useMemo(() => {
      const map = {};
      findings.forEach((f) => {
        if (!map[f.file]) map[f.file] = { sec: 0, opt: 0, worst: "info", items: [] };
        map[f.file][f.type === "opt" ? "opt" : "sec"]++;
        map[f.file].items.push(f);
        if (SEV_ORDER[f.sev] < SEV_ORDER[map[f.file].worst]) map[f.file].worst = f.sev;
      });
      return Object.entries(map).sort((a, b) => SEV_ORDER[a[1].worst] - SEV_ORDER[b[1].worst]);
    }, [findings]);

    const effFile = files.find(([p]) => p === selFile) ? selFile : (files[0] && files[0][0]);
    const fileFindings = useMemo(() =>
      findings.filter((f) => f.file === effFile && !suppressed[f.id]).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]),
      [findings, effFile, suppressed]);

    // J/K keyboard nav
    useEffect(() => {
      function onKey(e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (e.key === "j" || e.key === "J") setSelIdx((i) => Math.min(i + 1, fileFindings.length - 1));
        else if (e.key === "k" || e.key === "K") setSelIdx((i) => Math.max(i - 1, 0));
        else if ((e.key === "f" || e.key === "F") && fileFindings[selIdx]) {
          const f = fileFindings[selIdx];
          setSuppressed((s) => Object.assign({}, s, { [f.id]: true }));
          toast({ kind: "info", msg: "Marked as false positive: " + f.name });
        }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [fileFindings, selIdx]);

    useEffect(() => {
      if (panelRef.current) {
        const el = panelRef.current.querySelector('[data-fidx="' + selIdx + '"]');
        if (el) {
          const c = panelRef.current;
          const top = el.offsetTop - 12;
          c.scrollTo({ top, behavior: "smooth" });
        }
      }
    }, [selIdx]);
    useEffect(() => { setSelIdx(0); }, [effFile]);

    return h("div", { style: { display: "grid", gridTemplateColumns: "270px 1fr", height: "100%", overflow: "hidden" } },
      // LEFT file tree
      h("div", { style: { borderRight: "1px solid var(--border)", overflowY: "auto", padding: "14px 10px", background: "var(--bg-sidebar)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 5, padding: "2px 8px 8px", fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontWeight: 600 } },
          h(Icons.folder, { size: 12, style: { color: "var(--text-3)" } }),
          "ecommerce-api/"),
        h(FileTree, { files, filter: "all", effFile, setSelFile, isOpt }),
        h("div", { style: { padding: "12px 10px 4px", fontSize: 11, color: "var(--text-3)", lineHeight: 1.6, borderTop: "1px solid var(--border)", marginTop: 10 } },
          h("kbd", { className: "mono", style: { background: "var(--bg-active)", padding: "1px 5px", borderRadius: 4 } }, "J"), "/",
          h("kbd", { className: "mono", style: { background: "var(--bg-active)", padding: "1px 5px", borderRadius: 4 } }, "K"), " navigate · ",
          h("kbd", { className: "mono", style: { background: "var(--bg-active)", padding: "1px 5px", borderRadius: 4 } }, "F"), " false positive")),

      // RIGHT diff panel
      h("div", { ref: panelRef, key: effFile, className: "fade-slide-enter", style: { overflowY: "auto", padding: "16px 20px 60px" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } },
          h(Icons.file, { size: 16, style: { color: "var(--text-2)" } }),
          h("span", { className: "mono", style: { fontSize: 13.5, fontWeight: 600 } }, effFile),
          h("span", { style: { fontSize: 12, color: "var(--text-3)" } }, fileFindings.length + " " + (fileFindings.length === 1 ? noun.one : noun.many))),
        fileFindings.length === 0 && h("div", { className: "empty-state" },
          h("div", { className: "es-icon" }, h(Icons.shieldCheck, { size: 24 })),
          h("h3", null, "Nothing here"), h("p", null, "All " + (isStub ? "stubs" : isOpt ? "optimizations" : "vulnerabilities") + " in this file are suppressed or resolved.")),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 16 } },
          fileFindings.map((f, i) => h(window.FindingCard, { key: f.id, f, idx: i, selected: i === selIdx, onSelect: () => setSelIdx(i),
            onSuppress: () => { setSuppressed((s) => Object.assign({}, s, { [f.id]: true })); toast({ kind: "info", msg: "Suppressed — moved to false-positive list" }); },
            toast, nav })))),
    );
  }
  window.FindingsTab = FindingsTab;
})();
