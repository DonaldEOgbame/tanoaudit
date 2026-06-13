// Akira AI — Live Scan screen (minimal: percentage + rotating facts + Claude-style shimmer)
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const Icons = window.Icons;

  const FACTS = window.VS_FACTS;

  // Rotating shimmer status lines, like Claude's thinking copy.
  const STATUS = [
    "Reading your code…",
    "Tracing data flows…",
    "Cross-checking with 3 models…",
    "Matching OWASP patterns…",
    "Hunting for injection points…",
    "Mapping the dependency graph…",
    "Scoring severity…",
    "Writing up findings…",
  ];

  function LiveScan({ repo, speed, onComplete, onCancel }) {
    const [progress, setProgress] = useState(0);
    const [factIdx, setFactIdx] = useState(0);
    const [factOut, setFactOut] = useState(false);
    const [statusIdx, setStatusIdx] = useState(0);
    const [completing, setCompleting] = useState(false);

    const speedRef = useRef(speed || 1); speedRef.current = speed || 1;
    const completingRef = useRef(false);

    // Progress driver (interval-based: robust where rAF is throttled)
    useEffect(() => {
      let last = performance.now();
      const DURATION = 45000; // ms at 1x
      const iv = setInterval(() => {
        const now = performance.now();
        const dt = now - last; last = now;
        if (completingRef.current) return;
        setProgress((p) => {
          const np = Math.min(p + (dt / (DURATION / speedRef.current)) * 100, 100);
          if (np >= 100 && !completingRef.current) {
            completingRef.current = true;
            setCompleting(true);
            setTimeout(() => onComplete(), 1000);
          }
          return np;
        });
      }, 40);
      return () => clearInterval(iv);
    }, []);

    // Rotating facts
    useEffect(() => {
      const iv = setInterval(() => {
        setFactOut(true);
        setTimeout(() => { setFactIdx((i) => (i + 1) % FACTS.length); setFactOut(false); }, 480);
      }, 7000);
      return () => clearInterval(iv);
    }, []);

    // Rotating shimmer status line
    useEffect(() => {
      const iv = setInterval(() => {
        setStatusIdx((i) => (i + 1) % STATUS.length);
      }, 3200);
      return () => clearInterval(iv);
    }, []);

    const TICKS = 44;
    const filled = (progress / 100) * TICKS;
    const isLight = (document.documentElement.getAttribute("data-mode") === "light");
    const logoSrc = isLight ? "lightmode-logo.svg" : "logo.svg";

    return h("div", { className: "scan-stage", style: { background: "var(--bg-app)" }, "data-screen-label": "Live Scan" },
      completing && h("div", { className: "scan-complete-flash" }),

      // Minimal top bar
      h("div", { style: { position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 12, padding: "12px 24px" } },
        h("img", { src: logoSrc, style: { height: 48, width: "auto", objectFit: "contain" }, alt: "Akira AI" }),
        h("span", { className: "pulse-dot", style: { width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" } }),
        h("div", { style: { fontSize: 13, color: "var(--text-2)" } }, "Scanning ", h("span", { className: "mono", style: { color: "var(--accent)" } }, repo || "user/ecommerce-api")),
        h("div", { style: { flex: 1 } }),
        h("button", { className: "btn btn-danger btn-sm", onClick: onCancel }, "Cancel"),
      ),

      // Centered stage: percentage + shimmer status + fact
      h("div", { style: { position: "relative", zIndex: 2, height: "calc(100% - 56px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" } },

        h("div", { style: { fontSize: 108, fontWeight: 780, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" } },
          Math.round(progress), h("span", { style: { fontSize: 44, color: "var(--text-3)" } }, "%")),

        // Unique segmented progress bar
        h("div", { className: "seg-bar", style: { width: "min(460px, 74vw)", marginTop: 30 } },
          Array.from({ length: TICKS }).map((_, i) => {
            const on = i < Math.floor(filled);
            const lead = !completing && i === Math.floor(filled) && i < TICKS;
            return h("div", { key: i, className: "seg-tick" + (on || completing ? " on" : "") + (lead ? " lead" : "") });
          })),

        // Shimmer status line (Claude-style)
        h("div", { key: completing ? "done" : statusIdx, className: completing ? "" : "shimmer-text",
          style: { marginTop: 22, fontSize: 15, fontWeight: 550, color: completing ? "var(--accent)" : undefined } },
          completing ? "Finalizing report…" : STATUS[statusIdx]),

        // Rotating fact
        h("div", { style: { marginTop: 36, display: "flex", gap: 12, alignItems: "start", width: "min(560px, 84vw)", textAlign: "left", padding: "0 8px" } },
          h("div", { style: { color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 } }, h(Icons.sparkle, { size: 16 })),
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontSize: 10.5, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)", marginBottom: 3 } }, "Did you know?"),
            h("div", { key: factIdx, className: "fact" + (factOut ? " out" : ""), style: { fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" } }, FACTS[factIdx])),
        ),
      ),
    );
  }
  window.LiveScan = LiveScan;
})();
