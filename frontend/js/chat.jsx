// Akira AI — Scoped Report Chat (full-height, no outer card, exec summary as first message)
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
    const onTopic = ["find","vuln","scan","secur","code","fix","optim","risk","critical","high","medium","low","depend","src/",".js",".ts","route","middleware","service","stub","placeholder","incomplete","todo","complete"].some(k => lq.includes(k));
    if (!onTopic) return "I can only help with findings from this scan. Is there something specific about the vulnerabilities or optimizations you'd like to dig into?";
    return `Based on this scan of \`user/ecommerce-api\`:

The scan found **32 security findings** across 24 files — 4 Critical, 9 High, 11 Medium, 5 Low, 3 Info — plus 13 optimization opportunities.

The most urgent issues are around **authentication** (VS-002), **injection** (VS-001), and **exposed secrets** (VS-003).

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
    const regex = /(\*\*[^*\n]+\*\*|`[^`\n]+`|VS-\d{3,4}|OPT-\d{3,4}|STB-\d{3,4}|src\/\S+\.\w+)/g;
    const parts = []; let last = 0, m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith("**")) parts.push(h("strong", { key: m.index }, t.slice(2, -2)));
      else if (t.startsWith("`")) parts.push(h("code", { key: m.index, style: { fontSize: 12, padding: "1px 5px", background: "var(--bg-active)", borderRadius: 4, fontFamily: "var(--font-mono)" } }, t.slice(1, -1)));
      else if (t.match(/^(VS|OPT|STB)-\d+$/)) {
        const f = ALL ? ALL.find(x => x.id === t) : null;
        const sev = f ? f.sev : "info";
        const sd = (SEV && SEV[sev]) || { color: "var(--text-2)", bg: "var(--bg-active)" };
        parts.push(h("button", { key: m.index, onClick: () => onRef && onRef(t, sev), style: { display: "inline-flex", alignItems: "center", background: sd.bg, color: sd.color, border: "1px solid color-mix(in srgb," + sd.color + " 30%,transparent)", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 650, fontFamily: "var(--font-mono)", cursor: "pointer", verticalAlign: "middle", transition: "transform 80ms ease" }, onMouseEnter: e => e.currentTarget.style.transform = "scale(1.06)", onMouseLeave: e => e.currentTarget.style.transform = "" }, t));
      } else if (t.startsWith("src/")) {
        parts.push(h("button", { key: m.index, onClick: () => onRef && onRef(t, "file"), style: { display: "inline-flex", alignItems: "center", gap: 3, color: "var(--sev-low)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", background: "none", border: "none", padding: 0, verticalAlign: "middle" } }, h(Icons.file, { size: 11 }), t));
      }
      last = m.index + t.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return h(React.Fragment, null, ...parts);
  }

  function renderMarkdown(text, onRef) {
    if (!text) return null;
    const lines = text.split("\n");
    const out = []; let i = 0, k = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("```")) {
        const code = []; i++;
        while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; }
        out.push(h("pre", { key: k++, style: { background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 12, overflow: "auto", margin: "6px 0", fontFamily: "var(--font-mono)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" } }, code.join("\n")));
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

  function ReportChat({ setTab }) {
    const [messages, setMessages] = useState(INIT_MSGS);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [hoveredMsg, setHoveredMsg] = useState(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [clearOpen, setClearOpen] = useState(false);
    const scrollRef = useRef();
    const taRef = useRef();
    const ivRef = useRef();
    const META = window.VS_REPO_META;

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
                    // Gauges live inside the first summary message
                    m.initial && h("div", { style: { display: "flex", justifyContent: "center", gap: 28, padding: "4px 0 14px", marginBottom: 12, borderBottom: "1px solid var(--border)", flexWrap: "wrap" } },
                      h(window.SegmentArc, { value: META.score, size: 100, label: "Security Risk", color: "oklch(58% 0.26 18)", sublabel: "/ 100" }),
                      h(window.SegmentArc, { value: META.optScore, size: 100, label: "Optimization", color: "oklch(58% 0.28 280)", sublabel: "/ 100" }),
                      h(window.SegmentArc, { value: META.stubScore, size: 100, label: "Completeness", color: "oklch(64% 0.13 180)", sublabel: "/ 100" })),
                    m.thinking ? h(ThinkingDots) : renderMarkdown(m.text, onRef)),
                  // Action row under finished AI messages (copy / feedback)
                  !m.thinking && m.text && h(AiActions, { msg: m, hovered: hoveredMsg === m.id }),
                  // Suggested chips below first AI message (only if no user messages yet)
                  m.initial && !hasUserMessages && h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 } },
                    CHIPS.map((c, i) => h("button", { key: c, className: "chat-chip", style: { animationDelay: i * 55 + "ms", textAlign: "left" }, onClick: () => send(c) }, c)))))),

        // Scroll-to-bottom
        showScrollDown && h("button", { className: "chat-scroll-down", onClick: () => scrollToBottom() }, h(Icons.chevD, { size: 13 }), "Latest"))),

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

          // Toolbar row inside the box: + on the left, send on the right
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
            h("button", { className: "composer-tool", type: "button", title: "Attach context", onClick: () => {} }, h(Icons.plus, { size: 16 })),
            h("div", { style: { flex: 1 } }),
            messages.length > 1 && !streaming && h("div", { style: { position: "relative" } },
              h("button", { className: "btn btn-ghost btn-sm", style: { fontSize: 11.5, color: "var(--text-3)" }, onClick: () => setClearOpen(v => !v) }, "Clear"),
              clearOpen && h("div", { className: "popover", style: { right: 0, bottom: "calc(100% + 8px)", width: 210, padding: 14, zIndex: 20 }, onClick: e => e.stopPropagation() },
                h("div", { style: { fontSize: 13, fontWeight: 650, marginBottom: 5 } }, "Clear conversation?"),
                h("div", { style: { fontSize: 12, color: "var(--text-2)", marginBottom: 10 } }, "Resets to the initial summary."),
                h("div", { style: { display: "flex", gap: 6 } },
                  h("button", { className: "btn btn-ghost btn-sm", onClick: () => setClearOpen(false) }, "Cancel"),
                  h("button", { className: "btn btn-danger btn-sm", onClick: () => { setMessages(INIT_MSGS); setClearOpen(false); setStreaming(false); setEditingId(null); clearInterval(ivRef.current); } }, "Reset")))),
            h("button", { className: "composer-send", disabled: !input.trim() || streaming, onClick: () => send(), title: "Send" },
              streaming
                ? h("div", { className: "spinner", style: { width: 14, height: 14, borderTopColor: "var(--accent-text)" } })
                : h(Icons.arrowUp, { size: 17 })))),

        // Helper line, like Claude's disclaimer
        h("div", { style: { textAlign: "center", fontSize: 11.5, color: "var(--text-3)", marginTop: 9 } }, "Akira can only discuss this scan’s findings."))));
  }
  window.ReportChat = ReportChat;
})();
