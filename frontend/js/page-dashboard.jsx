// TanoAudit — Dashboard (returning + first-run onboarding), wired to real data.
(function () {
  const React = window.React;
  const { useState, useEffect, useCallback } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const API = window.TanoAuditAPI;
  const { CountUp, SevDot, ProgressBar, scoreColor } = window;

  function errMsg(e) { return (e && e.message) || "Something went wrong"; }

  // ---- small derivation helpers -------------------------------------------

  // worst_severity → the SEV key our UI components understand.
  function sevKey(s) {
    const k = (s || "").toLowerCase();
    if (k === "critical" || k === "high" || k === "medium" || k === "low" || k === "info") return k;
    // "none"/"clean"/empty all read as clean.
    return "clean";
  }

  // ISO timestamp → "just now" / "2h ago" / "3d ago" / "Apr 2".
  function relTime(iso) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "—";
    const diff = Date.now() - t;
    if (diff < 0) return "just now";
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return min + "m ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    const day = Math.floor(hr / 24);
    if (day < 7) return day + "d ago";
    if (day < 30) return Math.floor(day / 7) + "w ago";
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // Build a 12-month scan-volume series from real created_at timestamps.
  function scanVolume(items) {
    const now = new Date();
    const buckets = [];
    const index = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + "-" + d.getMonth();
      const label = d.toLocaleDateString(undefined, { month: "short" });
      index[key] = buckets.length;
      buckets.push({ label, value: 0, full: d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) });
    }
    items.forEach((s) => {
      if (!s.created_at) return;
      const d = new Date(s.created_at);
      if (isNaN(d.getTime())) return;
      const key = d.getFullYear() + "-" + d.getMonth();
      if (index[key] != null) buckets[index[key]].value += 1;
    });
    return buckets;
  }

  // Distribution of scans by worst-severity (real per-scan field).
  function sevDistribution(items) {
    const order = ["critical", "high", "medium", "low"];
    const colors = {
      critical: "var(--sev-critical)", high: "var(--sev-high)",
      medium: "var(--sev-medium)", low: "var(--sev-low)",
    };
    const labels = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
    const counts = { critical: 0, high: 0, medium: 0, low: 0, clean: 0 };
    items.forEach((s) => { counts[sevKey(s.worst_severity)] = (counts[sevKey(s.worst_severity)] || 0) + 1; });
    const segments = order.map((k) => ({ label: labels[k], n: counts[k], color: colors[k] }));
    return { segments, clean: counts.clean, flagged: order.reduce((a, k) => a + counts[k], 0) };
  }

  // Derive an activity feed from recent scans (no separate activity endpoint).
  // Each scan yields one entry describing its outcome.
  function deriveActivity(items) {
    return items.slice(0, 6).map((s) => {
      const st = (s.status || "").toLowerCase();
      let icon = "list", action = "ran a scan on";
      if (st === "completed") {
        const sev = sevKey(s.worst_severity);
        if (sev === "clean") { icon = "check"; action = "completed a clean scan of"; }
        else { icon = "flag"; action = "finished a scan (" + sev + ") of"; }
      } else if (st === "running" || st === "in_progress" || st === "queued" || st === "pending") {
        icon = "refresh"; action = "is scanning";
      } else if (st === "failed" || st === "error") {
        icon = "alert"; action = "failed a scan of";
      } else if (st === "cancelled" || st === "canceled") {
        icon = "alert"; action = "cancelled a scan of";
      }
      return {
        key: s.id, who: "You", action, target: s.repo,
        when: relTime(s.completed_at || s.created_at), icon,
      };
    });
  }

  // ---- shared placeholders -------------------------------------------------
  function LoadingBlock({ label }) {
    return h("div", { className: "empty-state", style: { padding: "60px 0" } },
      h("div", { className: "spinner", style: { margin: "0 auto 12px" } }),
      h("p", null, label || "Loading…"));
  }
  function ErrorBlock({ msg, onRetry }) {
    return h("div", { className: "empty-state", style: { padding: "56px 0" } },
      h("div", { className: "es-icon" }, h(Icons.alert, { size: 24, style: { color: "var(--sev-high)" } })),
      h("h3", null, "Couldn't load your dashboard"),
      h("p", null, msg || "Please try again."),
      onRetry && h("button", { className: "btn btn-secondary btn-sm", style: { marginTop: 10 }, onClick: onRetry }, "Retry"));
  }

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

  function Dashboard({ demoState, nav, onNewScan, onSample, openSettings, user }) {
    const [state, setState] = useState({ loading: true, error: null, scans: null, usage: null });

    const load = useCallback(async () => {
      setState((s) => Object.assign({}, s, { loading: true, error: null }));
      try {
        // Usage is supplementary — if it fails, we still render from scans.
        const [scansRes, usageRes] = await Promise.all([
          API.scans.list({ limit: 50 }),
          API.usage.get().catch(() => null),
        ]);
        setState({ loading: false, error: null, scans: scansRes || { items: [], total: 0 }, usage: usageRes });
      } catch (e) {
        setState({ loading: false, error: errMsg(e), scans: null, usage: null });
      }
    }, []);

    useEffect(() => { load(); }, [load]);

    const firstName = (() => {
      if (!user) return "there";
      const n = user.display_name || user.full_name || (user.email ? user.email.split("@")[0] : "");
      return n ? n.trim().split(/\s+/)[0] : "there";
    })();

    if (state.loading) return h("div", { className: "vs-page-pad" }, h(LoadingBlock, { label: "Loading your dashboard…" }));
    if (state.error) return h("div", { className: "vs-page-pad" }, h(ErrorBlock, { msg: state.error, onRetry: load }));

    const items = (state.scans && state.scans.items) || [];
    const total = (state.scans && state.scans.total) || items.length;

    // First-run / empty state keyed off whether the user has any scans.
    if (items.length === 0) return h(FirstRun, { firstName, onNewScan, onSample, nav, openSettings });

    return h(ReturningDashboard, { items, total, usage: state.usage, firstName, nav, onNewScan });
  }
  window.Dashboard = Dashboard;

  // ---- Returning user dashboard (real data) ----
  function ReturningDashboard({ items, total, usage, firstName, nav, onNewScan }) {
    const completed = items.filter((s) => (s.status || "").toLowerCase() === "completed");
    const running = items.filter((s) => {
      const st = (s.status || "").toLowerCase();
      return st === "running" || st === "in_progress" || st === "queued" || st === "pending";
    });

    // Avg security RISK across completed scans (risk = 100 − stored score).
    // Higher = worse, consistent with the rest of the app.
    const avgRisk = completed.length
      ? Math.round(completed.reduce((a, s) => a + window.riskFromScore(s.security_score), 0) / completed.length)
      : 0;

    const scansThisMonth = usage && usage.scans_this_month != null ? usage.scans_this_month : null;
    const lifetimeSegments = usage && usage.lifetime_segments != null ? usage.lifetime_segments : null;

    const volume = scanVolume(items);
    const volTotal = volume.reduce((a, d) => a + d.value, 0);
    const { segments: sevSeg, clean: cleanCount, flagged } = sevDistribution(items);

    const recent = items.slice(0, 6);
    const activity = deriveActivity(items);

    return h("div", { className: "vs-page-pad vs-page-enter" },
      h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 } },
        h("div", null,
          h("h1", { style: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } }, "Welcome back, " + firstName),
          h("p", { style: { color: "var(--text-2)", fontSize: 13.5, marginTop: 2 } }, "Here's the security posture across your repositories."),
        ),
        h("button", { className: "btn btn-primary btn-lg", onClick: onNewScan }, h(Icons.plus, { size: 17, sw: 2.2 }), "New Scan"),
      ),

      // Stat cards — all derived from real data.
      h("div", { className: "stagger-in", style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 } },
        h(Stat, {
          label: "Total scans", value: total, icon: "list",
          sub: scansThisMonth != null ? ("+" + scansThisMonth + " this month") : (running.length ? running.length + " in progress" : null),
        }),
        h(Stat, {
          label: "Avg. security risk", value: avgRisk, suffix: "/100",
          color: window.riskColor(avgRisk), icon: "shield",
          sub: completed.length + " completed scan" + (completed.length === 1 ? "" : "s"),
        }),
        h(Stat, {
          label: "Flagged scans", value: flagged,
          color: flagged ? "var(--sev-high)" : "var(--sev-clean)", icon: "alert",
          sub: cleanCount + " clean of " + items.length + " recent",
        }),
        h(Stat, {
          label: "Segments analyzed", value: lifetimeSegments != null ? lifetimeSegments : items.reduce((a, s) => a + (s.segments_analyzed || 0), 0),
          icon: "cpu",
          sub: lifetimeSegments != null ? "lifetime" : "recent scans",
        }),
      ),

      // Charts row
      h("div", { style: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginBottom: 24, alignItems: "stretch" } },
        h("div", { className: "card", style: { padding: "16px 20px" } },
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 } },
            h("div", null,
              h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Scan volume"),
              h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 1 } }, "Scans per month (last 12 months)")),
            h("span", { className: "badge", style: { background: "var(--accent-soft)", color: "var(--accent)" } }, volTotal + " in range")),
          volTotal === 0
            ? h("div", { className: "empty-state", style: { padding: "32px 0" } },
                h("p", null, "No scans in the last 12 months yet."))
            : h(window.RoundedBars, {
                data: volume, highlightIndex: volume.length - 1, height: 160,
                tipFor: (i) => volume[i].value + " scan" + (volume[i].value === 1 ? "" : "s") + " · " + volume[i].full,
              })),
        h("div", { className: "card", style: { padding: "16px 20px", display: "flex", flexDirection: "column" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650 } }, "Scans by worst severity"),
          h("p", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 1 } }, "Recent scans, by highest finding"),
          flagged === 0
            ? h("div", { className: "empty-state", style: { padding: "24px 0", flex: 1, justifyContent: "center" } },
                h("div", { className: "es-icon" }, h(Icons.check, { size: 22, style: { color: "var(--sev-clean)" } })),
                h("p", null, "All " + items.length + " recent scans are clean."))
            : h("div", { style: { display: "flex", alignItems: "center", gap: 20, flex: 1, marginTop: 10 } },
                h(window.RingStat, {
                  segments: sevSeg.map((s) => ({ value: s.n, color: s.color })), size: 144, stroke: 12,
                  centerBig: flagged, centerSmall: "flagged scans",
                }),
                h("div", { style: { display: "flex", flexDirection: "column", gap: 9, flex: 1 } },
                  sevSeg.map((s) =>
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
              ["Repository", "Risk", "Segments", "Scanned"].map((c, i) =>
                h("th", { key: c, style: { textAlign: i > 0 ? "right" : "left", padding: "8px 18px", fontWeight: 600 } }, c)))),
            h("tbody", null, recent.map((s) => {
              const st = (s.status || "").toLowerCase();
              const isDone = st === "completed";
              return h("tr", {
                key: s.id, onClick: () => nav("report", s.id),
                style: { cursor: "pointer", borderTop: "1px solid var(--border)" },
                onMouseEnter: (e) => e.currentTarget.style.background = "var(--bg-hover)",
                onMouseLeave: (e) => e.currentTarget.style.background = "transparent",
              },
                h("td", { style: { padding: "11px 18px", display: "flex", alignItems: "center", gap: 9 } },
                  h(SevDot, { sev: sevKey(s.worst_severity) }), h("span", { style: { fontWeight: 550 } }, s.repo)),
                h("td", { style: { textAlign: "right", padding: "11px 18px" } },
                  isDone
                    ? (function () { const risk = window.riskFromScore(s.security_score); return h("span", { style: { fontWeight: 650, color: window.riskColor(risk), fontVariantNumeric: "tabular-nums" } }, risk); })()
                    : h("span", { style: { color: "var(--text-3)", textTransform: "capitalize" } }, st || "—")),
                h("td", { style: { textAlign: "right", padding: "11px 18px", fontVariantNumeric: "tabular-nums", color: "var(--text-2)" } },
                  (s.segments_analyzed || 0) + "/" + (s.segment_total || 0)),
                h("td", { style: { textAlign: "right", padding: "11px 18px", color: "var(--text-3)", whiteSpace: "nowrap" } },
                  relTime(s.completed_at || s.created_at)),
              );
            })),
          ),
        ),

        // Activity feed (derived from recent scans — no separate activity endpoint).
        h("div", { className: "card", style: { padding: "13px 4px 8px" } },
          h("h3", { style: { fontSize: 14, fontWeight: 650, padding: "0 16px 10px" } }, "Activity"),
          h("div", { style: { display: "flex", flexDirection: "column" } },
            activity.map((a) =>
              h("div", { key: a.key, style: { display: "flex", gap: 10, padding: "9px 16px", alignItems: "flex-start" } },
                h("div", { style: { width: 26, height: 26, borderRadius: 7, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text-2)" } },
                  h(Icons[a.icon] || Icons.dot, { size: 14 })),
                h("div", { style: { fontSize: 12.5, lineHeight: 1.45 } },
                  h("span", { style: { fontWeight: 600 } }, a.who), " ",
                  h("span", { style: { color: "var(--text-2)" } }, a.action), " ",
                  h("span", { style: { fontWeight: 550 } }, a.target),
                  h("div", { style: { fontSize: 11, color: "var(--text-3)", marginTop: 1 } }, a.when),
                ),
              ))),
        ),
      ),
    );
  }

  // ---- First-run onboarding ----
  function FirstRun({ firstName, onNewScan, onSample, nav, openSettings }) {
    // Step 1 (Connect GitHub) reflects the real connection status, not just a
    // click in this session — so a returning user who already linked GitHub sees
    // it marked done. Step 2 (first scan) is inherently incomplete here, since
    // FirstRun only renders when the user has zero scans. `clicked` lets a
    // freshly-completed action show "Done" without a refetch.
    const [ghConnected, setGhConnected] = useState(false);
    const [clicked, setClicked] = useState({ 1: false, 2: false });
    useEffect(() => {
      let alive = true;
      API.github.status()
        .then((s) => { if (alive && s && s.connected) setGhConnected(true); })
        .catch(() => {});
      return () => { alive = false; };
    }, []);

    const done = { 1: ghConnected || clicked[1], 2: clicked[2] };
    const steps = [
      { n: 1, title: "Connect GitHub", desc: "Authorize TanoAudit to read the repositories you want to scan.", cta: "Connect", icon: "github" },
      { n: 2, title: "Run your first scan", desc: "Point TanoAudit at a repo and watch both engines go to work.", cta: "New scan", icon: "shield" },
    ];
    const completedCount = Object.values(done).filter(Boolean).length;

    return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 920 } },
      // Hero
      h("div", { style: { textAlign: "center", padding: "30px 0 28px" } },
        h(FloatingShield, null),
        h("h1", { style: { fontSize: 30, fontWeight: 750, letterSpacing: "-0.025em", marginTop: 18 } },
          firstName && firstName !== "there" ? ("Welcome, " + firstName) : "Welcome to TanoAudit"),
        h("p", { style: { color: "var(--text-2)", fontSize: 15, maxWidth: 520, margin: "8px auto 0", textWrap: "pretty" } },
          "One scan, two engines — find ", h("strong", { style: { color: "var(--text-1)" } }, "300+ vulnerability classes"),
          " and optimize performance, quality and scale at the same time."),
      ),

      // Onboarding card
      h("div", { className: "card", style: { padding: 24, marginBottom: 18 } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
          h("h3", { style: { fontSize: 15, fontWeight: 650 } }, "Get started in 2 steps"),
          h("span", { style: { fontSize: 12.5, color: "var(--text-2)" } }, completedCount + " of 2 complete"),
        ),
        h("div", { style: { marginBottom: 16 } }, h(ProgressBar, { value: (completedCount / 2) * 100 })),
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
                h("div", { style: { fontSize: 13.5, fontWeight: 600 } }, s.title),
                h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginTop: 1 } }, s.desc),
              ),
              isDone
                ? h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h(Icons.check, { size: 12 }), "Done")
                : h("button", { className: "btn btn-secondary btn-sm", onClick: () => {
                    // Step 1's done-state is driven by the real GitHub connection,
                    // not the click — navigating to Integrations doesn't itself
                    // connect anything. Step 2 opens the scan modal immediately, so
                    // mark it optimistically.
                    if (s.n === 1) { nav && nav("integrations"); }
                    else { setClicked((d) => Object.assign({}, d, { 2: true })); onNewScan(); }
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
          h("div", { style: { fontSize: 13, color: "var(--text-2)", marginTop: 2 } }, "See a fully-populated scan of a demo repo — findings, diffs, and AI fixes — before you scan anything."),
        ),
        h("button", { className: "btn btn-primary" }, "Open demo", h(Icons.chevR, { size: 15 })),
      ),
    );
  }

  function FloatingShield() {
    return h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 4 } },
      h("img", { src: "logo.svg?v=3", alt: "TanoAudit", style: { height: 52, width: "auto", objectFit: "contain", animation: "frFloat 3.5s ease-in-out infinite", filter: "drop-shadow(0 8px 24px var(--accent-soft))" } }));
  }
})();
