// Akira AI — FindingCard (two-panel diff, AI fix, actions)
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { SevBadge, Tag, CodeBlock } = window;

  function FindingCard({ f, idx, selected, onSelect, onSuppress, toast, nav }) {
    const [fpOpen, setFpOpen] = useState(false);
    const [fpReason, setFpReason] = useState("");
    const [leaving, setLeaving] = useState(false);
    const [fixState, setFixState] = useState("idle"); // idle | loading | done
    const [fixText, setFixText] = useState("");
    const [copied, setCopied] = useState(false);
    const [intentional, setIntentional] = useState(false);

    const isStub = f.type === "stub";
    const FULL_FIX = isStub
      ? "Completing the stub in " + f.file + "…\n\n1. " + f.fixSummary + "\n2. Implemented the behavior the function name and signature imply.\n3. Added the missing validation / error paths.\n\nThe completed implementation is shown in the diff panel. Review the assumptions before merging."
      : "Applying fix to " + f.file + "…\n\n1. " + f.fixSummary + "\n2. Added input validation guard upstream.\n3. Updated unit tests: " + f.file.replace("src/", "test/").replace(".js", ".test.js") + "\n\nThe corrected implementation is shown in the diff panel. This change is backwards-compatible and requires no migration.";

    function genFix() {
      setFixState("loading"); setFixText("");
      let i = 0;
      const iv = setInterval(() => {
        i += Math.ceil(Math.random() * 4 + 2);
        setFixText(FULL_FIX.slice(0, i));
        if (i >= FULL_FIX.length) { clearInterval(iv); setFixState("done"); }
      }, 30);
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
            h(Tag, null, "L" + f.lines[0] + "–" + f.lines[1]),
            isStub && f.stubCategory && h("span", { className: "badge", style: { background: "var(--sev-stub-bg)", color: "var(--sev-stub)" } }, f.stubCategory),
            !isStub && h(Tag, null, f.category),
            f.cwe !== "—" && h(Tag, null, f.cwe),
            f.owasp && f.owasp !== "—" && h(Tag, null, f.owasp),
            h(Tag, { color: "var(--text-2)" }, f.model),
            f.verified && h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h(Icons.shieldCheck, { size: 12 }), "Verified by 2 models"),
            h("span", { style: { fontSize: 11, color: "var(--text-3)" } }, f.confidence + " confidence"),
            isOpt && f.impact && h("span", { className: "badge", style: { background: "var(--sev-opt-bg)", color: "var(--sev-opt)" } }, f.impact + " impact")),
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
              fixState === "idle" && h("button", { className: "btn btn-primary btn-sm", onClick: (e) => { e.stopPropagation(); genFix(); } },
                h(Icons.sparkle, { size: 13 }), isStub ? "Generate Implementation" : "Generate Full Fix")),
            // streaming fix
            fixState !== "idle" && h("div", { className: "card", style: { marginTop: 10, padding: "12px 14px", background: "var(--bg-inset)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 8 } },
                fixState === "loading" ? h("div", { className: "spinner", style: { width: 13, height: 13 } }) : h(Icons.sparkle, { size: 14, style: { color: "var(--accent)" } }),
                h("span", { style: { fontSize: 12, fontWeight: 600, color: fixState === "loading" ? "var(--text-2)" : "var(--accent)" } },
                  fixState === "loading" ? (isStub ? "Generating implementation…" : "Generating full fix…") : (isStub ? "Implementation generated" : "Fix generated"))),
              h("pre", { className: "mono", style: { fontSize: 11.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-1)" } },
                fixText, fixState === "loading" && h("span", { className: "term-cursor" })),
              fixState === "done" && h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
                h("button", { className: "btn btn-primary btn-sm", onClick: () => toast({ kind: "success", msg: "Fix applied as patch file" }) }, "Download patch"),
                h("button", { className: "btn btn-ghost btn-sm", onClick: () => setFixState("idle") }, "Dismiss"))))),

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
                h("button", { className: "btn btn-primary btn-sm", onClick: () => { if (isStub) { setIntentional(true); toast({ kind: "success", msg: "Marked intentional — excluded from completeness score" }); setFpOpen(false); } else { suppress(); } } }, isStub ? "Mark intentional" : "Suppress")))),
          h("button", { className: "btn btn-ghost btn-sm", onClick: (e) => { e.stopPropagation(); nav("learning"); } }, h(Icons.book, { size: 13 }), "Learn more"),
          h("button", { className: "btn btn-ghost btn-sm", onClick: (e) => { e.stopPropagation(); toast({ kind: "success", title: "GitHub issue created", msg: "#214 · " + f.name }); } }, h(Icons.github, { size: 13 }), "Create issue"),

          h("span", { style: { flex: 1 } }),
          h("span", { className: "mono", style: { fontSize: 11, color: "var(--text-3)" } }, f.id, " · est. ", f.effort))));
  }
  window.FindingCard = FindingCard;
})();
