// TanoAudit — Scoped Report Chat (full-height, no outer card, exec summary as first message)
(function () {
  const React = window.React;
  const { useState, useRef, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const ALL = window.VS_FINDINGS;
  const SEV = window.SEV;

  // ===== Pre-baked responses =====
  const EXACT = {
    "Which finding should I fix first?":
`The highest-priority finding to fix is **SQL Injection in \`src/routes/products.js\`** (VS-001). It's directly exploitable from the public search endpoint — no auth required.

**Recommended fix order:**

1. **VS-001** — SQL Injection via string interpolation — \`src/routes/products.js\`
2. **VS-003** — Hardcoded Stripe secret key — \`src/services/paymentService.js\`
3. **VS-002** — JWT signature not verified — \`src/middleware/auth.js\`
4. **VS-004** — RCE via eval() on webhook payload — \`src/routes/webhooks.js\`

Fixing these 4 Criticals eliminates ~70% of total risk. All have generated diffs ready in the Findings tab.`,

    "Explain the top critical issue in plain English":
`**SQL Injection** in the product search (VS-001) works like this:

The app pastes user input directly into the database query:

\`\`\`javascript
// Vulnerable
const query = \`SELECT * FROM products WHERE name = '\${req.query.search}'\`;
\`\`\`

An attacker types \`' OR '1'='1\` as the search term. The database sees:

\`\`\`sql
SELECT * FROM products WHERE name = '' OR '1'='1'
\`\`\`

That returns every product — and they can chain further to dump users, passwords, or admin data.

**The fix** is parameterized queries. The corrected code is already in VS-001's diff panel — it's a one-line change.`,

    "Summarize the optimization opportunities":
`There are **13 optimization findings** across 4 categories:

**Performance (5 findings)**
- N+1 query in the orders endpoint — eager-loading with a JOIN would cut p95 latency ~60%.
- Missing index on \`products.category_id\` — the product listing runs a full table scan.

**Code quality (4 findings)**
- 3 unused middleware imports in \`src/routes/\`
- Dead code in \`src/services/emailService.js\` that's never reached.

**Dependencies (3 findings)**
- \`lodash\` imported wholesale, only 2 functions used — tree-shaking saves ~70 KB.

**Security-adjacent (1 finding)**
- Overly permissive CORS in non-production — worth tightening before staging mirrors prod.

See the **Optimizations tab** for generated plans on each item.`,

    "What stubs are most dangerous to ship?":
`The completeness analysis found **4 stubs**. Ranked by risk if shipped:

**🔴 Critical — STB-0001** Empty RBAC guard (\`src/middleware/rbac.js\`)
The role check only calls \`next()\` — every authenticated user gets admin access. This is a real security hole, not just incomplete code. Fix before any deploy.

**🟠 High — STB-0002** Email service returns dummy success (\`src/services/emailService.js\`)
Returns \`{ ok: true }\` without sending. Password resets and receipts silently fail while reporting success.

**🟡 Medium — STB-0003** Hollow order handler (\`src/routes/orders.js\`)
AI-scaffolded \`// Add your logic here\` + a generic 200 — orders are accepted but never persisted.

**🔵 Low — STB-0004** Unbounded cache (\`src/utils/cache.js\`)
A \`// TODO: add cache eviction\` on an unbounded Map — grows until OOM under load.

Each has a suggested implementation ready in the **Stubs tab**. If any are deliberate, mark them *intentional* to exclude them from the completeness score.`,

    "Group related findings together":
`Here's how the 32 security findings cluster:

**Authentication & Authorization — 8 findings**
- VS-002, VS-007, VS-012, VS-019 — JWT and session token weaknesses
- VS-005, VS-009 — Missing rate limiting on login and reset

**Injection — 5 findings**
- VS-001, VS-008, VS-015 — SQL injection variants
- VS-011, VS-023 — Command injection

**Secrets & Exposure — 4 findings**
- VS-003, VS-014 — Hardcoded credentials
- VS-018, VS-026 — Permissive CORS and missing HSTS

**Input Validation — 7 findings**
- VS-004, VS-006, VS-010 and 4 others — Missing guards across public endpoints

**Miscellaneous — 8 findings**
- Dependency CVEs (VS-025), eval-based RCE (VS-004), prototype pollution (VS-028)

Fixing **Auth & Authorization** first neutralizes ~25% of the attack surface with lowest deployment risk.`,
  };

  function getResponse(q) {
    if (EXACT[q]) return EXACT[q];
    const lq = q.toLowerCase();
    if (lq.includes("sql") || lq.includes("injection")) return EXACT["Explain the top critical issue in plain English"];
    if (lq.includes("fix") || lq.includes("priority") || lq.includes("first") || lq.includes("start")) return EXACT["Which finding should I fix first?"];
    if (lq.includes("optim") || lq.includes("performance") || lq.includes("latency")) return EXACT["Summarize the optimization opportunities"];
    if (lq.includes("group") || lq.includes("cluster") || lq.includes("categor")) return EXACT["Group related findings together"];
    if (lq.includes("stub") || lq.includes("placeholder") || lq.includes("incomplete") || lq.includes("todo") || lq.includes("complete")) return EXACT["What stubs are most dangerous to ship?"];
    if (lq.includes("attack") || lq.includes("chain") || lq.includes("exploit") || lq.includes("path") || lq.includes("dangerous") || lq.includes("chained")) {
      return `The scan detected **2 attack chains** — combinations of individual findings that, exploited in sequence, form a real-world hack:

**Chain 1 — Auth bypass → privilege escalation (Critical)**
An attacker forges an admin token via the JWT signature bypass (VS-002), then exploits the empty RBAC guard (STB-0001) to gain full admin access — no brute-force needed. Every admin endpoint is wide open until both are fixed.

**Chain 2 — Credential theft → lateral movement (High)**
The hardcoded Stripe key (VS-003) is accessible to any collaborator with read access. Combined with the eval-based RCE in the webhook handler (VS-004), an attacker can exfiltrate credentials and pivot to other infrastructure from a single malicious webhook payload.

**How dangerous are they?**
- Chain 1 is remotely exploitable right now with zero credentials. Fix VS-002 + STB-0001 first.
- Chain 2 requires repo access, but VS-004 is reachable from the public webhook endpoint.

Fixing **VS-002, STB-0001, VS-003, and VS-004** breaks both chains. Their diffs are ready in the **Vulnerabilities** and **Stubs** tabs.`;
    }
    if (lq.includes("jwt") || lq.includes("token") || lq.includes("session") || (lq.includes("auth") && !lq.includes("authori"))) {
      return `VS-002 is a **JWT signature bypass** in \`src/middleware/auth.js\` — the server accepts tokens with \`algorithm: "none"\`, meaning an attacker can forge a valid admin token with no secret key at all.

\`\`\`javascript
// Fix — pin the algorithm
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
\`\`\`

15-minute change. Full patch is in VS-002's diff panel.`;
    }
    if (lq.includes("stripe") || lq.includes("secret") || lq.includes("credential") || (lq.includes("key") && !lq.includes("keyword"))) {
      return `VS-003 is a **hardcoded Stripe secret key** in \`src/services/paymentService.js\` — visible to anyone with repo access.

**Immediate steps:**
1. Rotate the key in Stripe's dashboard right now
2. Move it to \`process.env.STRIPE_SECRET_KEY\`
3. Add a pre-commit hook blocking \`sk_live_\` patterns

Fix already generated in VS-003's diff panel.`;
    }
    if (lq.includes("rce") || lq.includes("eval") || lq.includes("webhook") || lq.includes("remote code")) {
      return `VS-004 is an **RCE bug** in \`src/routes/webhooks.js\` — it runs \`eval()\` on incoming payload data:

\`\`\`javascript
// Vulnerable
eval(req.body.handler);
\`\`\`

Anyone who can POST to \`/webhooks\` can execute arbitrary Node.js on the server.

**Fix:** Remove \`eval()\`. Use a strict allowlist of handler names if dynamic dispatch is needed. The safe alternative is in VS-004's diff panel.`;
    }
    const onTopic = ["find","vuln","scan","secur","code","fix","optim","risk","critical","high","medium","low","depend","src/",".js",".ts","route","middleware","service","stub","placeholder","incomplete","todo","complete","attack","chain","exploit","path"].some(k => lq.includes(k));
    if (!onTopic) return "I can only help with findings from this scan. Is there something specific about the vulnerabilities or optimizations you'd like to dig into?";
    return `Based on this scan of \`user/ecommerce-api\`:

The scan found **32 security findings** across 24 files — 4 Critical, 9 High, 11 Medium, 5 Low, 3 Info — plus 13 optimization opportunities and **2 attack chains**.

The most urgent issues are around **authentication** (VS-002), **injection** (VS-001), and **exposed secrets** (VS-003). See the **Attack Paths** tab for the detected exploitation chains.

Is there a specific finding, file, or category you'd like me to explain?`;
  }

  function chunkText(text) {
    const out = [];
    let i = 0;
    while (i < text.length) { const n = Math.floor(Math.random() * 7 + 3); out.push(text.slice(i, i + n)); i += n; }
    return out;
  }

  // ===== Markdown =====
  function parseInline(text, onRef) {
    const regex = /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?:VS|VLN|OPT|STB)[-\u2011]\d{3,4}|src\/\S+\.\w+|<[bB][rR]\s*\/?>)/g;
    const parts = []; let last = 0, m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith("**")) parts.push(h("strong", { key: m.index }, t.slice(2, -2)));
      else if (t.startsWith("`")) parts.push(h("code", { key: m.index, style: { fontSize: 12, padding: "1px 5px", background: "var(--bg-active)", borderRadius: 4, fontFamily: "var(--font-mono)" } }, t.slice(1, -1)));
      else if (t.match(/^(VS|VLN|OPT|STB)[-\u2011]\d+$/)) {
        const normalizedId = t.replace("\u2011", "-");
        const f = ALL ? ALL.find(x => x.id === normalizedId) : null;
        const sev = f ? f.sev : (normalizedId.startsWith("OPT") ? "opt" : normalizedId.startsWith("STB") ? "stub" : "info");
        const sd = (SEV && SEV[sev]) || { color: "var(--text-2)", bg: "var(--bg-active)" };
        parts.push(h("button", { key: m.index, onClick: () => onRef && onRef(normalizedId, sev), style: { display: "inline-flex", alignItems: "center", background: sd.bg, color: sd.color, border: "1px solid color-mix(in srgb," + sd.color + " 30%,transparent)", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 650, fontFamily: "var(--font-mono)", cursor: "pointer", verticalAlign: "middle", transition: "transform 80ms ease" }, onMouseEnter: e => e.currentTarget.style.transform = "scale(1.06)", onMouseLeave: e => e.currentTarget.style.transform = "" }, normalizedId));
      } else if (t.startsWith("src/")) {
        parts.push(h("button", { key: m.index, onClick: () => onRef && onRef(t, "file"), style: { display: "inline-flex", alignItems: "center", gap: 3, color: "var(--sev-low)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", background: "none", border: "none", padding: 0, verticalAlign: "middle" } }, h(Icons.file, { size: 11 }), t));
      } else if (t.match(/^<[bB][rR]\s*\/?>$/)) {
        parts.push(h("br", { key: m.index }));
      }
      last = m.index + t.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return h(React.Fragment, null, ...parts);
  }

  function preProcessHtml(text) {
    if (!text) return "";
    let s = text;
    // Replace list items with markdown bullet points
    s = s.replace(/<li\b[^>]*>/gi, "\n- ");
    s = s.replace(/<\/li>/gi, "");
    s = s.replace(/<ol\b[^>]*>/gi, "\n");
    s = s.replace(/<\/ol>/gi, "");
    s = s.replace(/<ul\b[^>]*>/gi, "\n");
    s = s.replace(/<\/ul>/gi, "");
    s = s.replace(/<p\b[^>]*>/gi, "\n");
    s = s.replace(/<\/p>/gi, "");
    // Remove extra consecutive newlines that might be introduced
    s = s.replace(/\n{3,}/g, "\n\n");
    return s;
  }

  function renderMarkdown(text, onRef) {
    if (!text) return null;
    const cleanText = preProcessHtml(text);
    const lines = cleanText.split("\n");
    const out = []; let i = 0, k = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("```")) {
        const code = []; i++;
        while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; }
        out.push(h("pre", { key: k++, style: { background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 12, overflow: "auto", margin: "6px 0", fontFamily: "var(--font-mono)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" } }, code.join("\n")));
        i++; continue;
      }
      if (line.trim().startsWith("|")) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const parseRow = (rowStr) => {
            const cells = rowStr.split("|").map(c => c.trim());
            if (cells[0] === "") cells.shift();
            if (cells[cells.length - 1] === "") cells.pop();
            return cells;
          };
          const headers = parseRow(tableLines[0]);
          const isSep = tableLines[1].split("|").every(cell => {
            const c = cell.trim();
            return c === "" || /^-+$/.test(c);
          });
          if (isSep) {
            const rows = [];
            for (let r = 2; r < tableLines.length; r++) {
              rows.push(parseRow(tableLines[r]));
            }
            const tableStyle = {
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              margin: "12px 0 16px",
              lineHeight: 1.5,
            };
            const thStyle = {
              borderBottom: "2px solid var(--border-strong)",
              padding: "8px 10px",
              textAlign: "left",
              fontWeight: 650,
              color: "var(--text-1)",
              background: "var(--bg-inset)",
            };
            const tdStyle = {
              borderBottom: "1px solid var(--border)",
              padding: "8px 10px",
              color: "var(--text-2)",
            };
            const getCellStyle = (baseStyle, text) => {
              const trimmed = (text || "").trim();
              const hasBr = /<[bB][rR]\s*\/?>/.test(trimmed);
              const shouldNoWrap = (trimmed.length < 30 && !hasBr);
              if (shouldNoWrap) {
                return { ...baseStyle, whiteSpace: "nowrap" };
              }
              return baseStyle;
            };
            out.push(h("div", { key: k++, style: { overflowX: "auto" } },
              h("table", { style: tableStyle },
                h("thead", null,
                  h("tr", null,
                    headers.map((hText, idx) => h("th", { key: idx, style: getCellStyle(thStyle, hText) }, parseInline(hText, onRef)))
                  )
                ),
                h("tbody", null,
                  rows.map((rowCells, rIdx) =>
                    h("tr", { key: rIdx },
                      rowCells.map((cellText, cIdx) => h("td", { key: cIdx, style: getCellStyle({ ...tdStyle, verticalAlign: "top" }, cellText) }, parseInline(cellText, onRef)))
                    )
                  )
                )
              )
            ));
            continue;
          }
        }
        i -= tableLines.length;
      }
      const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const content = hMatch[2];
        const tag = "h" + level;
        const style = {
          marginTop: level === 1 ? 16 : level === 2 ? 14 : 10,
          marginBottom: 6,
          fontWeight: 650,
          fontSize: level === 1 ? 17 : level === 2 ? 15.5 : level === 3 ? 14.5 : 13.5
        };
        out.push(h(tag, { key: k++, style }, parseInline(content, onRef)));
        i++; continue;
      }
      if (!line.trim()) { out.push(h("div", { key: k++, style: { height: 5 } })); i++; continue; }
      if (line.match(/^[-*] /)) {
        const items = [];
        while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(h("li", { key: i, style: { marginBottom: 2 } }, parseInline(lines[i].slice(2), onRef))); i++; }
        out.push(h("ul", { key: k++, style: { paddingLeft: 20, margin: "4px 0" } }, ...items)); continue;
      }
      if (line.match(/^\d+\. /)) {
        const items = [];
        while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(h("li", { key: i, style: { marginBottom: 2 } }, parseInline(lines[i].replace(/^\d+\. /, ""), onRef))); i++; }
        out.push(h("ol", { key: k++, style: { paddingLeft: 20, margin: "4px 0" } }, ...items)); continue;
      }
      out.push(h("p", { key: k++, style: { margin: "2px 0", lineHeight: 1.55 } }, parseInline(line, onRef)));
      i++;
    }
    return out;
  }

  // Claude-style shimmering "thinking" line (shared shimmer-text animation)
  function ThinkingDots() {
    return h("div", { className: "shimmer-text", style: { padding: "4px 2px", fontSize: 13.5, fontWeight: 550 } }, "Thinking…");
  }

  // Action row under a finished AI message: copy + feedback (like the reference)
  function AiActions({ msg, hovered }) {
    const [copied, setCopied] = useState(false);
    const [vote, setVote] = useState(null); // "up" | "down" | null
    function copy() {
      const text = msg.text || "";
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
    function actBtn(title, active, activeColor, onClick, icon) {
      return h("button", {
        title, onClick,
        style: { width: 27, height: 27, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: active ? activeColor : "var(--text-3)", transition: "background var(--dur-micro) ease, color var(--dur-micro) ease" },
        onMouseEnter: e => { e.currentTarget.style.background = "var(--bg-active)"; if (!active) e.currentTarget.style.color = "var(--text-1)"; },
        onMouseLeave: e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = active ? activeColor : "var(--text-3)"; },
      }, icon);
    }
    return h("div", { style: { display: "flex", gap: 1, marginTop: 5, marginLeft: 1, opacity: hovered ? 1 : 0, transition: "opacity var(--dur-micro) ease", pointerEvents: hovered ? "auto" : "none" } },
      actBtn(copied ? "Copied" : "Copy", copied, "var(--accent)", copy,
        copied ? h(Icons.check, { size: 14 }) : h(Icons.copy, { size: 14 })),
      actBtn("Good response", vote === "up", "var(--accent)", () => setVote(vote === "up" ? null : "up"),
        h(Icons.thumbUp, { size: 14 })),
      actBtn("Bad response", vote === "down", "var(--sev-critical)", () => setVote(vote === "down" ? null : "down"),
        h(Icons.thumbDown, { size: 14 })));
  }

  const EXEC_SUMMARY = `This scan found **4 Critical issues** that are remotely exploitable today: SQL injection in the product search, a forged-token path through \`auth.js\`, a live Stripe key in source, and an eval-based RCE in the webhook handler. Prioritize \`src/routes/products.js\`, \`src/middleware/auth.js\` and \`src/services/paymentService.js\` — fixing the top 6 findings removes ~70% of total risk. The optimization engine flagged an N+1 query and a missing index that together account for most of the API's p95 latency. The completeness analysis found **4 stubs and placeholders**, including a critical empty RBAC guard (\`src/middleware/rbac.js\`) that grants every user admin access if shipped — complete it before deployment. **Estimated remediation: 2–3 engineer-days** for all Criticals and Highs.`;

  const CHIPS = [
    "Which finding should I fix first?",
    "Explain the top critical issue in plain English",
    "What stubs are most dangerous to ship?",
    "Summarize the optimization opportunities",
  ];

  const INIT_MSGS = [{ id: 0, role: "ai", text: EXEC_SUMMARY, initial: true }];

  // Summary for a real scan that has no backend-generated ai_summary. Reports
  // only what was actually captured — partial findings if the scan was cut short,
  // otherwise an honest "nothing to report". Never invents demo content.
  function realScanFallbackSummary(meta, findings, attackPaths) {
    const all = findings || [];
    const paths = attackPaths || [];
    const incomplete = meta && (meta.status === "cancelled" || meta.status === "canceled" || meta.status === "failed");
    const n = (p) => all.filter(p).length;
    const vuln = n((f) => f.type === "vuln");
    const opt = n((f) => f.type === "opt");
    const stub = n((f) => f.type === "stub");
    const crit = n((f) => f.sev === "critical");
    const high = n((f) => f.sev === "high");

    // "was cancelled" reads well; "failed" doesn't take "was".
    const verb = meta && meta.status === "failed" ? "**failed**" : "was **" + (meta ? meta.status : "stopped") + "**";

    if (all.length === 0 && paths.length === 0) {
      if (incomplete) {
        return "This scan " + verb + " before any findings were recorded, so there is nothing to report. Re-run the scan to get a full analysis.";
      }
      return "This scan completed without recording any findings — no vulnerabilities, optimizations, or stubs were flagged.";
    }

    // We have partial findings — report exactly those, framed by status.
    const parts = [];
    if (vuln) parts.push("**" + vuln + "** " + (vuln === 1 ? "vulnerability" : "vulnerabilities") + (crit + high ? " (" + [crit && crit + " critical", high && high + " high"].filter(Boolean).join(", ") + ")" : ""));
    if (opt) parts.push("**" + opt + "** optimization " + (opt === 1 ? "finding" : "findings"));
    if (stub) parts.push("**" + stub + "** " + (stub === 1 ? "stub/placeholder" : "stubs/placeholders"));
    if (paths.length) parts.push("**" + paths.length + "** attack " + (paths.length === 1 ? "chain" : "chains"));
    const list = parts.join(", ").replace(/, ([^,]*)$/, " and $1");
    const lead = incomplete
      ? "This scan " + verb + " before finishing. Partial results captured so far: "
      : "This scan recorded ";
    const tail = incomplete ? " These are partial — re-run the scan for complete coverage." : "";
    return lead + list + "." + tail;
  }

  function ReportChat({ setTab, meta, findings, attackPaths }) {
    const API = window.TanoAuditAPI;
    const META = meta || window.VS_REPO_META;
    const scanId = META && META.id && meta ? META.id : null; // only treat as real when meta came from a scan
    const storageKey = scanId ? "tanoaudit:chat:" + scanId : "tanoaudit:chat:demo";

    const getBaseInitial = React.useCallback(() => {
      // Real scan with a backend-generated summary — use it verbatim.
      if (scanId && META.summary) {
        let text = META.summary;
        if (text.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(text);
            if (parsed && parsed.summary) {
              text = parsed.summary;
            }
          } catch (e) {}
        }
        return [{ id: 0, role: "ai", text, initial: true }];
      }
      // Real scan with NO summary (cancelled/failed before one was generated, or
      // a completed scan that produced none). Never fall back to the demo prose —
      // report only what was actually captured, derived from real findings.
      if (scanId) {
        return [{ id: 0, role: "ai", text: realScanFallbackSummary(META, findings, attackPaths), initial: true }];
      }
      // No scanId at all → demo/preview mode.
      return INIT_MSGS;
    }, [scanId, META.summary, META.status, findings, attackPaths]);

    const initial = React.useMemo(() => {
      const base = getBaseInitial();
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Always re-derive the initial summary from current scan state so a
            // stale cached summary (e.g. old demo prose) can't persist; keep any
            // cached conversation that followed it.
            const rest = parsed.filter((m) => !m.initial);
            return [...base, ...rest];
          }
        } catch (e) {}
      }
      return base;
    }, [storageKey, getBaseInitial]);

    const [messages, setMessages] = useState(initial);

    useEffect(() => {
      setMessages(initial);
    }, [initial]);

    useEffect(() => {
      const cleanMessages = messages.filter(m => !m.thinking);
      localStorage.setItem(storageKey, JSON.stringify(cleanMessages));
    }, [messages, storageKey]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    // TanoAudit model tiers for the chat engine selector.
    const [tiers, setTiers] = useState([]);
    const [tier, setTier] = useState(null);
    useEffect(() => {
      if (!API) return;
      let alive = true;
      API.scans.models()
        .then((d) => { if (alive) { const ts = (d && d.tiers) || []; setTiers(ts); setTier((d && d.default) || (ts[0] && ts[0].id) || null); } })
        .catch(() => {});
      return () => { alive = false; };
    }, []);
    const [editingId, setEditingId] = useState(null);
    const [hoveredMsg, setHoveredMsg] = useState(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [clearOpen, setClearOpen] = useState(false);
    const scrollRef = useRef();
    const taRef = useRef();
    const ivRef = useRef();

    function scrollToBottom(smooth) {
      if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth === false ? "instant" : "smooth" });
    }
    function onScroll() {
      const el = scrollRef.current;
      if (el) setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    }
    function resizeTa() {
      if (!taRef.current) return;
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
    }
    function onRef(token, sev) {
      if (token.startsWith("STB-")) setTab("stubs");
      else if (sev === "file" || token.startsWith("OPT-")) setTab("optimizations");
      else if (token.startsWith("AP-") || token.startsWith("ATC-")) setTab("attack-paths");
      else setTab("findings");
    }

    function startEdit(msg) {
      setEditingId(msg.id);
      setInput(msg.text);
      setTimeout(() => { taRef.current && taRef.current.focus(); resizeTa(); }, 30);
    }
    function cancelEdit() {
      setEditingId(null);
      setInput("");
      if (taRef.current) taRef.current.style.height = "auto";
    }

    function send(text) {
      const q = (text !== undefined ? String(text) : input).trim();
      if (!q || streaming) return;
      setInput(""); if (taRef.current) taRef.current.style.height = "auto";
      const aid = Date.now() + 1;

      if (editingId !== null) {
        // Find edited message index and truncate from there
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === editingId);
          const base = idx >= 0 ? prev.slice(0, idx) : prev;
          return [...base,
            { id: editingId, role: "user", text: q, edited: true },
            { id: aid, role: "ai", thinking: true, text: "" },
          ];
        });
        setEditingId(null);
      } else {
        const uid = Date.now();
        setMessages(prev => [...prev,
          { id: uid, role: "user", text: q },
          { id: aid, role: "ai", thinking: true, text: "" },
        ]);
      }
      setStreaming(true);
      setTimeout(() => scrollToBottom(), 60);

      // Real scan: stream the answer token-by-token from the backend (SSE).
      // Otherwise fall back to the canned demo reply.
      if (scanId && API) {
        const history = messages
          .filter((m) => !m.thinking && !m.initial && (m.role === "user" || m.role === "ai"))
          .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
        // Build a compact attack-paths context string so the LLM is aware of chains.
        const paths = attackPaths || [];
        const attackPathsContext = paths.length
          ? paths.map((p, i) =>
              (i + 1) + ". " + (p.name || "Attack chain") + " [" + (p.severity || "high") + "]" +
              (p.finding_public_ids && p.finding_public_ids.length ? " — findings: " + p.finding_public_ids.join(", ") : "") +
              (p.impact ? " — impact: " + p.impact : "")
            ).join("\n")
          : null;
        let acc = "";
        let n = 0;
        const ctl = API.chat.send(scanId, q, history, (evt) => {
          if (evt && typeof evt === "object") {
            if (evt.done) {
              setStreaming(false);
              setTimeout(() => { taRef.current && taRef.current.focus(); scrollToBottom(); }, 80);
              return;
            }
            if (evt.delta) {
              acc += evt.delta; n++;
              setMessages(p => p.map(m => m.id === aid ? { ...m, thinking: false, text: acc } : m));
              if (n % 8 === 0) scrollToBottom();
            }
          } else if (typeof evt === "string") {
            acc += evt;
            setMessages(p => p.map(m => m.id === aid ? { ...m, thinking: false, text: acc } : m));
          }
        }, tier, attackPathsContext);
        ctl.promise
          .then(() => {
            setMessages(p => p.map(m => m.id === aid ? { ...m, thinking: false, text: acc || "(no response)" } : m));
            setStreaming(false);
            setTimeout(() => { taRef.current && taRef.current.focus(); scrollToBottom(); }, 80);
          })
          .catch((e) => {
            setMessages(p => p.map(m => m.id === aid ? { ...m, thinking: false, text: acc || ("⚠️ " + ((e && e.message) || "Chat failed.")) } : m));
            setStreaming(false);
          });
        return;
      }

      const resp = getResponse(q);
      setTimeout(() => {
        setMessages(p => p.map(m => m.id === aid ? { ...m, thinking: false } : m));
        const chunks = chunkText(resp);
        let ci = 0;
        ivRef.current = setInterval(() => {
          ci++;
          const partial = chunks.slice(0, ci).join("");
          setMessages(p => p.map(m => m.id === aid ? { ...m, text: partial } : m));
          if (ci % 10 === 0) scrollToBottom();
          if (ci >= chunks.length) {
            clearInterval(ivRef.current);
            setStreaming(false);
            setTimeout(() => { taRef.current && taRef.current.focus(); scrollToBottom(); }, 80);
          }
        }, 32);
      }, 700 + Math.random() * 500);
    }

    function onKeyDown(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
      if (e.key === "Escape" && editingId !== null) { cancelEdit(); }
    }

    const hasUserMessages = messages.some(m => m.role === "user");

    // Centered reading column, matching the reference layout (~740px).
    const COL = 740;

    return h("div", { style: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" } },

      // Messages area — full-bleed scroll, content centered in a 740px column
      h("div", { ref: scrollRef, onScroll, style: { flex: 1, overflowY: "auto", padding: "28px 24px 12px", position: "relative" } },
       h("div", { style: { maxWidth: COL, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 } },

        // Render messages
        messages.map(m =>
          m.role === "user"
            ? h("div", { key: m.id, className: "chat-msg-user", style: { display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "flex-start" }, onMouseEnter: () => setHoveredMsg(m.id), onMouseLeave: () => setHoveredMsg(null) },
                hoveredMsg === m.id && h("div", { style: { display: "flex", alignItems: "center", gap: 4, alignSelf: "center" } },
                  m.edited && h("span", { style: { fontSize: 10.5, color: "var(--text-3)", fontStyle: "italic" } }, "edited"),
                  h("button", { title: "Edit message", onClick: () => startEdit(m), style: { width: 26, height: 26, borderRadius: 7, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", transition: "background var(--dur-micro) ease" }, onMouseEnter: e => e.currentTarget.style.background = "var(--bg-hover)", onMouseLeave: e => e.currentTarget.style.background = "var(--bg-active)" }, h(Icons.edit, { size: 12 }))),
                h("div", { style: { background: "var(--accent)", color: "var(--accent-text)", padding: "9px 14px", borderRadius: "14px 14px 3px 14px", maxWidth: "min(72%, 440px)", fontSize: 13.5, lineHeight: 1.5, fontWeight: 500, wordBreak: "break-word", opacity: editingId === m.id ? 0.55 : 1, transition: "opacity var(--dur-micro) ease" } }, m.text))
            : h("div", { key: m.id, className: "chat-msg-ai", style: { display: "flex", gap: 9, alignItems: "flex-start" }, onMouseEnter: () => setHoveredMsg(m.id), onMouseLeave: () => setHoveredMsg(null) },
                h("div", { style: { width: 26, height: 26, borderRadius: 7, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 } }, h(Icons.sparkle, { size: 13 })),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { background: "var(--bg-raised)", border: "1px solid var(--border)", padding: "11px 15px", borderRadius: "3px 14px 14px 14px", fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.55, wordBreak: "break-word" } },
                    // Gauges live inside the first summary message.
                    // Security RISK = 100 − security_score: higher = more risk (BAD),
                    // so a high gauge lights more red ticks. Optimization and
                    // Completeness are shown as-is (higher = better).
                    // Only show scores for a completed scan. A cancelled/failed
                    // scan never finished computing them, so the gauges would be
                    // misleading (0 or stale) — show a status banner instead.
                    m.initial && (() => {
                      // Only a completed scan has real scores. Anything else
                      // (cancelled/failed, or still running/queued) hasn't
                      // finished computing them — show a status banner instead
                      // of misleading 100/0/0 gauges (null scores → 0).
                      const st = META.status;
                      const terminalBad = st === "cancelled" || st === "canceled" || st === "failed";
                      const inProgress = st === "running" || st === "claimed" || st === "queued" || st === "pending";
                      if (terminalBad || inProgress) {
                        const verb = terminalBad ? (st + " before completing") : "is still " + st;
                        const tail = terminalBad
                          ? " No scores are available. Re-run the scan to get results."
                          : " Scores will appear here once the scan finishes.";
                        return h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: "var(--bg-active)", border: "1px solid var(--border)" } },
                          inProgress ? h("div", { className: "spinner", style: { width: 15, height: 15 } }) : h(Icons.alert, { size: 16, color: "var(--sev-critical)" }),
                          h("div", { style: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 } },
                            h("span", { style: { fontWeight: 650, color: "var(--text-1)" } }, "This scan " + verb + "."),
                            tail));
                      }
                      return h("div", { style: { display: "flex", justifyContent: "center", gap: 28, padding: "4px 0 14px", marginBottom: 12, borderBottom: "1px solid var(--border)", flexWrap: "wrap" } },
                            h(window.SegmentArc, { value: Math.max(0, Math.min(100, 100 - (META.score || 0))), size: 100, label: "Security Risk", color: "oklch(58% 0.26 18)", sublabel: "/ 100" }),
                            h(window.SegmentArc, { value: META.optScore, size: 100, label: "Optimization", color: "oklch(58% 0.28 280)", sublabel: "/ 100" }),
                            h(window.SegmentArc, { value: META.stubScore, size: 100, label: "Completeness", color: "oklch(64% 0.13 180)", sublabel: "/ 100" }));
                    })(),
                    m.thinking ? h(ThinkingDots) : renderMarkdown(m.text, onRef)),
                  // Action row under finished AI messages (copy / feedback)
                  !m.thinking && m.text && h(AiActions, { msg: m, hovered: hoveredMsg === m.id }),
                  // Suggested chips below first AI message (only if no user messages yet)
                  m.initial && !hasUserMessages && h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 } },
                    CHIPS.map((c, i) => h("button", { key: c, className: "chat-chip", style: { animationDelay: i * 55 + "ms", textAlign: "left" }, onClick: () => send(c) }, c)))))),

        // Scroll-to-bottom
        showScrollDown && h("button", { className: "chat-scroll-down", style: { alignSelf: "center" }, onClick: () => scrollToBottom() }, h(Icons.chevD, { size: 13 }), "Latest"))),

      // Composer — inner content centered to the same 740px column
      h("div", { style: { flexShrink: 0, padding: "8px 24px 14px" } },
       h("div", { style: { maxWidth: COL, margin: "0 auto", paddingLeft: 35 } },
        // Editing indicator
        editingId !== null && h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "0 8px 7px", fontSize: 12, color: "var(--text-3)" } },
          h(Icons.edit, { size: 12 }), "Editing message",
          h("button", { onClick: cancelEdit, style: { marginLeft: 4, fontSize: 12, color: "var(--sev-critical)", background: "none", border: "none", cursor: "pointer", padding: 0 } }, "Cancel")),

        h("div", { className: "composer-box" },
          h("textarea", { ref: taRef, className: "composer-ta", value: input, rows: 1, disabled: streaming,
            placeholder: editingId !== null ? "Edit your message\u2026" : "Ask anything about this scan\u2026",
            onChange: e => { setInput(e.target.value); resizeTa(); }, onKeyDown }),

          // Toolbar row inside the box: engine selector on the left, clear + send right
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
            h("div", { style: { flex: 1 } }),
            messages.length > 1 && !streaming && h("div", { style: { position: "relative" } },
              h("button", { className: "btn btn-ghost btn-sm", style: { fontSize: 11.5, color: "var(--text-3)" }, onClick: () => setClearOpen(v => !v) }, "Clear"),
              clearOpen && h("div", { className: "popover", style: { right: 0, bottom: "calc(100% + 8px)", width: 210, padding: 14, zIndex: 20 }, onClick: e => e.stopPropagation() },
                h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 5 } }, "Clear conversation?"),
                h("div", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 10 } }, "Resets to the initial summary."),
                h("div", { style: { display: "flex", gap: 6 } },
                  h("button", { className: "btn btn-ghost btn-sm", onClick: () => setClearOpen(false) }, "Cancel"),
                  h("button", { className: "btn btn-danger btn-sm", onClick: () => {
                    const base = getBaseInitial();
                    setMessages(base);
                    localStorage.removeItem(storageKey);
                    setClearOpen(false);
                    setStreaming(false);
                    setEditingId(null);
                    if (ivRef.current) clearInterval(ivRef.current);
                  } }, "Reset")))),
            h("button", { className: "composer-send", disabled: !input.trim() || streaming, onClick: () => send(), title: "Send" },
              streaming
                ? h("div", { className: "spinner", style: { width: 14, height: 14, borderTopColor: "var(--accent-text)" } })
                : h(Icons.arrowUp, { size: 17 })))),

        // Helper line, like Claude's disclaimer
        h("div", { style: { textAlign: "center", fontSize: 11.5, color: "var(--text-3)", marginTop: 9 } }, "TanoAudit can only discuss this scan’s findings."))));
  }
  window.ReportChat = ReportChat;
  window.renderMarkdown = renderMarkdown;
})();
