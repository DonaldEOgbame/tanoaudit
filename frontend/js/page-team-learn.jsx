// Akira AI — Learning Hub, Integrations
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, Avatar, Switch, Tag, Modal, PageHead, Dropdown } = window;


  // ============ LEARNING HUB ============
  // Per-category framing used to ground the generated explainers.
  const LH_CTX = {
    "Injection": "untrusted input is mixed into an interpreter (SQL, a shell, a template) without separating code from data",
    "Authentication": "the application proves who a user is and keeps that identity safe",
    "Access Control": "the application decides what an authenticated user is allowed to do and reach",
    "Cryptography": "data is protected with hashing, encryption, and secure randomness",
    "Session Management": "user sessions are issued, stored, and invalidated",
    "Configuration": "the runtime, framework, and deployment are configured for production",
    "Cross-Site Scripting": "untrusted content is rendered in the browser without proper encoding",
    "CSRF": "the app distinguishes intentional user actions from forged cross-site requests",
    "SSRF": "the server is made to issue requests to attacker-chosen destinations",
    "File Handling": "files are uploaded, named, stored, and served",
    "Information Disclosure": "the system reveals internal details through responses, errors, or logs",
    "Validation": "data crossing a trust boundary is validated and normalized",
    "Secrets & Credentials": "credentials, keys, and tokens are stored, transmitted, and rotated",
    "Deserialization": "serialized data from outside the trust boundary is turned back into live objects",
    "Business Logic": "the app's intended workflows and their assumptions about order, timing, and values hold",
    "API Security": "API endpoints authenticate callers, authorize objects, and bound their inputs",
    "Dependencies": "third-party code is pulled in and trusted at build and run time",
    "Logging & Monitoring": "security-relevant events are recorded without leaking sensitive data",
    "Denial of Service": "compute, memory, and connections are bounded against abuse",
    "Code Hygiene": "the code avoids patterns that quietly become security or reliability risks",
  };

  function lhSlug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  // PortSwigger Web Security Academy topic mapping for known classes.
  const LH_PS = { "sql injection": "sql-injection", "command injection": "os-command-injection",
    "xxe": "xxe", "template injection": "server-side-template-injection", "idor": "access-control/idor",
    "cors misconfiguration": "cors", "ssrf": "ssrf", "path": "file-path-traversal",
    "deserialization": "deserialization", "session fixation": "session-fixation",
    "cross-site scripting": "cross-site-scripting", "xss": "cross-site-scripting", "csrf": "csrf" };

  function lhPortswigger(name) {
    const k = name.toLowerCase();
    for (const frag in LH_PS) if (k.includes(frag)) return "https://portswigger.net/web-security/" + LH_PS[frag];
    return "https://portswigger.net/web-security/all-topics";
  }

  function lhResources(name, cat, cwe, owasp) {
    const q = encodeURIComponent(name + " vulnerability");
    const r = [];
    const cweNum = (cwe || "").match(/(\d+)/);
    if (cweNum) r.push({ title: cwe + " — definition & mitigations", url: "https://cwe.mitre.org/data/definitions/" + cweNum[1] + ".html", source: "CWE" });
    r.push({ title: "OWASP Cheat Sheet Series", url: "https://cheatsheetseries.owasp.org/", source: "OWASP" });
    if (owasp && owasp !== "—") r.push({ title: "OWASP Top 10 — " + owasp, url: "https://owasp.org/Top10/", source: "OWASP" });
    r.push({ title: "Web Security Academy: " + name, url: lhPortswigger(name), source: "PortSwigger" });
    r.push({ title: "Web security fundamentals", url: "https://developer.mozilla.org/en-US/docs/Web/Security", source: "MDN" });
    r.push({ title: "SANS secure-coding resources", url: "https://www.sans.org/security-resources/", source: "SANS" });
    r.push({ title: "Video: " + name + " explained", url: "https://www.youtube.com/results?search_query=" + q + "%20explained", source: "YouTube" });
    r.push({ title: "Articles & write-ups", url: "https://www.google.com/search?q=" + q + "%20remediation", source: "Articles" });
    return r;
  }

  function lhFaq(name, cat, cwe, owasp, sev, meta) {
    const ctx = LH_CTX[cat] || "application security";
    const nlow = name.toLowerCase();
    
    const whatAns = meta?.what || (name + " is a " + cat + " weakness — it concerns " + ctx + ". At its core it occurs when this part of the system makes an unsafe assumption: that input is trustworthy, that a check already happened, or that a default is secure when it isn't. It's tracked as " + (cwe || "a recognised weakness class") + (owasp && owasp !== "—" ? " and maps to OWASP " + owasp + "." : "."));
    const exploitAns = meta?.exploit || ("An attacker first probes — sending crafted input, replaying or tampering with requests, or reading client-side code and error messages. Once they confirm " + name + " is present, they escalate it into data access, code execution, or account takeover depending on what the vulnerable component can reach.");
    const exampleAns = meta?.example || ("There are many public CVEs and breach post-mortems involving " + cat + " weaknesses like " + name + ". A representative scenario: a team ships a feature under deadline, an unsafe default slips through review, and months later a researcher finds it in production and demonstrates impact. The fix is usually small; the exposure window is what hurts.");
    const fixAns = meta?.fix || ("Enforce the missing control at a single, well-tested choke point rather than sprinkling ad-hoc checks. Prefer framework- or platform-provided protections over hand-rolled ones, validate and encode at the boundary, fail closed, and add a regression test that reproduces the issue so it can't silently return.");

    return [
      { q: "What is " + name + "?",
        a: whatAns,
        adv: "Formally, " + name + " is the gap between the developer's mental model and the system's actual behaviour under adversarial input. It's rated '" + sev + "' here because of the typical blast radius once the assumption is violated." },
      { q: "Why does it happen?",
        a: "Usually one of a few root causes: missing or inconsistent validation, trusting data that crossed a boundary, copy-pasted or auto-generated boilerplate with insecure defaults, or a check that exists on one code path but not another. In " + cat + ", the mistake is specifically about " + ctx + "." },
      { q: "How do attackers exploit it?",
        a: exploitAns,
        adv: "Sophisticated exploitation chains " + nlow + " with other findings: pivoting internally, exfiltrating over side channels (DNS, timing), or persisting through scheduled jobs. Automated tooling makes discovery cheap, so obscurity offers no protection." },
      { q: "What's a real-world example?",
        a: exampleAns },
      { q: "How do I know if my code is affected?",
        a: "Look for the tell-tale patterns of " + name + ": places where " + ctx + " is handled without an explicit, centralised safeguard. Grep for the risky APIs, review the paths that handle untrusted input or privileged actions, and confirm a control runs on every path — not just the happy path." },
      { q: "How do I fix it?",
        a: fixAns,
        adv: "Where possible make the unsafe pattern impossible to express — a typed wrapper, a lint rule, or an architectural change — so future code can't reintroduce " + name + ". Add a secondary control so a single mistake isn't catastrophic." },
      { q: "How do I prevent it going forward?",
        a: "Bake the protection into your defaults and pipeline: secure templates, a shared validation/authorization layer, dependency and secret scanning, and review checklists that call out " + cat + " risks. Re-scan on every change so regressions are caught before production." },
    ];
  }

  const LH_SOURCE_COLORS = { CWE: "#f59e0b", OWASP: "#10b981", PortSwigger: "#ff6633", MDN: "#7aa2f7", SANS: "#c792ea", YouTube: "#ef4444", Articles: "var(--text-3)" };

  function LearningPage() {
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(null);
    const [advanced, setAdvanced] = useState(false);
    // The .vs-page scroll container only remounts on page change, not when we
    // switch between the class list and a class detail. Without this, opening a
    // class keeps the list's scroll offset and lands you mid-article. Reset to
    // the top whenever the selection changes.
    useEffect(() => {
      const scroller = document.querySelector(".vs-page");
      if (scroller) scroller.scrollTop = 0;
    }, [sel]);
    const cats = window.VS_CATEGORIES;
    const entries = window.VS_LEARNING;

    // generate class names per category
    const classesFor = (cat) => {
      const list = window.VS_TAXONOMY?.[cat] || [];
      return list.map(c => c.name);
    };

    if (sel) {
      const name = sel.name || sel;
      const meta = entries[name] || {};
      const category = meta.category || sel.cat || "Injection";
      const cwe = meta.cwe || "CWE-000";
      const owasp = meta.owasp || "—";
      const severity = meta.severity || "high";
      const summary = name + " is a " + category + " weakness affecting " + (LH_CTX[category] || "application security") + ".";
      const faq = lhFaq(name, category, cwe, owasp, severity, meta);
      const resources = lhResources(name, category, cwe, owasp);

      return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 760 }, "data-screen-label": "Learning Detail" },
        h("button", { className: "btn btn-ghost btn-sm", style: { marginBottom: 14 }, onClick: () => setSel(null) }, h(Icons.chevL, { size: 14 }), "All classes"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" } },
          h("h1", { style: { fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em" } }, name),
          h(SevBadge, { sev: severity }), h(Tag, null, cwe), owasp !== "—" && h(Tag, null, owasp), h(Tag, null, category)),
        h("p", { style: { fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 16, textWrap: "pretty" } }, summary),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid var(--border)" } },
          h("span", { style: { fontSize: 12.5, color: advanced ? "var(--text-2)" : "var(--text-1)", fontWeight: advanced ? 400 : 600 } }, "Beginner"),
          h(Switch, { on: advanced, onChange: setAdvanced }),
          h("span", { style: { fontSize: 12.5, color: advanced ? "var(--text-1)" : "var(--text-2)", fontWeight: advanced ? 600 : 400 } }, "Advanced"),
          h("span", { style: { fontSize: 11.5, color: "var(--text-3)", marginLeft: 4 } }, "— toggle for deeper technical detail")),

        // Q&A explainer — questions are their own headings, answers always visible
        faq.map((item, i) =>
          h("div", { key: i, className: "card stagger-in", style: { padding: "18px 22px", marginBottom: 12 } },
            h("h3", { style: { fontSize: 16, fontWeight: 650, marginBottom: 9, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 9 } },
              h("span", { style: { width: 22, height: 22, borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 } }, "Q"),
              item.q),
            h("p", { style: { fontSize: 13.5, lineHeight: 1.65, color: "var(--text-2)", textWrap: "pretty" } }, item.a),
            advanced && item.adv && h("div", { style: { marginTop: 10, padding: "10px 13px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", borderLeft: "2.5px solid var(--accent)" } },
              h("div", { style: { fontSize: 10.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Going deeper"),
              h("p", { style: { fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" } }, item.adv)))),

        // External resources
        h("div", { style: { marginTop: 22 } },
          h("h3", { style: { fontSize: 13, fontWeight: 650, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 } }, "External resources"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 8 } },
            resources.map((res, i) =>
              h("a", { key: i, href: res.url, target: "_blank", rel: "noopener noreferrer", className: "card card-hover",
                style: { padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, textDecoration: "none" } },
                h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: LH_SOURCE_COLORS[res.source] || "var(--text-3)", flexShrink: 0 } }),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, res.title),
                  h("div", { style: { fontSize: 11, color: "var(--text-3)" } }, res.source)),
                h(Icons.link, { size: 13, style: { color: "var(--text-3)", flexShrink: 0 } }))))));
    }

    const filtered = cats.map((cat) => ({ cat, classes: classesFor(cat).filter((c) => c.toLowerCase().includes(q.toLowerCase())) }))
      .filter((g) => g.classes.length > 0 || q === "");

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Learning Hub" },
      h(PageHead, { title: "Learning Hub", desc: "201 classes across 22 categories — security, optimization, and stubs — full explainers, for every level." }),
      h("div", { style: { position: "relative", marginBottom: 20, maxWidth: 440 } },
        h(Icons.search, { size: 16, style: { position: "absolute", left: 13, top: 11, color: "var(--text-3)" } }),
        h("input", { className: "field", style: { paddingLeft: 38, padding: "10px 12px 10px 38px", fontSize: 14 }, placeholder: "Search vulnerability classes…", value: q, onChange: (e) => setQ(e.target.value) })),
      filtered.map(({ cat, classes }) =>
        h("div", { key: cat, style: { marginBottom: 22 } },
          h("h3", { style: { fontSize: 13, fontWeight: 650, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 } }, cat,
            h("span", { style: { fontWeight: 500, color: "var(--text-3)", marginLeft: 8, textTransform: "none", letterSpacing: 0 } }, classes.length + " classes")),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 } },
            classes.map((c) =>
              h("button", { key: c, className: "card card-hover", style: { padding: "11px 14px", textAlign: "left", display: "flex", alignItems: "center", gap: 9 }, onClick: () => setSel({ name: c, cat }) },
                h(Icons.book, { size: 14, style: { color: "var(--accent)", flexShrink: 0 } }),
                h("span", { style: { fontSize: 12.5, fontWeight: 550 } }, c)))))));
  }
  window.LearningPage = LearningPage;

  // ============ INTEGRATIONS ============
  function IntegrationsPage({ toast }) {
    const [connected, setConnected] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [secretShown, setSecretShown] = useState(false);
    const [autoIssues, setAutoIssues] = useState(true);
    const [statusChecks, setStatusChecks] = useState(true);
    const [blockMerge, setBlockMerge] = useState(true);
    const [triggers, setTriggers] = useState({ push: true, pr: true, release: false });
    const deliveries = [
      { event: "push", status: 200, when: "2h ago" }, { event: "pull_request", status: 200, when: "5h ago" },
      { event: "push", status: 200, when: "yesterday" }, { event: "release", status: 500, when: "2d ago" },
    ];

    function Section({ title, desc, children }) {
      return h("div", { className: "card", style: { marginBottom: 16 } },
        h("div", { style: { padding: "14px 20px", borderBottom: "1px solid var(--border)" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650 } }, title),
          desc && h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 2 } }, desc)),
        h("div", { style: { padding: "16px 20px" } }, children));
    }
    function Row({ label, desc, on, set }) {
      return h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0" } },
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontSize: 13, fontWeight: 550 } }, label),
          desc && h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, desc)),
        h(Switch, { on, onChange: set }));
    }

    return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 760 }, "data-screen-label": "Integrations" },
      h(PageHead, { title: "Integrations", desc: "Connect Akira AI to your development workflow." }),
      // Connection card
      h("div", {
        className: "card card-hover",
        style: {
          padding: 20,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          cursor: connected ? "pointer" : "default"
        },
        onClick: () => { if (connected) setExpanded((exp) => !exp); }
      },
        h("div", { style: { width: 44, height: 44, borderRadius: 11, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Icons.github, { size: 24 })),
        connected
          ? h(React.Fragment, null,
              h("div", { style: { flex: 1 } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                  h("span", { style: { fontSize: 14.5, fontWeight: 650 } }, "GitHub"),
                  h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h("span", { className: "dot" }), "Connected")),
                h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginTop: 3 } }, "@alexrivera · scopes: repo, read:org · connected Mar 2026")),
              h("button", {
                className: "btn btn-secondary btn-sm",
                onClick: (e) => {
                  e.stopPropagation();
                  setConnected(false);
                  setExpanded(false);
                  toast({ kind: "info", msg: "GitHub disconnected" });
                }
              }, "Disconnect"),
              h("div", { style: { color: "var(--text-3)", display: "flex", alignItems: "center", width: 20, justifyContent: "center" } }, h(expanded ? Icons.chevD : Icons.chevR, { size: 16 }))
            )
          : h(React.Fragment, null,
              h("div", { style: { flex: 1 } },
                h("div", { style: { fontSize: 14.5, fontWeight: 650 } }, "GitHub"),
                h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginTop: 3 } }, "Connect to scan private repos and enable auto-scan triggers.")),
              h("button", { className: "btn btn-primary", onClick: () => { setConnected(true); toast({ kind: "success", msg: "GitHub connected" }); } }, h(Icons.github, { size: 15 }), "Connect GitHub"))),
      connected && expanded && h(React.Fragment, null,
        h(Section, { title: "Repository access" },
          h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
            h("button", { className: "sel-card", style: { flex: 1, padding: "10px 14px", fontSize: 12.5 } }, "All repositories"),
            h("button", { className: "sel-card sel", style: { flex: 1, padding: "10px 14px", fontSize: 12.5 } }, "Selected repositories", h("div", { className: "sel-check" }, h(Icons.check, { size: 13, sw: 2.5 })))),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
            window.VS_GH_REPOS.slice(0, 5).map((r) => h(Tag, { key: r.name }, r.name)),
            h("button", { className: "btn btn-ghost btn-sm" }, "Edit list"))),
        h(Section, { title: "Auto-scan triggers", desc: "Run scans automatically on repository events." },
          h(Row, { label: "On push to default branch", on: triggers.push, set: (v) => setTriggers((t) => Object.assign({}, t, { push: v })) }),
          h(Row, { label: "On pull request", desc: "Scans the PR diff only — fast", on: triggers.pr, set: (v) => setTriggers((t) => Object.assign({}, t, { pr: v })) }),
          h(Row, { label: "On release tag", on: triggers.release, set: (v) => setTriggers((t) => Object.assign({}, t, { release: v })) }),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 } },
            h("div", null, h("label", { className: "flabel" }, "Branch filters"), h("input", { className: "field mono", defaultValue: "main, release/*", style: { fontSize: 12 } })),
            h("div", null, h("label", { className: "flabel" }, "Ignore paths"), h("input", { className: "field mono", defaultValue: "dist/**, *.test.js", style: { fontSize: 12 } })))),
        h(Section, { title: "Webhook", desc: "Akira AI receives repository events at this endpoint." },
          h("label", { className: "flabel" }, "Payload URL"),
          h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
            h("input", { className: "field mono", readOnly: true, value: "https://hooks.akira.ai/gh/acme-7281", style: { fontSize: 12 } }),
            h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, onClick: () => toast({ kind: "success", msg: "URL copied" }) }, h(Icons.copy, { size: 13 }))),
          h("label", { className: "flabel" }, "Secret"),
          h("div", { style: { display: "flex", gap: 6, marginBottom: 14 } },
            h("input", { className: "field mono", readOnly: true, type: secretShown ? "text" : "password", value: "whsec_8f2k1mqpz7", style: { fontSize: 12 } }),
            h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, onClick: () => setSecretShown((v) => !v) }, h(secretShown ? Icons.eyeOff : Icons.eye, { size: 13 })),
            h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, onClick: () => toast({ kind: "success", msg: "Secret regenerated" }) }, h(Icons.refresh, { size: 13 }), "Regenerate")),
          h("label", { className: "flabel" }, "Recent deliveries"),
          h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
            deliveries.map((d, i) =>
              h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12 } },
                h("span", { className: "mono", style: { flex: 1 } }, d.event),
                h("span", { className: "badge", style: { background: d.status === 200 ? "var(--sev-clean-bg)" : "var(--sev-critical-bg)", color: d.status === 200 ? "var(--sev-clean)" : "var(--sev-critical)" } }, d.status),
                h("span", { style: { color: "var(--text-3)" } }, d.when))))),
        h(Section, { title: "GitHub Issues", desc: "Automatically create issues from findings." },
          h(Row, { label: "Auto-create issues", desc: "For findings at or above the threshold", on: autoIssues, set: setAutoIssues }),
          autoIssues && h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 } },
            h("div", null, h("label", { className: "flabel" }, "Severity threshold"), h(Dropdown, { width: "100%", defaultValue: "High", options: ["Critical", "High", "Medium"] })),
            h("div", null, h("label", { className: "flabel" }, "Default assignee"), h(Dropdown, { width: "100%", options: ["Unassigned", "@alexrivera", "@devteam"] })),
            h("div", null, h("label", { className: "flabel" }, "Label mapping"), h("input", { className: "field mono", defaultValue: "security, akira-ai", style: { fontSize: 12 } })),
            h("div", null, h("label", { className: "flabel" }, "Issue template"), h("button", { className: "btn btn-secondary", style: { width: "100%" } }, h(Icons.edit, { size: 13 }), "Edit template")))),
        h(Section, { title: "Status checks", desc: "Post scan results to commits and PRs." },
          h(Row, { label: "Post commit status", on: statusChecks, set: setStatusChecks }),
          h(Row, { label: "Block PR merge on Critical", desc: "Requires branch protection on the repo", on: blockMerge, set: setBlockMerge }),
          h("div", { style: { marginTop: 8 } },
            h("label", { className: "flabel" }, "Check name"),
            h("input", { className: "field mono", defaultValue: "akira-ai/security", style: { fontSize: 12, maxWidth: 280 } })))),
      h("h3", { style: { fontSize: 15, fontWeight: 650, marginTop: 28, marginBottom: 12 } }, "Other Integrations"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 } },
        [
          { name: "GitLab", desc: "Connect GitLab repositories to scan code and sync status checks.", icon: Icons.gitlab },
          { name: "Bitbucket", desc: "Connect Bitbucket workspaces to automate security workflows on push.", icon: Icons.bitbucket },
          { name: "Slack", desc: "Post real-time vulnerability alerts and optimization recommendations to Slack.", icon: Icons.slack },
          { name: "Jira", desc: "Sync security findings directly into Jira issues for your dev team.", icon: Icons.jira },
          { name: "Datadog", desc: "Export code health metrics and scan events to Datadog dashboards.", icon: Icons.datadog },
          { name: "Sentry", desc: "Correlate static code optimizations with real-time runtime error traces.", icon: Icons.sentry }
        ].map((item) =>
          h("div", { key: item.name, className: "card", style: { padding: 18, display: "flex", gap: 14, alignItems: "start" } },
            h("div", { style: { width: 36, height: 36, borderRadius: 8, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 } },
              h(item.icon, { size: 18, style: { color: "var(--text-2)" } })),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontSize: 13.5, fontWeight: 650 } }, item.name),
              h("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 4, lineHeight: 1.4 } }, item.desc),
              h("button", { className: "btn btn-secondary btn-sm", disabled: true, style: { marginTop: 12, fontSize: 11, padding: "4px 8px", cursor: "not-allowed" } }, "Coming Soon"))))));
  }
  window.IntegrationsPage = IntegrationsPage;
})();
