// VaultScan — Scan Report: top bar, exec summary, findings/optimizations tabs with diff panel
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useMemo } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { CountUp, ScoreGauge, SevBadge, SevDot, Tag, CodeBlock, Tabs, Avatar, scoreColor, Switch } = window;

  const API = window.TanoAuditAPI;
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4, opt: 5 };

  function getDiffHighlights(codeA, codeB) {
    if (!codeA) return { vuln: [], added: [] };
    const linesA = codeA.split("\n").map(l => l.trim());
    const linesB = (codeB || "").split("\n").map(l => l.trim());
    const N = linesA.length;
    const M = linesB.length;

    const dp = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));

    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= M; j++) {
        if (linesA[i - 1] === linesB[j - 1] && linesA[i - 1] !== "") {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const vuln = [];
    const added = [];

    let i = N, j = M;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1] && linesA[i - 1] !== "") {
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        added.push(j - 1);
        j--;
      } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
        vuln.push(i - 1);
        i--;
      }
    }

    return {
      vuln: vuln.reverse(),
      added: added.reverse()
    };
  }

  // Map a backend FindingOut into the shape this report UI renders (the old demo
  // shape). engine security|optimization|stub -> type; severity -> sev (opt rows
  // use sev "opt"). Exposed so report-tabs.jsx / chat.jsx reuse it.
  function normalizeFinding(f) {
    const type = f.engine === "optimization" ? "opt" : f.engine === "stub" ? "stub" : "vuln";
    const sev = type === "opt" ? "opt" : (f.severity || "info").toLowerCase();
    const hl = getDiffHighlights(f.code_snippet, f.fix_snippet);
    return {
      id: f.id,
      publicId: f.public_id || "",
      type,
      sev,
      name: f.subcategory || f.category || (f.stub_category) || "Finding",
      category: f.category || "",
      file: f.file,
      start: f.line_start,
      lines: (f.line_start && f.line_end) ? (f.line_end - f.line_start + 1) : 1,
      code: f.code_snippet || "",
      summary: f.explanation || "",
      fixSummary: f.fix_summary || "",
      fixCode: f.fix_snippet || "",
      impact: f.impact || f.risk_if_shipped || "",
      risk: f.risk_if_shipped || "",
      cwe: f.cwe_id || "",
      owasp: f.owasp_ref || "",
      confidence: f.confidence || "",
      model: f.model_attribution || "",
      verified: !!f.verified_by,
      stubCategory: f.stub_category || "",
      effort: "",
      added: hl.added,
      vuln: hl.vuln,
      current: f.code_snippet || "",
      status: f.status,
      _raw: f,
    };
  }
  window.normalizeFinding = normalizeFinding;

  // Build the META object (repo header + scores) from a backend ScanOut.
  function metaFromScan(s) {
    let summaryText = s.executive_summary || "";
    if (summaryText.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(summaryText);
        if (parsed && parsed.summary) {
          summaryText = parsed.summary;
        }
      } catch (e) {}
    }
    return {
      id: s.id,
      repo: s.repo || s.source_url || "scan",
      repository_id: s.repository_id || null,
      branch: s.branch || "default",
      commit: (s.commit || "").slice(0, 7) || "—",
      files: s.files || 0,
      segments: s.segment_total || 0,
      duration: "",
      score: s.security_score != null ? s.security_score : 0,
      optScore: s.optimization_score != null ? s.optimization_score : 0,
      stubScore: s.completeness_score != null ? s.completeness_score : 0,
      worst: s.worst_severity || "info",
      summary: summaryText,
      status: s.status,
    };
  }
  window.metaFromScan = metaFromScan;

  // Mark a finding as a false positive: optimistic suppress + persist to the
  // backend when it's a real finding (has _raw); demo findings just suppress.
  function markFalsePositive(f, setSuppressed, toast) {
    setSuppressed((s) => Object.assign({}, s, { [f.id]: true }));
    toast({ kind: "info", msg: "Marked as false positive: " + f.name });
    if (f._raw && f._raw.id && API) {
      API.findings.markFalsePositive(f._raw.id, "Marked from report").catch((e) => {
        // Revert on failure.
        setSuppressed((s) => { const n = Object.assign({}, s); delete n[f.id]; return n; });
        toast({ kind: "error", msg: "Couldn't mark false positive: " + ((e && e.message) || "error") });
      });
    }
  }

  function ScanReport({ nav, toast, justScanned, scanId, repo, onLoadRepo }) {
    const [tab, setTab] = useState("overview");
    const [selFile, setSelFile] = useState(null);
    const [suppressed, setSuppressed] = useState({});
    const [shareOpen, setShareOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [handoffOpen, setHandoffOpen] = useState(false);
    const [watched, setWatched] = useState(false);

    // Load the real scan + findings + attack paths. Falls back to demo globals
    // when no scanId (e.g. the dashboard "view sample" path).
    const [state, setState] = useState({ loading: !!scanId, error: null, meta: null, findings: null, attackPaths: null });
    const [attackPathCount, setAttackPathCount] = useState(0);
    useEffect(() => {
      if (!scanId) {
        const demoPaths = window.VS_ATTACK_PATHS || [];
        setState({ loading: false, error: null, meta: window.VS_REPO_META, findings: window.VS_FINDINGS, attackPaths: demoPaths });
        setAttackPathCount(demoPaths.length);
        if (onLoadRepo && window.VS_REPO_META && window.VS_REPO_META.repo) {
          onLoadRepo(window.VS_REPO_META.repo);
        }
        return;
      }
      let alive = true;
      setState({ loading: true, error: null, meta: null, findings: null, attackPaths: null });
      Promise.all([
        API.scans.get(scanId),
        API.scans.findings(scanId),
        API.watchlist.list().catch(() => []),
        API.scans.attackPaths(scanId).catch(() => []),
      ])
        .then(([scan, finds, wList, paths]) => {
          if (!alive) return;
          const meta = metaFromScan(scan);
          if (onLoadRepo && meta.repo) {
            onLoadRepo(meta.repo);
          }
          const isWatched = meta.repository_id ? (wList || []).some((w) => w.id === meta.repository_id) : false;
          setWatched(isWatched);
          const normalizedPaths = Array.isArray(paths) ? paths : [];
          setAttackPathCount(normalizedPaths.length);
          setState({
            loading: false, error: null,
            meta,
            findings: (finds || []).map(normalizeFinding),
            attackPaths: normalizedPaths,
          });
        })
        .catch((e) => { if (alive) setState({ loading: false, error: (e && e.message) || "Failed to load scan", meta: null, findings: null, attackPaths: null }); });
      return () => { alive = false; };
    }, [scanId]);

    const META = state.meta || { repo: repo || "scan", branch: "", commit: "", files: 0, segments: 0, duration: "", score: 0, optScore: 0, stubScore: 0 };
    const ALL = state.findings || [];
    const ATTACK_PATHS = state.attackPaths || [];

    const counts = useMemo(() => {
      const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0, opt: 0, stub: 0 };
      ALL.forEach((f) => {
        if (suppressed[f.id]) return;
        if (f.type === "stub") c.stub++;
        else if (f.sev === "opt") c.opt++;
        else c[f.sev]++;
      });
      return c;
    }, [suppressed, ALL]);
    const totalSec = counts.critical + counts.high + counts.medium + counts.low + counts.info;

    if (state.loading) {
      return h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 13 } }, "Loading scan…");
    }
    if (state.error) {
      return h("div", { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-2)" } },
        h("div", { style: { fontSize: 14 } }, "Couldn't load this scan"),
        h("div", { style: { fontSize: 12.5, color: "var(--text-3)" } }, state.error),
        h("button", { className: "btn btn-secondary btn-sm", onClick: () => nav("dashboard") }, "Back to dashboard"));
    }

    // Export: create on the backend, poll until ready, then open the file.
    async function doExport(fmt, label) {
      if (!scanId) { toast({ kind: "info", msg: label + " export (demo)" }); return; }
      toast({ kind: "info", msg: label + " export started…" });
      try {
        const created = await API.reports.createExport(scanId, fmt);
        let report = created;
        for (let i = 0; i < 20 && report && report.status && report.status !== "ready" && report.status !== "failed"; i++) {
          await new Promise((r) => setTimeout(r, 800));
          const list = await API.reports.listExports(scanId);
          report = (list || []).find((x) => x.id === created.id) || report;
        }
        if (report && (report.status === "ready" || !report.status)) {
          window.open(API.reports.downloadExportUrl(report.id), "_blank");
          toast({ kind: "success", msg: label + " ready" });
        } else {
          toast({ kind: "error", msg: "Export failed" });
        }
      } catch (e) {
        toast({ kind: "error", msg: "Export failed: " + ((e && e.message) || "error") });
      }
    }

    // Watch / re-scan via the watchlist + scans endpoints (needs a repository).
    async function toggleWatch() {
      const repoId = META.repository_id;
      if (!repoId) {
        toast({ kind: "error", msg: "Cannot watch this repository (no linked repository)" });
        return;
      }
      const next = !watched;
      setWatched(next);
      try {
        if (next) {
          await API.watchlist.pin(repoId);
          toast({ kind: "success", msg: "Watching " + META.repo });
        } else {
          await API.watchlist.unpin(repoId);
          toast({ kind: "info", msg: "Removed " + META.repo + " from watchlist" });
        }
      } catch (e) {
        setWatched(!next);
        toast({ kind: "error", msg: "Couldn't update watchlist: " + ((e && e.message) || "error") });
      }
    }
    async function doRescan() {
      if (!scanId) { toast({ kind: "info", msg: "Re-scan queued (demo)" }); return; }
      try {
        const cfg = { source_type: state.meta && state.meta._raw ? state.meta._raw.source_type : "github", repo: META.repo };
        await API.scans.create(cfg);
        toast({ kind: "success", msg: "Re-scan queued for " + META.repo });
      } catch (e) {
        toast({ kind: "error", msg: "Couldn't queue re-scan: " + ((e && e.message) || "error") });
      }
    }

    const tabs = [
      { id: "overview", label: "Overview" },
      { id: "findings", label: "Vulnerabilities", count: totalSec },
      { id: "optimizations", label: "Optimizations", count: counts.opt },
      { id: "stubs", label: "Stubs", count: counts.stub },
      { id: "attack-paths", label: "Attack Paths", count: attackPathCount || undefined },
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
              META.duration && h("span", null, META.duration))),
          // Actions
          h("div", { style: { display: "flex", gap: 8, position: "relative" } },
            h("button", { className: "btn btn-sm" + (watched ? " btn-primary" : " btn-secondary"),
              title: watched ? "Watching this repo — monitored for new findings" : "Watch this repo for new findings",
              onClick: toggleWatch },
              h(Icons[watched ? "eye" : "eyeOff"], { size: 14 }), watched ? "Watching" : "Watch"),
            h("button", { className: "btn btn-secondary btn-sm", onClick: doRescan }, h(Icons.refresh, { size: 14 }), "Re-scan"),
            h("div", { style: { position: "relative" } },
              h("button", { className: "btn btn-secondary btn-sm", onClick: () => { setExportOpen((v) => !v); setShareOpen(false); } }, h(Icons.download, { size: 14 }), "Export", h(Icons.chevD, { size: 12 })),
              exportOpen && h("div", { className: "popover", style: { top: "calc(100% + 6px)", right: 0, minWidth: 160 } },
                [["html", "PDF report"], ["json", "JSON (full)"], ["csv", "CSV (findings)"]].map(([fmt, label]) =>
                  h("button", { key: fmt, className: "menu-item", onClick: () => { setExportOpen(false); doExport(fmt, label); } }, h(Icons.file, { size: 14, style: { color: "var(--text-3)" } }), label)))),
            h("div", { style: { position: "relative" } },
              h("button", { className: "btn btn-secondary btn-sm", onClick: () => { setShareOpen((v) => !v); setExportOpen(false); } }, h(Icons.share, { size: 14 }), "Share"),
              shareOpen && h(SharePopover, { toast, onClose: () => setShareOpen(false), scanId, meta: META })),
            h("button", { className: "btn btn-primary btn-sm", onClick: () => setHandoffOpen(true) }, h(Icons.terminal, { size: 14 }), "Hand off to Claude Code"))),

        handoffOpen && h(HandoffModal, { onClose: () => setHandoffOpen(false), toast, counts, scanId, meta: META }),

        // ===== Tabs (no summary/strip here anymore) =====
        h("div", { style: { marginTop: 16 } }, h(Tabs, { tabs, active: tab, onChange: setTab }))),

      // ===== Tab content =====
      h("div", { style: { flex: 1, minHeight: 0, overflow: "hidden" } },
        tab === "overview" && h(OverviewTab, { setTab, meta: META, findings: ALL, attackPaths: ATTACK_PATHS }),
        (tab === "findings" || tab === "optimizations" || tab === "stubs") && h(window.FindingsTab, { key: tab, mode: tab, selFile, setSelFile, suppressed, setSuppressed, toast, nav, findings: ALL, meta: META }),
        tab === "attack-paths" && h(window.AttackPathsTab, { meta: META, findings: ALL, setTab, setSelFile, nav }),
        tab === "dependencies" && h(window.DepsTab, { meta: META }),
        tab === "aigen" && h(window.AiGenTab, { meta: META }),
        tab === "history" && h(window.HistoryTab, { meta: META })),
    );
  }
  window.ScanReport = ScanReport;

  // ===== Overview tab =====
  function OverviewTab({ setTab, meta, findings, attackPaths }) {
    return h("div", { style: { height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" } },
      h(window.ReportChat, { setTab, meta, findings, attackPaths }));
  }

  function SharePopover({ toast, onClose, scanId, meta }) {
    const [copied, setCopied] = useState(false);
    const [link, setLink] = useState("");
    const [tokenId, setTokenId] = useState(null);
    const [loading, setLoading] = useState(!!scanId);

    // Create-or-reuse a share link on open (for real scans).
    useEffect(() => {
      if (!scanId) { setLink("https://tanoaudit.ai/r/8fk2-demo"); setLoading(false); return; }
      let alive = true;
      const toLink = (s) => {
        if (!s) return "";
        const slug = s.slug || s.token || s.id;
        return s.url || (API.BASE.replace("/api/v1", "") + "/api/v1/public/reports/" + slug);
      };
      API.reports.getShare(scanId)
        .then((s) => (s && (s.slug || s.url || s.id)) ? s : API.reports.createShare(scanId))
        .catch(() => API.reports.createShare(scanId))
        .then((s) => { if (alive) { setLink(toLink(s)); setTokenId(s && s.id); setLoading(false); } })
        .catch((e) => { if (alive) { setLoading(false); toast({ kind: "error", msg: "Couldn't create share link: " + ((e && e.message) || "error") }); } });
      return () => { alive = false; };
    }, [scanId]);

    return h("div", { className: "popover", style: { top: "calc(100% + 6px)", right: 0, width: 300, padding: 14 } },
      h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 4 } }, "Share read-only report"),
      h("p", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 10 } }, "Anyone with the link can view this report. Code snippets are included."),
      h("div", { style: { display: "flex", gap: 6 } },
        h("input", { className: "field mono", readOnly: true, value: loading ? "Creating link…" : link, style: { fontSize: 11.5 } }),
        h("button", { className: "btn btn-primary btn-sm", style: { flexShrink: 0 }, disabled: loading || !link,
          onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(link); setCopied(true); toast({ kind: "success", msg: "Link copied to clipboard" }); setTimeout(() => setCopied(false), 1500); } },
          copied ? h(Icons.check, { size: 14 }) : h(Icons.copy, { size: 14 }))),
      h("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 10, color: "var(--sev-critical)" },
        onClick: () => {
          if (scanId && tokenId) API.reports.deleteShare(tokenId).catch(() => {});
          toast({ kind: "info", msg: "Share link revoked" }); onClose();
        } }, "Revoke link"));
  }

  // ===== Hand off to Claude Code (MCP handoff) =====
  function HandoffModal({ onClose, toast, counts, scanId, meta }) {
    const { Modal } = window;
    const [scope, setScope] = useState("critical_high");
    const [phase, setPhase] = useState("config"); // config | generated
    const [copied, setCopied] = useState("");
    const [generating, setGenerating] = useState(false);
    const [url, setUrl] = useState("");
    // Backend origin (strip the /api/v1 suffix from the client base).
    const base = (window.TanoAuditAPI && window.TanoAuditAPI.BASE.replace(/\/api\/v1$/, "")) || "http://localhost:8000";
    const auditId = (meta && meta.id) || scanId || "scan-1";
    const mcpAdd = "claude mcp add --transport http tanoaudit " + base + "/mcp";

    async function generate() {
      if (!scanId) { setUrl(base + "/handoff/" + auditId + "?token=demo"); setPhase("generated"); return; }
      setGenerating(true);
      try {
        const res = await window.TanoAuditAPI.handoff.generate(auditId, { scope });
        const link = res.url || (base + "/api/v1/handoff/" + auditId + "?token=" + (res.token || res.id));
        setUrl(link); setPhase("generated");
        toast({ kind: "success", msg: "Handoff link generated" });
      } catch (e) {
        toast({ kind: "error", msg: "Couldn't generate handoff: " + ((e && e.message) || "error") });
      } finally {
        setGenerating(false);
      }
    }

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
          step("1", "Add the TanoAudit MCP server (one time)",
            h("div", null,
              h("p", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 6 } }, "In your terminal, register TanoAudit as an MCP server:"),
              codeRow("mcp", mcpAdd))),
          step("2", "Point Claude Code at the audit",
            h("div", null,
              h("p", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 6 } }, "In a Claude Code session, paste:"),
              codeRow("prompt", "Fetch the TanoAudit audit from " + url + " and fix the findings."))),
          step("3", "Claude fixes & reports back",
            h("p", { style: { fontSize: 12, color: "var(--text-2)" } }, "Claude calls ", h("code", { className: "mono", style: { fontSize: 11 } }, "fetch_audit_handoff"), " to read the findings, applies fixes, then calls ", h("code", { className: "mono", style: { fontSize: 11 } }, "mark_finding_fixed"), " — each one flips to ", h("span", { style: { color: "var(--sev-clean)", fontWeight: 600 } }, "Fixed via Claude Code"), " here in real time.")),
          h("p", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 4 } }, "Manage or revoke this link anytime from Settings → Handoff links.")),

      h("div", { style: { padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 } },
        phase === "config"
          ? h(React.Fragment, null,
              h("button", { className: "btn btn-ghost", onClick: onClose }, "Cancel"),
              h("button", { className: "btn btn-primary", disabled: generating, onClick: generate }, h(Icons.terminal, { size: 15 }), generating ? "Generating…" : "Generate handoff"))
          : h("button", { className: "btn btn-primary", onClick: onClose }, "Done"))));
  }

  // ================= FILE TREE =================
  function FileTree({ files, filter, effFile, setSelFile, isOpt, repoName }) {
    const rootName = repoName ? repoName.split("/").pop() : "repo";
    const tree = useMemo(() => {
      const root = { name: rootName, children: {}, files: [] };
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
  function FindingsTab({ mode, selFile, setSelFile, suppressed, setSuppressed, toast, nav, findings: allFindings, meta }) {
    const ALL = allFindings || window.VS_FINDINGS || [];
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
    ), [isOpt, isStub, ALL]);
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
          markFalsePositive(f, setSuppressed, toast);
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
          (meta && meta.repo ? meta.repo.split("/").pop() : "repo") + "/"),
        h(FileTree, { files, filter: "all", effFile, setSelFile, isOpt, repoName: meta && meta.repo }),
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
            onSuppress: () => markFalsePositive(f, setSuppressed, toast),
            toast, nav })))),
    );
  }
  window.FindingsTab = FindingsTab;
})();
