// VaultScan — Dashboard (returning + first-run onboarding)
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const { CountUp, SevDot, SevBadge, Avatar, ProgressBar, Ring, scoreColor } = window;

  function Stat({ label, value, sub, color, icon, suffix }) {
    return h("div", { className: "card card-hover", style: { padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h("span", { style: { fontSize: 12.5, color: "var(--text-2)", fontWeight: 550 } }, label),
        icon && h("span", { style: { color: color || "var(--text-3)", display: "flex" } }, h(Icons[icon], { size: 16 })),
      ),
      h("div", { style: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: color || "var(--text-1)", fontVariantNumeric: "tabular-nums" } },
        h(CountUp, { value, suffix: suffix || "" })),
      sub && h("div", { style: { fontSize: 11.5, color: "var(--text-3)" } }, sub),
    );
  }

  // Dashboard chart data
  const SCAN_VOLUME = [
    ["Jul", 6], ["Aug", 9], ["Sep", 7], ["Oct", 11], ["Nov", 10], ["Dec", 12],
    ["Jan", 9], ["Feb", 13], ["Mar", 11], ["Apr", 14], ["May", 12], ["Jun", 17],
  ].map(([label, value], i) => ({ label, value, full: label + " " + (i < 6 ? "2025" : "2026") }));
  const SEV_MIX = [
    { label: "Critical", n: 7, color: "var(--sev-critical)" },
    { label: "High", n: 18, color: "var(--sev-high)" },
    { label: "Medium", n: 26, color: "var(--sev-medium)" },
    { label: "Low", n: 12, color: "var(--sev-low)" },
  ];

  function Dashboard({ demoState, nav, onNewScan, onSample }) {
    if (demoState === "first-run") return h(FirstRun, { onNewScan, onSample });

    const scans = window.VS_SCANS;
    const activity = window.VS_ACTIVITY;
    const totalCrit = 7;
    return h("div", { className: "vs-page-pad vs-page-enter" },
      h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 } },
        h("div", null,
          h("h1", { style: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } }, "Welcome back, Alex"),
          h("p", { style: { color: "var(--text-2)", fontSize: 13.5, marginTop: 2 } }, "Here's the security posture across your repositories."),
        ),
        h("button", { className: "btn btn-primary btn-lg", onClick: onNewScan }, h(Icons.plus, { size: 17, sw: 2.2 }), "New Scan"),
      ),

      // Stat cards
      h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 } },
        h(Stat, { label: "Total scans", value: 142, sub: "+12 this month", icon: "list" }),
        h(Stat, { label: "Open Criticals", value: totalCrit, sub: "across 3 repos", color: "var(--sev-critical)", icon: "alert" }),
        h(Stat, { label: "Watchlist alerts", value: 4, sub: "2 repos changed", color: "var(--sev-high)", icon: "bell" }),
        h(Stat, { label: "Avg. plan progress", value: 64, suffix: "%", sub: "3 active plans", color: "var(--accent)", icon: "sliders" }),
      ),

      // Charts row
      h("div", { style: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginBottom: 24, alignItems: "stretch" } },
        h("div", { className: "card", style: { padding: "16px 20px" } },
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 } },
            h("div", null,
              h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Scan volume"),
              h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 1 } }, "Scans per month across all repos")),
            h("span", { className: "badge", style: { background: "var(--accent-soft)", color: "var(--accent)" } }, "\u2191 42% this month")),
          h(window.RoundedBars, { data: SCAN_VOLUME, highlightIndex: 11, height: 160,
            tipFor: (i) => SCAN_VOLUME[i].value + " scans \u00b7 " + SCAN_VOLUME[i].full })),
        h("div", { className: "card", style: { padding: "16px 20px", display: "flex", flexDirection: "column" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Open findings"),
          h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 1 } }, "By severity, all repos"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 20, flex: 1, marginTop: 10 } },
            h(window.RingStat, { segments: SEV_MIX.map((s) => ({ value: s.n, color: s.color })), size: 144, stroke: 12,
              centerBig: SEV_MIX.reduce((s, x) => s + x.n, 0), centerSmall: "open findings" }),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 9, flex: 1 } },
              SEV_MIX.map((s) =>
                h("div", { key: s.label, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 } },
                  h("span", { className: "sev-dot", style: { width: 8, height: 8, background: s.color } }),
                  h("span", { style: { flex: 1, color: "var(--text-2)" } }, s.label),
                  h("span", { style: { fontWeight: 650, fontVariantNumeric: "tabular-nums" } }, s.n)))))),
      ),

      h("div", { style: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "stretch" } },
        // Recent scans table
        h("div", { className: "card", style: { overflow: "hidden" } },
          h("div", { style: { padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" } },
            h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Recent scans"),
            h("button", { className: "btn btn-ghost btn-sm", onClick: () => nav("scans") }, "View all", h(Icons.chevR, { size: 13 })),
          ),
          h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
            h("thead", null, h("tr", { style: { color: "var(--text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" } },
              ["Repository", "Risk", "Findings", "Scanned"].map((c, i) =>
                h("th", { key: c, style: { textAlign: i > 0 ? "right" : "left", padding: "8px 18px", fontWeight: 600 } }, c)))),
            h("tbody", null, scans.map((s) =>
              h("tr", { key: s.id, onClick: () => nav("report"), style: { cursor: "pointer", borderTop: "1px solid var(--border)" },
                onMouseEnter: (e) => e.currentTarget.style.background = "var(--bg-hover)",
                onMouseLeave: (e) => e.currentTarget.style.background = "transparent" },
                h("td", { style: { padding: "11px 18px", display: "flex", alignItems: "center", gap: 9 } },
                  h(SevDot, { sev: s.sev }), h("span", { style: { fontWeight: 550 } }, s.repo)),
                h("td", { style: { textAlign: "right", padding: "11px 18px" } },
                  h("span", { style: { fontWeight: 650, color: scoreColor(s.score), fontVariantNumeric: "tabular-nums" } }, s.score)),
                h("td", { style: { textAlign: "right", padding: "11px 18px", fontVariantNumeric: "tabular-nums", color: "var(--text-2)" } }, s.issues),
                h("td", { style: { textAlign: "right", padding: "11px 18px", color: "var(--text-3)", whiteSpace: "nowrap" } }, s.when),
              ))),
          ),
        ),

        // Activity feed
        h("div", { className: "card", style: { padding: "13px 4px 8px" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650, padding: "0 16px 10px" } }, "Activity"),
          h("div", { style: { display: "flex", flexDirection: "column" } },
            activity.map((a, i) => {
              const iconMap = { scan: "list", flag: "flag", reroute: "refresh", github: "github", check: "check", bell: "bell" };
              return h("div", { key: i, style: { display: "flex", gap: 10, padding: "9px 16px", alignItems: "flex-start" } },
                h("div", { style: { width: 26, height: 26, borderRadius: 7, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text-2)" } },
                  h(Icons[iconMap[a.icon]] || Icons.dot, { size: 14 })),
                h("div", { style: { fontSize: 12.5, lineHeight: 1.45 } },
                  h("span", { style: { fontWeight: 600 } }, a.who), " ",
                  h("span", { style: { color: "var(--text-2)" } }, a.action), " ",
                  h("span", { style: { fontWeight: 550 } }, a.target),
                  h("div", { style: { fontSize: 11, color: "var(--text-3)", marginTop: 1 } }, a.when),
                ),
              );
            })),
        ),
      ),
    );
  }
  window.Dashboard = Dashboard;

  // ---- First-run onboarding ----
  function FirstRun({ onNewScan, onSample }) {
    const [done, setDone] = useState({ 1: false, 2: false, 3: false });
    const steps = [
      { n: 1, title: "Connect GitHub", desc: "Authorize Akira AI to read the repositories you want to scan.", cta: "Connect", icon: "github" },
      { n: 2, title: "Add your free API keys", desc: "Bring keys for Gemini, Groq, or OpenRouter — all have generous free tiers.", cta: "Add keys", icon: "key" },
      { n: 3, title: "Run your first scan", desc: "Point Akira AI at a repo and watch both engines go to work.", cta: "New scan", icon: "shield" },
    ];
    const completedCount = Object.values(done).filter(Boolean).length;

    return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 920 } },
      // Hero
      h("div", { style: { textAlign: "center", padding: "30px 0 28px" } },
        h(FloatingShield, null),
        h("h1", { style: { fontSize: 30, fontWeight: 750, letterSpacing: "-0.025em", marginTop: 18 } }, "Welcome to Akira AI"),
        h("p", { style: { color: "var(--text-2)", fontSize: 15, maxWidth: 520, margin: "8px auto 0", textWrap: "pretty" } },
          "One scan, two engines — find ", h("strong", { style: { color: "var(--text-1)" } }, "187 vulnerability classes"),
          " and optimize performance, quality and scale at the same time."),
      ),

      // Onboarding card
      h("div", { className: "card", style: { padding: 24, marginBottom: 18 } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
          h("h3", { style: { fontSize: 15, fontWeight: 650 } }, "Get started in 3 steps"),
          h("span", { style: { fontSize: 12.5, color: "var(--text-2)" } }, completedCount + " of 3 complete"),
        ),
        h("div", { style: { marginBottom: 16 } }, h(ProgressBar, { value: (completedCount / 3) * 100 })),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
          steps.map((s) => {
            const isDone = done[s.n];
            return h("div", { key: s.n, style: {
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: "var(--r-md)",
              background: isDone ? "var(--accent-soft)" : "var(--bg-inset)", border: "1px solid " + (isDone ? "transparent" : "var(--border)"),
              transition: "background var(--dur-med) var(--ease-out)",
            } },
              h("div", { style: {
                width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: isDone ? "var(--accent)" : "var(--bg-surface)", color: isDone ? "var(--accent-text)" : "var(--text-2)",
                border: "1px solid " + (isDone ? "transparent" : "var(--border)"), transition: "all var(--dur-med) var(--ease-spring)",
              } }, isDone ? h(Icons.check, { size: 18, sw: 2.4 }) : h(Icons[s.icon], { size: 17 })),
              h("div", { style: { flex: 1 } },
                h("div", { style: { fontSize: 13.5, fontWeight: 600, textDecoration: isDone ? "none" : "none" } }, s.title),
                h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginTop: 1 } }, s.desc),
              ),
              isDone
                ? h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h(Icons.check, { size: 12 }), "Done")
                : h("button", { className: "btn btn-secondary btn-sm", onClick: () => {
                    if (s.n === 3) { onNewScan(); } else { setDone((d) => Object.assign({}, d, { [s.n]: true })); }
                  } }, s.cta),
            );
          })),
      ),

      // Sample report CTA
      h("div", { className: "card card-hover", style: {
        padding: "20px 24px", display: "flex", alignItems: "center", gap: 18, cursor: "pointer",
        background: "linear-gradient(100deg, var(--bg-surface), var(--accent-soft))",
      }, onClick: onSample },
        h("div", { style: { width: 46, height: 46, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, h(Icons.sparkle, { size: 24 })),
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontSize: 15, fontWeight: 650 } }, "Explore a sample report"),
          h("div", { style: { fontSize: 13, color: "var(--text-2)", marginTop: 2 } }, "See a fully-populated scan of a demo repo — 43 findings, diffs, and AI fixes — before you scan anything."),
        ),
        h("button", { className: "btn btn-primary" }, "Open demo", h(Icons.chevR, { size: 15 })),
      ),
    );
  }

  function FloatingShield() {
    return h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 4 } },
      h("img", { src: "logo.svg", alt: "Akira AI", style: { height: 52, width: "auto", objectFit: "contain", animation: "frFloat 3.5s ease-in-out infinite", filter: "drop-shadow(0 8px 24px var(--accent-soft))" } }));
  }
})();
