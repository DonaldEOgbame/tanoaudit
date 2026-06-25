// Akira AI — Learning Hub, Integrations
(function () {
  const React = window.React;
  const { useState, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons;
  const API = window.AkiraAPI;
  const { SevBadge, Avatar, Switch, Tag, Modal, PageHead, Dropdown } = window;

  // ============ LEARNING HUB ============
  // Color dots for the external-resource cards. Backend "source" labels may
  // differ slightly (e.g. "CWE / MITRE"); fall back on a substring match.
  const LH_SOURCE_COLORS = { CWE: "#f59e0b", OWASP: "#10b981", PortSwigger: "#ff6633", MDN: "#7aa2f7", SANS: "#c792ea", YouTube: "#ef4444", Articles: "var(--text-3)" };
  function lhSourceColor(source) {
    if (!source) return "var(--text-3)";
    if (LH_SOURCE_COLORS[source]) return LH_SOURCE_COLORS[source];
    for (const k in LH_SOURCE_COLORS) if (source.indexOf(k) >= 0) return LH_SOURCE_COLORS[k];
    return "var(--text-3)";
  }

  function StateBlock({ icon, title, desc }) {
    return h("div", { className: "empty-state" },
      icon && h("div", { className: "es-icon" }, h(icon, { size: 24 })),
      h("h3", null, title),
      desc && h("p", null, desc));
  }

  function LearningPage({ initialSlug } = {}) {
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(initialSlug || null);  // class slug selected (deep-link opens directly)
    const [openCat, setOpenCat] = useState(null);    // category drilled into (directory view)
    const [shown, setShown] = useState(24);          // load-more cap within a drilled category
    const [advanced, setAdvanced] = useState(false);
    const [cats, setCats] = useState(null);          // [{category, count}]
    const [classes, setClasses] = useState(null);    // [{slug,name,category,...}]
    const [listLoading, setListLoading] = useState(true);
    const [listErr, setListErr] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailErr, setDetailErr] = useState(null);

    // The .vs-page scroll container only remounts on page change, not when we
    // switch between the class list and a class detail. Reset to the top
    // whenever the selection changes so a class opens at its heading.
    useEffect(() => {
      const scroller = document.querySelector(".vs-page");
      if (scroller) scroller.scrollTop = 0;
    }, [sel, openCat]);

    // Reset the load-more cap whenever the drilled category or search changes.
    useEffect(() => { setShown(24); }, [openCat, q]);

    // Load categories + the full class list once. The backend caps `limit` at
    // 200, so page through until we have every class.
    useEffect(() => {
      let alive = true;
      setListLoading(true); setListErr(null);
      const fetchAllClasses = async () => {
        const PAGE = 200;
        let offset = 0, all = [], total = Infinity;
        while (offset < total) {
          const res = await API.learning.classes({ limit: PAGE, offset });
          const items = (res && res.items) || [];
          total = res && typeof res.total === "number" ? res.total : items.length;
          all = all.concat(items);
          if (items.length === 0) break;
          offset += items.length;
        }
        return all;
      };
      Promise.all([API.learning.categories(), fetchAllClasses()])
        .then(([catList, classList]) => {
          if (!alive) return;
          setCats(catList || []);
          setClasses(classList || []);
        })
        .catch((e) => { if (alive) setListErr(e.message || "Failed to load the Learning Hub"); })
        .finally(() => { if (alive) setListLoading(false); });
      return () => { alive = false; };
    }, []);

    // Load class detail when a class is selected.
    useEffect(() => {
      if (!sel) { setDetail(null); setDetailErr(null); return; }
      let alive = true;
      setDetailLoading(true); setDetailErr(null); setDetail(null);
      API.learning.classDetail(sel)
        .then((d) => { if (alive) setDetail(d); })
        .catch((e) => { if (alive) setDetailErr(e.message || "Failed to load this class"); })
        .finally(() => { if (alive) setDetailLoading(false); });
      return () => { alive = false; };
    }, [sel]);

    // ----- Class detail view -----
    if (sel) {
      const back = h("button", { className: "btn btn-ghost btn-sm", style: { marginBottom: 14 }, onClick: () => setSel(null) },
        h(Icons.chevL, { size: 14 }), "All classes");

      if (detailLoading) {
        return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 760 }, "data-screen-label": "Learning Detail" },
          back, h("div", { className: "empty-state" }, h("div", { className: "spinner" })));
      }
      if (detailErr || !detail) {
        return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 760 }, "data-screen-label": "Learning Detail" },
          back, h(StateBlock, { icon: Icons.alert, title: "Couldn’t load this class", desc: detailErr || "Please try again." }));
      }

      const { name, category, cwe, owasp, severity, summary } = detail;
      const faq = detail.faq || [];
      const resources = detail.resources || [];

      return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 760 }, "data-screen-label": "Learning Detail" },
        back,
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" } },
          h("h1", { style: { fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em" } }, name),
          severity && h(SevBadge, { sev: severity }), cwe && h(Tag, null, cwe), owasp && owasp !== "—" && h(Tag, null, owasp), category && h(Tag, null, category)),
        summary && h("p", { style: { fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 16, textWrap: "pretty" } }, summary),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid var(--border)" } },
          h("span", { style: { fontSize: 12.5, color: advanced ? "var(--text-2)" : "var(--text-1)", fontWeight: advanced ? 400 : 600 } }, "Beginner"),
          h(Switch, { on: advanced, onChange: setAdvanced }),
          h("span", { style: { fontSize: 12.5, color: advanced ? "var(--text-1)" : "var(--text-2)", fontWeight: advanced ? 600 : 400 } }, "Advanced"),
          h("span", { style: { fontSize: 11.5, color: "var(--text-3)", marginLeft: 4 } }, "— toggle for deeper technical detail")),

        // Q&A explainer — questions are their own headings, answers always visible
        faq.length === 0
          ? h(StateBlock, { icon: Icons.book, title: "No explainer available", desc: "This class has no Q&A content yet." })
          : faq.map((item, i) =>
              h("div", { key: i, className: "card stagger-in", style: { padding: "18px 22px", marginBottom: 12 } },
                h("h3", { style: { fontSize: 16, fontWeight: 650, marginBottom: 9, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 9 } },
                  h("span", { style: { width: 22, height: 22, borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 } }, "Q"),
                  item.question),
                h("p", { style: { fontSize: 13.5, lineHeight: 1.65, color: "var(--text-2)", textWrap: "pretty" } }, item.answer),
                advanced && item.advanced && h("div", { style: { marginTop: 10, padding: "10px 13px", borderRadius: "var(--r-md)", background: "var(--bg-inset)", borderLeft: "2.5px solid var(--accent)" } },
                  h("div", { style: { fontSize: 10.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Going deeper"),
                  h("p", { style: { fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" } }, item.advanced)))),

        // External resources
        resources.length > 0 && h("div", { style: { marginTop: 22 } },
          h("h3", { style: { fontSize: 13, fontWeight: 650, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 } }, "External resources"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 8 } },
            resources.map((res, i) =>
              h("a", { key: i, href: res.url, target: "_blank", rel: "noopener noreferrer", className: "card card-hover",
                style: { padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, textDecoration: "none" } },
                h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: lhSourceColor(res.source), flexShrink: 0 } }),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, res.title),
                  h("div", { style: { fontSize: 11, color: "var(--text-3)" } }, res.source)),
                h(Icons.link, { size: 13, style: { color: "var(--text-3)", flexShrink: 0 } }))))));
    }

    // ----- Directory (categories -> classes) view -----
    const head = h(PageHead, { title: "Learning Hub", desc: cats && classes
      ? (classes.length + " classes across " + cats.length + " categories — security, optimization, and stubs — full explainers, for every level.")
      : "Browse vulnerability classes — full explainers, for every level." });

    const search = h("div", { style: { position: "relative", marginBottom: 20, maxWidth: 440 } },
      h(Icons.search, { size: 16, style: { position: "absolute", left: 13, top: 11, color: "var(--text-3)" } }),
      h("input", { className: "field", style: { paddingLeft: 38, padding: "10px 12px 10px 38px", fontSize: 14 }, placeholder: "Search vulnerability classes…", value: q, onChange: (e) => setQ(e.target.value) }));

    // A single class card.
    const classCard = (c) =>
      h("button", { key: c.slug, className: "card card-hover", style: { padding: "11px 14px", textAlign: "left", display: "flex", alignItems: "center", gap: 9 }, onClick: () => setSel(c.slug) },
        h(Icons.book, { size: 14, style: { color: "var(--accent)", flexShrink: 0 } }),
        h("span", { style: { fontSize: 12.5, fontWeight: 550 } }, c.name));

    // A grid of class cards capped at `shown`, with a "Show more" button.
    const cappedGrid = (list) => {
      const visible = list.slice(0, shown);
      return h(React.Fragment, null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 } },
          visible.map(classCard)),
        list.length > shown && h("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 12 }, onClick: () => setShown((n) => n + 24) },
          "Show " + Math.min(24, list.length - shown) + " more (" + (list.length - shown) + " hidden)"));
    };

    let body;
    if (listLoading) {
      body = h("div", { className: "empty-state" }, h("div", { className: "spinner" }));
    } else if (listErr) {
      body = h(StateBlock, { icon: Icons.alert, title: "Couldn’t load the Learning Hub", desc: listErr });
    } else {
      const ql = q.trim().toLowerCase();
      const all = classes || [];
      const countByCat = {};
      all.forEach((c) => { countByCat[c.category] = (countByCat[c.category] || 0) + 1; });
      // Category order: from categories() endpoint, then any extras seen in classes.
      const catOrder = (cats || []).map((c) => c.category).filter((n) => countByCat[n]);
      Object.keys(countByCat).forEach((n) => { if (catOrder.indexOf(n) < 0) catOrder.push(n); });

      if (ql) {
        // SEARCH: flat, cross-category list (capped + load-more).
        const matches = all.filter((c) => c.name.toLowerCase().includes(ql) || (c.category || "").toLowerCase().includes(ql));
        body = matches.length === 0
          ? h(StateBlock, { icon: Icons.search, title: "No classes match", desc: "Nothing found for “" + q + "”." })
          : h("div", null,
              h("div", { style: { fontSize: 12.5, color: "var(--text-3)", marginBottom: 10 } }, matches.length + " result" + (matches.length === 1 ? "" : "s")),
              cappedGrid(matches));
      } else if (openCat) {
        // DRILL-IN: one category's classes (capped + load-more).
        const inCat = all.filter((c) => c.category === openCat);
        body = h("div", null,
          h("button", { className: "btn btn-ghost btn-sm", style: { marginBottom: 14 }, onClick: () => setOpenCat(null) },
            h(Icons.chevL, { size: 14 }), "All categories"),
          h("h2", { style: { fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 } }, openCat),
          h("p", { style: { fontSize: 12.5, color: "var(--text-3)", marginBottom: 16 } }, inCat.length + " class" + (inCat.length === 1 ? "" : "es")),
          cappedGrid(inCat));
      } else if (catOrder.length === 0) {
        body = h(StateBlock, { icon: Icons.book, title: "No classes yet", desc: "Learning classes appear here as scans run." });
      } else {
        // LANDING: category cards with counts.
        body = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 } },
          catOrder.map((cat) =>
            h("button", { key: cat, className: "card card-hover", style: { padding: "16px 18px", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }, onClick: () => setOpenCat(cat) },
              h("span", { style: { width: 38, height: 38, borderRadius: 9, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, h(Icons.book, { size: 18 })),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" } }, cat),
                h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginTop: 2 } }, countByCat[cat] + " class" + (countByCat[cat] === 1 ? "" : "es"))),
              h(Icons.chevR, { size: 16, style: { color: "var(--text-3)", flexShrink: 0 } }))));
      }
    }

    return h("div", { className: "vs-page-pad vs-page-enter", "data-screen-label": "Learning Hub" }, head, search, body);
  }
  window.LearningPage = LearningPage;

  // ============ INTEGRATIONS ============
  function IntegrationsPage({ toast }) {
    const [status, setStatus] = useState(null);   // ConnectionStatus payload
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [secretShown, setSecretShown] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectErr, setConnectErr] = useState(null); // e.g. OAuth "not configured"

    // GitHub repos (loaded when connected + expanded).
    const [repos, setRepos] = useState(null);
    const [reposLoading, setReposLoading] = useState(false);
    const [reposErr, setReposErr] = useState(null);
    const [repoQuery, setRepoQuery] = useState("");

    // Webhook deliveries.
    const [deliveries, setDeliveries] = useState(null);

    const connected = !!(status && status.connected);

    function loadStatus() {
      setLoading(true); setLoadErr(null);
      return API.github.status()
        .then((s) => setStatus(s))
        .catch((e) => setLoadErr(e.message || "Failed to load GitHub status"))
        .finally(() => setLoading(false));
    }
    useEffect(() => { loadStatus(); }, []);

    // Load repos + deliveries lazily when the connected card is expanded.
    useEffect(() => {
      if (!connected || !expanded) return;
      let alive = true;
      if (repos === null && !reposLoading) {
        setReposLoading(true); setReposErr(null);
        API.github.repos()
          .then((r) => { if (alive) setRepos(r || []); })
          .catch((e) => { if (alive) { setReposErr(e.message || "Failed to load repositories"); setRepos([]); } })
          .finally(() => { if (alive) setReposLoading(false); });
      }
      if (deliveries === null) {
        API.github.deliveries()
          .then((d) => { if (alive) setDeliveries(d || []); })
          .catch(() => { if (alive) setDeliveries([]); });
      }
      return () => { alive = false; };
    }, [connected, expanded]);

    function handleConnect() {
      setConnecting(true); setConnectErr(null);
      API.github.authorize()
        .then((res) => {
          if (res && res.authorize_url) {
            window.location.href = res.authorize_url;   // redirect to GitHub OAuth
          } else {
            setConnectErr("GitHub OAuth is not configured on this server.");
            setConnecting(false);
          }
        })
        .catch((e) => {
          setConnectErr(e.message || "GitHub OAuth is not configured on this server.");
          setConnecting(false);
        });
    }

    function handleDisconnect(e) {
      if (e) e.stopPropagation();
      API.github.disconnect()
        .then(() => {
          setExpanded(false); setRepos(null); setDeliveries(null);
          return loadStatus();
        })
        .then(() => toast && toast({ kind: "info", msg: "GitHub disconnected" }))
        .catch((err) => toast && toast({ kind: "error", msg: err.message || "Couldn’t disconnect" }));
    }

    // Generic helper to PATCH a settings group and merge the response into status.
    function patchSettings(apiFn, body, key, okMsg) {
      return apiFn(body)
        .then((updated) => {
          setStatus((s) => Object.assign({}, s, { [key]: updated }));
          if (okMsg) toast && toast({ kind: "success", msg: okMsg });
        })
        .catch((err) => {
          toast && toast({ kind: "error", msg: err.message || "Couldn’t save" });
          loadStatus(); // re-sync from server on failure
        });
    }

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
        h(Switch, { on: !!on, onChange: set }));
    }

    const triggers = (status && status.triggers) || {};
    const issueSettings = (status && status.issue_settings) || {};
    const statusCheck = (status && status.status_check) || {};
    const repoAccess = (status && status.repo_access) || { mode: "all", selected: [] };
    const selectedSet = new Set(repoAccess.selected || []);

    // Toggle a repo in/out of the "selected" allow-list and persist immediately.
    function toggleSelectedRepo(fullName) {
      const next = new Set(repoAccess.selected || []);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      patchSettings(
        API.github.setRepoAccess,
        { mode: "selected", selected: Array.from(next) },
        "repo_access",
        "Repository access updated"
      );
    }

    // ----- Connection card -----
    let connectionCard;
    if (loading) {
      connectionCard = h("div", { className: "card", style: { padding: 20, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 84 } },
        h("div", { className: "spinner" }));
    } else if (loadErr) {
      connectionCard = h("div", { className: "card", style: { padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 } },
        h("div", { style: { width: 44, height: 44, borderRadius: 11, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Icons.github, { size: 24 })),
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontSize: 14.5, fontWeight: 650 } }, "GitHub"),
          h("div", { style: { fontSize: 12.5, color: "var(--sev-critical)", marginTop: 3 } }, loadErr)),
        h("button", { className: "btn btn-secondary btn-sm", onClick: () => loadStatus() }, h(Icons.refresh, { size: 13 }), "Retry"));
    } else {
      connectionCard = h("div", {
        className: "card card-hover",
        style: { padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16, cursor: connected ? "pointer" : "default" },
        onClick: () => { if (connected) setExpanded((exp) => !exp); }
      },
        h("div", { style: { width: 44, height: 44, borderRadius: 11, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center" } },
          status.avatar_url
            ? h("img", { src: status.avatar_url, alt: "", style: { width: 44, height: 44, borderRadius: 11, objectFit: "cover" } })
            : h(Icons.github, { size: 24 })),
        connected
          ? h(React.Fragment, null,
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                  h("span", { style: { fontSize: 14.5, fontWeight: 650 } }, "GitHub"),
                  h("span", { className: "badge", style: { background: "var(--sev-clean-bg)", color: "var(--sev-clean)" } }, h("span", { className: "dot" }), "Connected")),
                h("div", { style: { fontSize: 12.5, color: "var(--text-2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  (status.github_username ? "@" + status.github_username : "Connected") + (status.scopes ? " · scopes: " + status.scopes : ""))),
              h("button", { className: "btn btn-secondary btn-sm", onClick: handleDisconnect }, "Disconnect"),
              h("div", { style: { color: "var(--text-3)", display: "flex", alignItems: "center", width: 20, justifyContent: "center" } }, h(expanded ? Icons.chevD : Icons.chevR, { size: 16 }))
            )
          : h(React.Fragment, null,
              h("div", { style: { flex: 1 } },
                h("div", { style: { fontSize: 14.5, fontWeight: 650 } }, "GitHub"),
                h("div", { style: { fontSize: 12.5, color: connectErr ? "var(--sev-critical)" : "var(--text-2)", marginTop: 3 } },
                  connectErr || "Connect to scan private repos and enable auto-scan triggers.")),
              h("button", { className: "btn btn-primary", disabled: connecting, onClick: handleConnect },
                connecting ? h("div", { className: "spinner", style: { width: 14, height: 14, borderTopColor: "var(--accent-text)" } }) : h(Icons.github, { size: 15 }),
                connecting ? "Connecting…" : "Connect GitHub")));
    }

    // ----- Expanded settings (only when connected) -----
    const expandedSettings = connected && expanded && h(React.Fragment, null,
      h(Section, { title: "Repository access" },
        h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
          h("button", { className: "sel-card" + (repoAccess.mode === "all" ? " sel" : ""), style: { flex: 1, padding: "10px 14px", fontSize: 12.5 },
            onClick: () => patchSettings(API.github.setRepoAccess, { mode: "all", selected: repoAccess.selected || [] }, "repo_access", "Repository access updated") }, "All repositories",
            repoAccess.mode === "all" && h("div", { className: "sel-check" }, h(Icons.check, { size: 13, sw: 2.5 }))),
          h("button", { className: "sel-card" + (repoAccess.mode === "selected" ? " sel" : ""), style: { flex: 1, padding: "10px 14px", fontSize: 12.5 },
            onClick: () => patchSettings(API.github.setRepoAccess, { mode: "selected", selected: repoAccess.selected || [] }, "repo_access", "Repository access updated") }, "Selected repositories",
            repoAccess.mode === "selected" && h("div", { className: "sel-check" }, h(Icons.check, { size: 13, sw: 2.5 }))),
        ),
        repoAccess.mode === "selected"
          ? h("div", { style: { fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 } },
              "Click repositories to include them in auto-scans"
                + (selectedSet.size ? " — " + selectedSet.size + " selected" : " — none selected (auto-scan is off)"))
          : null,
        reposLoading
          ? h("div", { className: "empty-state", style: { padding: "16px 0" } }, h("div", { className: "spinner" }))
          : reposErr
            ? h("div", { style: { fontSize: 12, color: "var(--sev-critical)" } }, reposErr)
            : (repos && repos.length > 0)
              ? (repoAccess.mode === "selected"
                  ? (() => {
                      const q = repoQuery.trim().toLowerCase();
                      const filtered = q ? repos.filter((r) => r.full_name.toLowerCase().includes(q)) : repos;
                      return h(React.Fragment, null,
                        h("input", {
                          type: "text",
                          value: repoQuery,
                          onChange: (e) => setRepoQuery(e.target.value),
                          placeholder: "Search repositories…",
                          className: "field",
                          style: { width: "100%", marginBottom: 8, fontSize: 12.5 },
                        }),
                        h("div", {
                          style: {
                            display: "flex", flexWrap: "wrap", gap: 6,
                            maxHeight: 220, overflowY: "auto",
                            padding: 8,
                            border: "1px solid var(--border)", borderRadius: 8,
                            background: "var(--bg-1)",
                          },
                        },
                          filtered.length === 0
                            ? h("span", { style: { fontSize: 12, color: "var(--text-3)" } }, "No repositories match \"" + repoQuery + "\".")
                            : filtered.map((r) => {
                                const isOn = selectedSet.has(r.full_name);
                                return h("button", {
                                  key: r.full_name,
                                  type: "button",
                                  className: "tag",
                                  onClick: () => toggleSelectedRepo(r.full_name),
                                  style: {
                                    cursor: "pointer",
                                    border: "1px solid " + (isOn ? "var(--accent)" : "var(--border)"),
                                    background: isOn ? "var(--accent-soft)" : "transparent",
                                    color: isOn ? "var(--accent)" : "var(--text-2)",
                                    display: "inline-flex", alignItems: "center", gap: 5,
                                    height: "fit-content",
                                  },
                                }, isOn && h(Icons.check, { size: 11, sw: 2.5 }), r.full_name);
                              })));
                    })()
                  : h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                      repos.slice(0, 8).map((r) => h(Tag, { key: r.full_name }, r.full_name)),
                      repos.length > 8 && h("span", { style: { fontSize: 12, color: "var(--text-3)", alignSelf: "center" } }, "+" + (repos.length - 8) + " more")))
              : h("div", { style: { fontSize: 12, color: "var(--text-3)" } }, "No repositories found for this account.")),
      h(Section, { title: "Auto-scan triggers", desc: "Run scans automatically on repository events." },
        h(Row, { label: "On push to default branch", on: triggers.on_push, set: (v) => patchSettings(API.github.setTriggers, { on_push: v }, "triggers", "Triggers updated") }),
        h(Row, { label: "On pull request", desc: "Scans the PR diff only — fast", on: triggers.on_pull_request, set: (v) => patchSettings(API.github.setTriggers, { on_pull_request: v }, "triggers", "Triggers updated") }),
        h(Row, { label: "On release tag", on: triggers.on_release, set: (v) => patchSettings(API.github.setTriggers, { on_release: v }, "triggers", "Triggers updated") }),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 } },
          h("div", null, h("label", { className: "flabel" }, "Branch filters"),
            h("input", { className: "field mono", defaultValue: (triggers.branch_filters || []).join(", "), style: { fontSize: 12 },
              onBlur: (e) => patchSettings(API.github.setTriggers, { branch_filters: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }, "triggers", "Branch filters saved") })),
          h("div", null, h("label", { className: "flabel" }, "Ignore paths"),
            h("input", { className: "field mono", defaultValue: (triggers.ignore_paths || []).join(", "), style: { fontSize: 12 },
              onBlur: (e) => patchSettings(API.github.setTriggers, { ignore_paths: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }, "triggers", "Ignore paths saved") })))),
      h(Section, { title: "Webhook", desc: "Akira AI receives repository events at this endpoint." },
        h("label", { className: "flabel" }, "Payload URL"),
        h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
          h("input", { className: "field mono", readOnly: true, value: status.webhook_url || "", style: { fontSize: 12 } }),
          h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, onClick: () => { try { navigator.clipboard.writeText(status.webhook_url || ""); } catch (e) {} toast && toast({ kind: "success", msg: "URL copied" }); } }, h(Icons.copy, { size: 13 }))),
        h("label", { className: "flabel" }, "Secret"),
        h("div", { style: { display: "flex", gap: 6, marginBottom: 14 } },
          h("input", { className: "field mono", readOnly: true, type: secretShown ? "text" : "password", value: status.webhook_secret || "", style: { fontSize: 12 } }),
          h("button", { className: "btn btn-secondary btn-sm", style: { flexShrink: 0 }, onClick: () => setSecretShown((v) => !v) }, h(secretShown ? Icons.eyeOff : Icons.eye, { size: 13 }))),
        h("label", { className: "flabel" }, "Recent deliveries"),
        deliveries === null
          ? h("div", { className: "empty-state", style: { padding: "16px 0" } }, h("div", { className: "spinner" }))
          : deliveries.length === 0
            ? h("div", { style: { fontSize: 12, color: "var(--text-3)", padding: "8px 0" } }, "No deliveries yet.")
            : h("div", { style: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" } },
                deliveries.map((d, i) => {
                  const ok = d.status >= 200 && d.status < 300;
                  return h("div", { key: d.id || i, style: { padding: "8px 12px", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 12 } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                      h("span", { className: "mono", style: { flex: 1 } }, d.event),
                      h("span", { className: "badge", style: { background: ok ? "var(--sev-clean-bg)" : "var(--sev-critical-bg)", color: ok ? "var(--sev-clean)" : "var(--sev-critical)" } }, d.status),
                      h("span", { style: { color: "var(--text-3)" } }, d.created_at ? new Date(d.created_at).toLocaleString() : "")),
                    d.detail && h("div", { style: { color: ok ? "var(--text-3)" : "var(--sev-critical)", marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" } }, d.detail));
                }))),
      h(Section, { title: "GitHub Issues", desc: "Automatically create issues from findings." },
        h(Row, { label: "Auto-create issues", desc: "For findings at or above the threshold", on: issueSettings.auto_create, set: (v) => patchSettings(API.github.setIssueSettings, { auto_create: v }, "issue_settings", "Issue settings updated") }),
        issueSettings.auto_create && h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 } },
          h("div", null, h("label", { className: "flabel" }, "Severity threshold"),
            h(Dropdown, { width: "100%",
              value: (issueSettings.severity_threshold ? issueSettings.severity_threshold[0].toUpperCase() + issueSettings.severity_threshold.slice(1) : "High"),
              options: ["Critical", "High", "Medium"],
              onChange: (v) => patchSettings(API.github.setIssueSettings, { severity_threshold: String(v).toLowerCase() }, "issue_settings", "Issue settings updated") })),
          h("div", null, h("label", { className: "flabel" }, "Default assignee"),
            h("input", { className: "field mono", defaultValue: issueSettings.assignee || "", placeholder: "@username", style: { fontSize: 12 },
              onBlur: (e) => patchSettings(API.github.setIssueSettings, { assignee: e.target.value.trim() || null }, "issue_settings", "Assignee saved") })),
          h("div", { style: { gridColumn: "1 / -1" } }, h("label", { className: "flabel" }, "Labels"),
            h("input", { className: "field mono", defaultValue: (issueSettings.labels || []).join(", "), style: { fontSize: 12 },
              onBlur: (e) => patchSettings(API.github.setIssueSettings, { labels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }, "issue_settings", "Labels saved") })))),
      h(Section, { title: "Status checks", desc: "Post scan results to commits and PRs." },
        h(Row, { label: "Post commit status", on: statusCheck.post_commit_status, set: (v) => patchSettings(API.github.setStatusCheck, { post_commit_status: v }, "status_check", "Status checks updated") }),
        h(Row, { label: "Block PR merge on Critical", desc: "Requires branch protection on the repo", on: statusCheck.block_merge_on_critical, set: (v) => patchSettings(API.github.setStatusCheck, { block_merge_on_critical: v }, "status_check", "Status checks updated") }),
        h("div", { style: { marginTop: 8 } },
          h("label", { className: "flabel" }, "Check name"),
          h("input", { className: "field mono", defaultValue: statusCheck.check_name || "", style: { fontSize: 12, maxWidth: 280 },
            onBlur: (e) => patchSettings(API.github.setStatusCheck, { check_name: e.target.value.trim() }, "status_check", "Check name saved") }))));

    return h("div", { className: "vs-page-pad vs-page-enter", style: { maxWidth: 760 }, "data-screen-label": "Integrations" },
      h(PageHead, { title: "Integrations", desc: "Connect Akira AI to your development workflow." }),
      connectionCard,
      expandedSettings,
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
