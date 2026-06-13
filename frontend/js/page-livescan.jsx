// Akira AI — Live Scan screen.
// When given a real scanId, it streams progress from the backend WebSocket
// (scan_progress / finding_discovered / scan_completed / scan_failed). With no
// scanId (the Tweaks "Run a demo scan" showcase) it falls back to a timed
// simulation so the animation still demos standalone.
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

  function LiveScan({ repo, scanId, speed, onComplete, onError, onCancel }) {
    const [progress, setProgress] = useState(0);
    const [factIdx, setFactIdx] = useState(0);
    const [factOut, setFactOut] = useState(false);
    const [statusIdx, setStatusIdx] = useState(0);
    const [completing, setCompleting] = useState(false);
    const [findingCount, setFindingCount] = useState(0);

    const speedRef = useRef(speed || 1); speedRef.current = speed || 1;
    const completingRef = useRef(false);
    const wsRef = useRef(null);

    function finish(summary) {
      if (completingRef.current) return;
      completingRef.current = true;
      setProgress(100);
      setCompleting(true);
      setTimeout(() => onComplete && onComplete(summary), 1000);
    }

    // --- Live mode: drive everything from the backend WebSocket. ---
    useEffect(() => {
      if (!scanId || !window.AkiraAPI) return undefined;
      const conn = window.AkiraAPI.scans.openWS(scanId, {
        onEvent(type, payload) {
          switch (type) {
            case "scan_progress":
              if (typeof payload.percent === "number") {
                setProgress((p) => Math.max(p, Math.min(payload.percent, 99)));
              }
              break;
            case "finding_discovered":
              setFindingCount((n) => n + 1);
              break;
            case "scan_completed":
              finish(payload);
              break;
            case "scan_failed":
              if (onError) onError(payload && payload.error);
              break;
            case "scan_cancelled":
              // The app already handled the cancel intent; just stop.
              break;
            default:
              break;
          }
        },
        onError() {
          // A transport error before completion surfaces as a scan error.
          if (!completingRef.current && onError) onError("Lost connection to the scan.");
        },
      });
      wsRef.current = conn;
      return () => conn.close();
    }, [scanId]);

    // --- Demo mode: timed simulation when there's no real scan. ---
    useEffect(() => {
      if (scanId) return undefined; // live mode owns progress
      let last = performance.now();
      const DURATION = 45000; // ms at 1x
      const iv = setInterval(() => {
        const now = performance.now();
        const dt = now - last; last = now;
        if (completingRef.current) return;
        setProgress((p) => {
          const np = Math.min(p + (dt / (DURATION / speedRef.current)) * 100, 100);
          if (np >= 100) finish(null);
          return np;
        });
      }, 40);
      return () => clearInterval(iv);
    }, [scanId]);

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
        findingCount > 0 && h("span", { className: "badge", style: { background: "var(--bg-active)", color: "var(--text-2)", marginRight: 4 } },
          findingCount, findingCount === 1 ? " finding" : " findings"),
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
