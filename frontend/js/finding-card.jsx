// Akira AI — FindingCard (two-panel diff, AI fix, actions)
(function () {
  const React = window.React;
  const { useState } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, Tag, CodeBlock } = window;
  const API = window.AkiraAPI;

  // Line-range label from the normalized finding shape (start + count).
  function lineRange(f) {
    const start = f.start || (Array.isArray(f.lines) ? f.lines[0] : null);
    if (!start) return "";
    const count = Array.isArray(f.lines) ? (f.lines[1] - f.lines[0] + 1) : (f.lines || 1);
    const end = start + Math.max(count, 1) - 1;
    return end > start ? "L" + start + "–" + end : "L" + start;
  }

  function FindingCard({ f, idx, selected, onSelect, onSuppress, toast, nav }) {
    const [fpOpen, setFpOpen] = useState(false);
    const [fpReason, setFpReason] = useState("");
    const [leaving, setLeaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [intentional, setIntentional] = useState(!!(f._raw && f._raw.intentional));
    const [issueState, setIssueState] = useState("idle"); // idle | loading
    const [learnLoading, setLearnLoading] = useState(false);

    const realId = f._raw && f._raw.id;
    const isStub = f.type === "stub";

    // "Learn more": resolve this finding to its Learning Hub class and deep-link
    // straight to it. Real findings hit the resolver (which generates a class on
    // the fly if the category is new); demo findings just open the hub.
    function learnMore() {
      if (!realId || !API) { nav("learning"); return; }
      setLearnLoading(true);
      API.learning.forFinding(realId)
        .then((res) => { nav("learning", (res && res.slug) || null); })
        .catch(() => { nav("learning"); })
        .finally(() => setLearnLoading(false));
    }

    // Persist "mark intentional" for real stub findings; demo stubs just toggle.
    function markIntentional() {
      setIntentional(true);
      toast({ kind: "success", msg: "Marked intentional — excluded from completeness score" });
      setFpOpen(false);
      if (realId && API) {
        API.findings.markIntentional(realId, { reason: fpReason || "Marked from report" }).catch((e) => {
          setIntentional(false);
          toast({ kind: "error", msg: "Couldn't mark intentional: " + ((e && e.message) || "error") });
        });
      }
    }

    // Create a GitHub issue for a real finding; demo findings just confirm.
    function createIssue() {
      if (!realId || !API) {
        toast({ kind: "success", title: "GitHub issue created", msg: f.name });
        return;
      }
      setIssueState("loading");
      API.github.createIssue(realId)
        .then((res) => {
          const num = res && (res.number || res.issue_number);
          const url = res && (res.url || res.html_url);
          toast({ kind: "success", title: "GitHub issue created", msg: (num ? "#" + num + " · " : "") + f.name });
          if (url) window.open(url, "_blank");
        })
        .catch((e) => {
          const msg = (e && e.message) || "Could not create issue";
          toast({ kind: "error", title: "GitHub issue failed", msg: /connect|auth|token/i.test(msg) ? "Connect GitHub in Integrations first." : msg });
        })
        .finally(() => setIssueState("idle"));
    }

    function suppress() {
      setLeaving(true);
      setTimeout(onSuppress, 350);
    }

    const isOpt = f.type === "opt";

    return h("div", { "data-fidx": idx, onClick: onSelect,
      style: {
        transition: "all 350ms var(--ease-out)",
        opacity: leaving ? 0 : 1, transform: leaving ? "translateX(40px) scale(0.97)" : "none",
        maxHeight: leaving ? 0 : 3000, overflow: leaving ? "hidden" : "visible",
      } },
      h("div", { className: "card", style: {
        borderColor: selected ? "var(--accent)" : "var(--border)",
        boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "var(--shadow-card)",
        transition: "border-color var(--dur-micro) ease, box-shadow var(--dur-micro) ease",
      } },
        // Header
        h("div", { style: { padding: "14px 18px 0" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 } },
            h(SevBadge, { sev: f.sev }),
            h("span", { style: { fontSize: 14.5, fontWeight: 650 } }, f.name),
            intentional && h("span", { className: "badge", style: { background: "var(--sev-info-bg)", color: "var(--text-2)" } }, h(Icons.check, { size: 11 }), "Intentional"),
),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
            lineRange(f) && h(Tag, null, lineRange(f)),
            isStub && f.stubCategory && h("span", { className: "badge", style: { background: "var(--sev-stub-bg)", color: "var(--sev-stub)" } }, f.stubCategory),
            !isStub && h(Tag, null, f.category),
            f.cwe !== "—" && h(Tag, null, f.cwe),
            f.owasp && f.owasp !== "—" && h(Tag, null, f.owasp),
            h(Tag, { color: "var(--text-2)" }, f.model),
            f.verified && h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h(Icons.shieldCheck, { size: 12 }), "Verified by 2 models"),
            h("span", { style: { fontSize: 11, color: "var(--text-3)" } }, f.confidence + " confidence")),
          // Optimization impact is a full sentence (e.g. "Reduces network calls by
          // 50%…"), so it gets its own wrapping callout — not a one-line badge,
          // which clipped/overflowed the text.
          isOpt && f.impact && h("div", { style: { display: "flex", gap: 8, margin: "10px 0 0", padding: "9px 12px", borderRadius: "var(--r-md)", background: "var(--sev-opt-bg)", border: "1px solid color-mix(in srgb, var(--sev-opt) 30%, transparent)" } },
            h(Icons.zap || Icons.sparkle, { size: 15, style: { color: "var(--sev-opt)", flexShrink: 0, marginTop: 1 } }),
            h("span", { style: { fontSize: 12.5, lineHeight: 1.5, color: "var(--text-1)" } },
              h("strong", { style: { color: "var(--sev-opt)" } }, "Impact: "), f.impact)),
          h("p", { style: { fontSize: 13, lineHeight: 1.55, color: "var(--text-2)", margin: "10px 0 14px", textWrap: "pretty" } },
            f.summary,
            isStub && f.risk && h("span", { style: { display: "block", marginTop: 8, padding: "8px 11px", borderRadius: "var(--r-md)", background: "var(--sev-critical-bg)", color: "var(--text-1)", fontSize: 12.5 } },
              h("strong", { style: { color: "var(--sev-critical)" } }, "Risk if shipped: "), f.risk
            ),
            f.fixSummary && h("span", { style: { display: "block", marginTop: 6, color: "var(--text-1)" } },
              h("strong", null, isStub ? "Suggested implementation: " : "Recommended Fix: "), f.fixSummary
            )
          )),

        // Two-panel diff labels
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 18px" } },
          h("div", { className: "diff-col", style: { minWidth: 0 } },
            h("div", { style: { fontSize: 11, fontWeight: 650, color: "var(--sev-critical)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 } },
              h(Icons.x, { size: 12, sw: 2.5 }), isStub ? "STUB" : isOpt ? "CURRENT" : "VULNERABLE")),
          h("div", { className: "diff-col", style: { animationDelay: "80ms", minWidth: 0 } },
            h("div", { style: { fontSize: 11, fontWeight: 650, color: "var(--sev-clean)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 } },
              h(Icons.check, { size: 12, sw: 2.5 }), isStub ? "SUGGESTED IMPLEMENTATION" : "FIX"))),

        // Two-panel diff code blocks
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 18px" } },
          h("div", { className: "diff-col", style: { minWidth: 0 } },
            h(CodeBlock, { code: f.code, startLine: f.start, highlight: f.vuln, style: { height: "100%", maxHeight: 220 } })),
          h("div", { className: "diff-col", style: { animationDelay: "80ms", minWidth: 0 } },
            h(CodeBlock, { code: f.fixCode, startLine: f.start, highlight: f.added, kind: "added", style: { height: "100%", maxHeight: 220 } }))),

        // Two-panel diff actions
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "8px 18px 14px" } },
          h("div", { className: "diff-col", style: { minWidth: 0 } }),
          h("div", { className: "diff-col", style: { animationDelay: "80ms", minWidth: 0 } },
            h("div", { style: { display: "flex", gap: 8 } },
              h("button", { className: "btn btn-secondary btn-sm", onClick: (e) => { e.stopPropagation(); setCopied(true); toast({ kind: "success", msg: "Snippet copied" }); setTimeout(() => setCopied(false), 1400); } },
                copied ? h(Icons.check, { size: 13 }) : h(Icons.copy, { size: 13 }), copied ? "Copied" : "Copy snippet"),
              h("button", { className: "btn btn-primary btn-sm", disabled: issueState === "loading", onClick: (e) => { e.stopPropagation(); createIssue(); } },
                issueState === "loading" ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : h(Icons.github, { size: 13 }), issueState === "loading" ? "Creating…" : "Create issue")))),

        // Footer actions
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderTop: "1px solid var(--border)", position: "relative", flexWrap: "wrap" } },
          h("div", { style: { position: "relative" } },
            h("button", { className: "btn btn-ghost btn-sm", onClick: (e) => { e.stopPropagation(); setFpOpen((v) => !v); } },
              h(Icons[isStub ? "check" : "flag"], { size: 13 }), isStub ? "Mark intentional" : "False positive"),
            fpOpen && h("div", { className: "popover", style: { bottom: "calc(100% + 6px)", left: 0, width: 270, padding: 12 }, onClick: (e) => e.stopPropagation() },
              h("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 6 } }, isStub ? "Mark as intentional" : "Mark as false positive"),
              isStub && h("p", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 8, lineHeight: 1.5 } }, "Deliberate TODO or planned work. It's excluded from the completeness score and auto-suppressed on future scans until the code changes."),
              h("textarea", { className: "field", rows: 2, placeholder: "Reason (optional)…", value: fpReason, onChange: (e) => setFpReason(e.target.value), style: { resize: "none", fontSize: 12 } }),
              h("div", { style: { display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" } },
                h("button", { className: "btn btn-ghost btn-sm", onClick: () => setFpOpen(false) }, "Cancel"),
                h("button", { className: "btn btn-primary btn-sm", onClick: () => { if (isStub) { markIntentional(); } else { suppress(); } } }, isStub ? "Mark intentional" : "Suppress")))),
          h("button", { className: "btn btn-ghost btn-sm", disabled: learnLoading, onClick: (e) => { e.stopPropagation(); learnMore(); } },
            learnLoading ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : h(Icons.book, { size: 13 }), learnLoading ? "Opening…" : "Learn more"),

          h("span", { style: { flex: 1 } }),
          h("span", { className: "mono", style: { fontSize: 11, color: "var(--text-3)" } }, f.id, " · est. ", f.effort))));
  }
  window.FindingCard = FindingCard;
})();
