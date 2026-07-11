// TanoAudit — Public marketing site (Resend-inspired dark theme).
// Exposes window.LandingPage. Hash-routed public pages (#/features, #/how-it-works,
// #/docs, #/resources) — all client-side, shareable, no backend involvement.
// `onGetStarted` / `onLogin` advance to the auth screen.
(function () {
  const React = window.React;
  const { useEffect, useRef, useState } = React;
  const h = React.createElement;

  // Public pages reachable from the nav/footer. Anything TanoAudit doesn't actually
  // offer (pricing, CLI, SDKs) is intentionally omitted.
  const NAV = [
    ["Features", "#/features"],
    ["How it works", "#/how-it-works"],
    ["Docs", "#/docs"],
    ["Resources", "#/resources"],
  ];

  // ---- Asset placeholder -------------------------------------------------------
  // Stands in for every spot where Resend ships a bespoke visual/animation. A
  // dashed, labeled box so it's obvious art belongs here — to be filled later.
  function Placeholder({ label, height, className }) {
    return h("div", {
      className: "akl-ph" + (className ? " " + className : ""),
      style: height ? { height } : null,
      role: "img",
      "aria-label": label || "visual placeholder",
    },
      h("span", { className: "akl-ph-label" }, label || "Visual placeholder"),
    );
  }

  // ---- Shared nav + footer -----------------------------------------------------
  function go(hash) {
    if (window.location.hash !== hash) window.location.hash = hash;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function Nav({ onGetStarted, onLogin }) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
      const onScroll = () => setScrolled(window.scrollY > 12);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return h("header", { className: "akl-nav" + (scrolled ? " akl-nav-solid" : "") },
      h("div", { className: "akl-nav-inner" },
        h("a", {
          className: "akl-brand", href: "#/",
          onClick: (e) => { e.preventDefault(); go("#/"); },
        }, h("span", { className: "akl-brand-text" }, "TanoAudit")),
        h("nav", { className: "akl-nav-links" },
          NAV.map(([label, hash]) => h("a", {
            key: hash, href: hash, className: "akl-nav-link",
            onClick: (e) => { e.preventDefault(); go(hash); },
          }, label)),
        ),
        h("div", { className: "akl-nav-actions" },
          h("button", { className: "akl-link-btn", onClick: onLogin }, "Log in"),
          h("button", { className: "akl-pill-btn", onClick: onGetStarted }, "Get started"),
        ),
      ),
    );
  }

  function Footer() {
    const cols = [
      ["Product", [["Features", "#/features"], ["How it works", "#/how-it-works"], ["Docs", "#/docs"]]],
      ["Resources", [["Resources", "#/resources"], ["Blog", "#/resources"], ["Changelog", "#/resources"]]],
      ["Company", [["About", "#/resources"], ["Contact", "#/resources"]]],
      ["Legal", [["Privacy", "#/resources"], ["Terms", "#/resources"], ["Security", "#/resources"]]],
    ];
    return h("footer", { className: "akl-footer" },
      h("div", { className: "akl-footer-cols" },
        h("div", { className: "akl-footer-brand" },
          h("span", { className: "akl-brand-text" }, "TanoAudit"),
          h("p", { className: "akl-footer-tag" }, "AI security scanning for modern engineering teams."),
        ),
        cols.map(([head, links]) =>
          h("div", { key: head, className: "akl-footer-col" },
            h("div", { className: "akl-footer-head" }, head),
            links.map(([l, hash], i) => h("a", {
              key: l + i, href: hash, className: "akl-footer-link",
              onClick: (e) => { e.preventDefault(); go(hash); },
            }, l)),
          )),
      ),
      h("div", { className: "akl-footer-bar" },
        h("span", { className: "akl-footer-copy" }, "© " + new Date().getFullYear() + " TanoAudit. All rights reserved."),
        h("div", { className: "akl-footer-social" },
          ["GitHub", "X", "LinkedIn"].map((s) => h("a", { key: s, href: "#", className: "akl-footer-link" }, s)),
        ),
      ),
    );
  }

  // A consistent page header for the supporting pages.
  function PageHead({ kicker, title, lead }) {
    return h("section", { className: "akl-pagehead" },
      kicker && h("div", { className: "akl-kicker" }, kicker),
      h("h1", { className: "akl-page-title" }, title),
      lead && h("p", { className: "akl-lead akl-page-lead" }, lead),
    );
  }

  function Feature({ kicker, title, body, children }) {
    return h("section", { className: "akl-feature" },
      h("div", { className: "akl-feature-copy" },
        kicker && h("div", { className: "akl-kicker" }, kicker),
        h("h2", { className: "akl-h2" }, title),
        h("p", { className: "akl-lead" }, body),
      ),
      h("div", { className: "akl-feature-art" }, children),
    );
  }

  // ---- Reused content blocks ---------------------------------------------------
  function AppIcon({ className }) {
    return h("div", { className: "akl-appicon " + (className || "") },
      h("div", { className: "akl-appicon-inner" },
        h("svg", { viewBox: "0 0 100 100", className: "akl-appicon-svg" },
          h("defs", null,
            // Noise filter for metallic grain texture (ultra-fine and subtle)
            h("filter", { id: "noise-filter", x: "0%", y: "0%", width: "100%", height: "100%" },
              h("feTurbulence", { type: "fractalNoise", baseFrequency: "2.0", numOctaves: "3", result: "noise" }),
              h("feColorMatrix", { type: "matrix", values: "0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 0.045 0", result: "coloredNoise" }),
              h("feComposite", { operator: "in", in2: "SourceGraphic" }),
              h("feBlend", { mode: "overlay", in: "SourceGraphic", in2: "coloredNoise" })
            ),
            // Shield gradient
            h("linearGradient", { id: "shield-grad", x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
              h("stop", { offset: "0%", stopColor: "#ffffff" }),
              h("stop", { offset: "100%", stopColor: "rgba(255, 255, 255, 0.2)" })
            ),
            // Background gradient for card (dark obsidian brushed metal look)
            h("linearGradient", { id: "bg-grad", x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
              h("stop", { offset: "0%", stopColor: "#0d0e12" }),
              h("stop", { offset: "50%", stopColor: "#07080a" }),
              h("stop", { offset: "100%", stopColor: "#0a0b0d" })
            ),
            // Metallic border gradient (top silver, bottom green highlights)
            h("linearGradient", { id: "border-grad", x1: "0%", y1: "0%", x2: "0%", y2: "100%" },
              h("stop", { offset: "0%", stopColor: "rgba(255, 255, 255, 0.22)" }),
              h("stop", { offset: "70%", stopColor: "rgba(0, 228, 159, 0.15)" }),
              h("stop", { offset: "100%", stopColor: "rgba(0, 228, 159, 0.65)" })
            ),
            // Shield back glow (green, smooth 3-stop transition)
            h("radialGradient", { id: "shield-backglow", cx: "50%", cy: "48%", r: "45%" },
              h("stop", { offset: "0%", stopColor: "rgba(16, 185, 129, 0.22)" }),
              h("stop", { offset: "60%", stopColor: "rgba(16, 185, 129, 0.05)" }),
              h("stop", { offset: "100%", stopColor: "rgba(16, 185, 129, 0)" })
            )
          ),
          // Background rounded square with noise texture
          h("rect", {
            x: "1",
            y: "1",
            width: "98",
            height: "98",
            rx: "22",
            fill: "url(#bg-grad)",
            stroke: "url(#border-grad)",
            strokeWidth: "1.2",
            filter: "url(#noise-filter)",
            className: "akl-appicon-bg-rect"
          }),
          // Radial back glow layer
          h("circle", { cx: "50", cy: "48", r: "35", fill: "url(#shield-backglow)", className: "akl-appicon-glow-layer" }),
          // Light rays (12 lines spaced evenly)
          h("g", { className: "akl-appicon-rays" },
            Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x2 = 50 + Math.cos(angle) * 25;
              const y2 = 48 + Math.sin(angle) * 25;
              return h("line", {
                key: i,
                x1: "50",
                y1: "48",
                x2: x2.toFixed(1),
                y2: y2.toFixed(1),
                stroke: "rgba(16, 185, 129, 0.06)",
                strokeWidth: "1.0"
              });
            })
          ),
          // Shield & checkmark group
          h("g", { className: "akl-appicon-shield-group" },
            h("path", {
              d: "M50 24 L68 31 V47 C68 59 50 70 50 74 C50 70 32 59 32 47 V31 Z",
              className: "akl-appicon-shield",
              fill: "rgba(16, 185, 129, 0.015)",
              stroke: "url(#shield-grad)",
              strokeWidth: "2.2",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }),
            h("path", {
              d: "M43 47 L48 52 L57 41",
              className: "akl-appicon-check",
              fill: "none",
              stroke: "#10b981",
              strokeWidth: "2.8",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            })
          ),
          // Scanner line
          h("line", {
            x1: "28",
            y1: "0",
            x2: "72",
            y2: "0",
            className: "akl-appicon-scanner"
          })
        )
      )
    );
  }

  function LogoWall() {
    const row1 = ["stripe", "vercel", "github", "airbnb", "netflix", "slack"];
    const row2 = ["supabase", "linear", "figma", "discord", "raycast", "railway"];

    return h("section", { className: "akl-logos" },
      h("p", { className: "akl-logos-label" },
        "Security teams of all sizes trust TanoAudit", h("br"),
        "to scan their most important code.",
      ),
      h("div", { className: "akl-logos-grid" },
        h("div", { className: "akl-logos-row" },
          row1.map((brand) => h("span", { key: brand, className: "akl-logo-slot" },
            h("img", { src: `logos/${brand}.svg`, className: "akl-logo-img", alt: brand })
          )),
        ),
        h("div", { className: "akl-logos-row" },
          row2.map((brand) => {
            const hasText = brand === "figma" || brand === "railway" || brand === "raycast";
            const displayName = brand === "figma" ? "figma" : (brand === "railway" ? "Railway" : "Raycast");
            return h("span", { key: brand, className: "akl-logo-slot" },
              h("img", { src: `logos/${brand}.svg`, className: "akl-logo-img", alt: brand }),
              hasText && h("span", { className: "akl-logo-text" }, displayName)
            );
          }),
        ),
      )
    );
  }

  // Mirrors Resend's "Integrate this weekend": centered gradient headline + lead,
  // a row of integration-target chips, then a large visual panel. TanoAudit's real
  // model is connect-a-GitHub-repo or upload-a-ZIP, then scan from the dashboard —
  // so the chips name real entry points and the panel is a blank placeholder.
  function IntegrateBand() {
    const targets = ["GitHub", "Upload ZIP", "Dashboard", "Live stream", "Report", "Fix plans"];
    return h("section", { className: "akl-integrate" },
      h("h2", { className: "akl-h2 akl-center-h2" },
        "Scan your first repo ", h("span", { className: "akl-grad-word" }, "in minutes"),
      ),
      h("p", { className: "akl-lead akl-center-lead" },
        "No agents, no config files, no security team required. Connect a GitHub",
        h("br"),
        "repository or upload a project, then start a deep scan from the dashboard.",
      ),
      h("div", { className: "akl-lang-strip" },
        targets.map((n) => h("div", { key: n, className: "akl-lang-chip" },
          h("div", { className: "akl-lang-icon" }),
          h("span", { className: "akl-lang-name" }, n),
        )),
      ),
      h(Placeholder, { label: "Workflow visual", className: "akl-ph-editor" }),
    );
  }

  // Resend's "First-class developer experience" — a left-aligned big heading
  // with a two-line lead. Section anchor between bands.
  function SectionHeading({ title, lead }) {
    return h("section", { className: "akl-section-heading" },
      h("h2", { className: "akl-big-heading" }, title),
      lead && h("p", { className: "akl-lead akl-big-lead" }, lead),
    );
  }

  // Resend's two-up visual cards ("Test mode" + "Modular webhooks"): a large
  // visual panel on top, then icon + title + body + "Learn more".
  function TwoUpCards({ items }) {
    return h("section", { className: "akl-twoup" },
      items.map((it, i) =>
        h("article", { key: i, className: "akl-twoup-card" },
          h("div", { className: "akl-twoup-visual" }, it.visual),
          h("div", { className: "akl-twoup-body" },
            h("div", { className: "akl-twoup-icon" }, it.icon),
            h("h3", { className: "akl-twoup-title" }, it.title),
            h("p", { className: "akl-twoup-text" }, it.body),
            h("a", { href: it.href || "#/features", className: "akl-learn-more",
              onClick: (e) => { e.preventDefault(); go(it.href || "#/features"); } }, "Learn more"),
          ),
        )),
    );
  }

  // Stat band structure with blank slots — no metrics are claimed yet.
  function Stats() {
    return h("section", { className: "akl-stats" },
      Array.from({ length: 4 }).map((_, i) =>
        h("div", { key: i, className: "akl-stat" },
          h("div", { className: "akl-stat-num akl-stat-slot" }),
          h("div", { className: "akl-stat-label akl-stat-slot-sm" }),
        )),
    );
  }

  const FEATURE_ITEMS = [
    ["Deep code analysis", "AI reads your code like a senior reviewer — taint flows, auth gaps, injection paths.", "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"],
    ["Dependency audits", "Every package, transitive included, checked against live CVE feeds.", "M4 7l8-4 8 4v10l-8 4-8-4V7z M12 3v18"],
    ["Secret detection", "Catches leaked keys, tokens, and credentials before they hit production.", "M12 2a5 5 0 015 5v3h1a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2h1V7a5 5 0 015-5z"],
    ["CI/CD gates", "Block merges on critical findings with a status check on every PR.", "M5 12h14 M12 5l7 7-7 7"],
    ["Fix plans", "Concrete, reviewed remediations with an applyable diff for each issue.", "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
    ["Live streaming", "Watch a scan progress file-by-file in real time over WebSocket.", "M2 12h4l3 8 4-16 3 8h4"],
  ];

  function FeatureCard({ title, body, d }) {
    return h("div", { className: "akl-grid-card" },
      h("div", { className: "akl-grid-icon" },
        h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "var(--accent, #10b981)", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d }))),
      h("h3", { className: "akl-grid-title" }, title),
      h("p", { className: "akl-grid-body" }, body),
    );
  }

  function FeatureGrid() {
    return h("section", { className: "akl-grid-section" },
      h("div", { className: "akl-grid-head" },
        h("div", { className: "akl-kicker" }, "One scan, every layer"),
        h("h2", { className: "akl-h2" }, "Code, dependencies, and secrets — covered"),
      ),
      h("div", { className: "akl-grid" },
        FEATURE_ITEMS.map(([title, body, d], i) => h(FeatureCard, { key: i, title, body, d })),
      ),
    );
  }

  // Testimonial-card structure with blank slots — no quotes are invented.
  function Testimonials() {
    return h("section", { className: "akl-quotes" },
      h("div", { className: "akl-grid-head" },
        h("div", { className: "akl-kicker" }, "Built for security teams"),
        h("h2", { className: "akl-h2" }, "Catching real vulnerabilities in production code"),
      ),
      h("div", { className: "akl-quotes-row" },
        Array.from({ length: 3 }).map((_, i) =>
          h("figure", { key: i, className: "akl-quote-card" },
            h(Placeholder, { label: "Testimonial", height: 96 }),
            h("figcaption", { className: "akl-quote-by" },
              h("span", { className: "akl-quote-name akl-stat-slot-sm" }),
              h("span", { className: "akl-quote-role akl-stat-slot-sm" }),
            ),
          )),
      ),
    );
  }

  function CtaBand({ onGetStarted }) {
    return h("section", { className: "akl-cta-band" },
      h("h2", { className: "akl-h2 akl-cta-title" }, "Find what your linter misses."),
      h("p", { className: "akl-lead" }, "Connect a repository and run your first deep scan in minutes."),
      h("button", { className: "akl-pill-btn akl-pill-lg", onClick: onGetStarted }, "Get started"),
    );
  }

  // ---- Home (landing) ----------------------------------------------------------
  function Home({ onGetStarted, onLogin }) {
    return h(React.Fragment, null,
      // ---- Hero ----
      h("section", { className: "akl-hero" },
        h("div", { className: "akl-hero-copy" },
          h("button", { className: "akl-announce", onClick: onGetStarted },
            "Introducing TanoAudit deep scans", h("span", { className: "akl-announce-arrow" }, " ›"),
          ),
          h("h1", { className: "akl-hero-title" }, "Security", h("br"), "for developers"),
          h("p", { className: "akl-hero-sub" },
            "The fastest way to find real vulnerabilities instead of noise.",
            h("br"),
            "AI-powered code scanning, dependency audits, and fix plans at scale.",
          ),
          h("div", { className: "akl-hero-cta" },
            h("button", { className: "akl-pill-btn akl-pill-lg", onClick: onGetStarted }, "Get started"),
            h("button", { className: "akl-ghost-btn", onClick: () => go("#/docs") }, "Documentation"),
          ),
        ),
        // Hero visual — Spline 3D embed. The watermark badge (bottom-right of the
        // Spline scene) is cross-origin, so we can't hide it via CSS inside the
        // iframe; instead an overlay chip covers that corner.
        h("div", { className: "akl-hero-spline" },
          h("iframe", {
            src: "https://my.spline.design/glassknotvortex-AM7Mgo2SDGKDYnPbqzsw8zdH/",
            title: "TanoAudit hero visual",
            frameBorder: "0",
            loading: "lazy",
            allow: "autoplay; fullscreen",
            allowTransparency: "true",
            className: "akl-spline-frame",
          }),
          h("div", { className: "akl-spline-mask", "aria-hidden": "true" }),
        ),
      ),

      h(LogoWall),

      // ---- "Integrate this weekend" ----
      h(IntegrateBand),

      // ---- "First-class developer experience" ----
      h(SectionHeading, {
        title: ["Reviews code like", h("br", { key: "br" }), "a senior engineer"],
        lead: h(React.Fragment, null,
          "TanoAudit doesn't pattern-match — it reads your code in context, tracing taint flows,", h("br"),
          "auth gaps, and injection paths across files the way a human reviewer would.",
        ),
      }),

      // ---- Two-up cards (Resend "Test mode" + "Modular webhooks") ----
      // Visuals are blank placeholders; copy describes only real TanoAudit capabilities.
      h(TwoUpCards, { items: [
        {
          icon: "◷", title: "Live scan streaming",
          body: "Watch a scan progress file-by-file in real time over WebSocket — no waiting on a black box to finish.",
          visual: h(Placeholder, { label: "Live scan visual", height: 200 }),
        },
        {
          icon: "◆", title: "Ranked findings",
          body: "Issues arrive ranked by exploitability, deduped, and explained — so you triage what matters first.",
          visual: h(Placeholder, { label: "Findings visual", height: 200 }),
        },
      ] }),

      // ---- "Write using a delightful editor" → centered icon + heading + lead + visual ----
      h("section", { className: "akl-editor-feature" },
        h(Placeholder, { label: "Section icon", className: "akl-ph-orb" }),
        h("h2", { className: "akl-big-heading akl-center-h2" }, "Findings you can actually trust"),
        h("p", { className: "akl-lead akl-center-lead" },
          "A report that's easy for anyone to triage. TanoAudit ranks every issue by", h("br"),
          "exploitability, dedupes the noise, and explains the blast radius.",
        ),
        h(Placeholder, { label: "Report visual", className: "akl-ph-editor-wide" }),
      ),

      // ---- "Go beyond editing" → "Go beyond linting" + two cards ----
      h(SectionHeading, {
        title: "More than a linter",
        lead: h(React.Fragment, null,
          "TanoAudit goes past static rules — it audits your dependencies for known", h("br"),
          "vulnerabilities and tracks how your security posture trends over time.",
        ),
      }),
      h(TwoUpCards, { items: [
        {
          icon: "◫", title: "Dependency audits",
          body: "Audit every package, transitive included, against known-vulnerability data. Full visibility into each dependency.",
          href: "#/features",
          visual: h(Placeholder, { label: "Dependencies visual", height: 200 }),
        },
        {
          icon: "◰", title: "Scan analytics",
          body: "Understand how your security posture is trending over time, scan by scan, across every repository.",
          href: "#/features",
          visual: h(Placeholder, { label: "Analytics visual", height: 200 }),
        },
      ] }),

      h(Stats),
      h(FeatureGrid),
      h(Testimonials),
      h(CtaBand, { onGetStarted }),
    );
  }

  // ---- Features page -----------------------------------------------------------
  function FeaturesPage({ onGetStarted }) {
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "Features",
        title: "Everything you need to ship secure code",
        lead: "TanoAudit combines AI code analysis, dependency auditing, and concrete fix plans into one workflow that lives in your pipeline.",
      }),
      h("div", { className: "akl-pagebody" },
        h(Placeholder, { label: "Product screenshot", height: 420, className: "akl-ph-wide" }),
      ),
      h(FeatureGrid),
      h(SectionHeading, {
        title: "Depth where it matters",
        lead: "Choose how deep each scan goes — from a fast PR check to an exhaustive audit.",
      }),
      h(TwoUpCards, { items: [
        {
          icon: "🧠", title: "AI code analysis",
          body: "TanoAudit reads your code like a senior reviewer — tracing taint flows, auth gaps, and injection paths across files.",
          visual: h(Placeholder, { label: "Analysis flow", height: 200 }),
        },
        {
          icon: "🔒", title: "Secret & dependency scanning",
          body: "Catches leaked keys before they ship and checks every package, transitive included, against live CVE feeds.",
          visual: h(Placeholder, { label: "Dependency graph", height: 200 }),
        },
      ] }),
      h(CtaBand, { onGetStarted }),
    );
  }

  // ---- How it works page -------------------------------------------------------
  function HowItWorksPage({ onGetStarted }) {
    const steps = [
      ["01", "Connect your repository", "Link a GitHub repo (or upload a project). TanoAudit clones, indexes, and prepares it for analysis."],
      ["02", "Run a scan", "Kick off a deep scan from the dashboard. Watch it progress file-by-file in real time."],
      ["03", "Triage real findings", "Issues arrive ranked by exploitability, deduped, and explained — not a wall of noise."],
      ["04", "Apply the fix", "Each finding ships with a reviewed remediation and an applyable diff you can turn into a PR."],
    ];
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "How it works",
        title: "From repository to remediation in four steps",
        lead: "TanoAudit fits the way your team already works — connect, scan, triage, and fix without leaving your flow.",
      }),
      h("section", { className: "akl-steps" },
        steps.map(([num, title, body], i) =>
          h("div", { key: i, className: "akl-step" },
            h("div", { className: "akl-step-num" }, num),
            h("div", { className: "akl-step-copy" },
              h("h3", { className: "akl-grid-title" }, title),
              h("p", { className: "akl-grid-body" }, body),
            ),
            h(Placeholder, { label: "Step " + num + " visual", height: 160, className: "akl-step-art" }),
          )),
      ),
      h(CtaBand, { onGetStarted }),
    );
  }

  // ---- Docs page ---------------------------------------------------------------
  function DocsPage() {
    const sections = [
      ["Getting started", "Create an account, connect a repository, and run your first scan in minutes."],
      ["Scans", "How scans are scoped, what depth modes mean, and how to read a scan report."],
      ["Findings & severities", "Understand severity levels, confidence, CWE/OWASP references, and dedup logic."],
      ["Fix plans", "How TanoAudit generates remediations and how to apply a suggested diff."],
      ["GitHub integration", "Connect GitHub, sign in with GitHub, enable PR status checks and auto-scans."],
      ["Account & security", "Profile, sessions, two-factor authentication, and data settings."],
    ];
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "Documentation",
        title: "Docs",
        lead: "Guides and reference for getting the most out of TanoAudit. This section is being filled out — start with the basics below.",
      }),
      h("section", { className: "akl-doclist" },
        sections.map(([title, body], i) =>
          h("a", { key: i, href: "#/docs", className: "akl-doc-card", onClick: (e) => e.preventDefault() },
            h("h3", { className: "akl-grid-title" }, title),
            h("p", { className: "akl-grid-body" }, body),
            h("span", { className: "akl-doc-soon" }, "Coming soon"),
          )),
      ),
    );
  }

  // ---- Resources page ----------------------------------------------------------
  function ResourcesPage() {
    const cards = [
      ["Blog", "Engineering notes, security write-ups, and product updates."],
      ["Changelog", "What's new in TanoAudit, release by release."],
      ["Security", "How we handle your code and data, and our disclosure policy."],
      ["About", "Why we're building AI-native security tooling for developers."],
    ];
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "Resources",
        title: "Resources",
        lead: "Reading, updates, and background on TanoAudit. More to come — placeholders mark what's on the way.",
      }),
      h("section", { className: "akl-grid-section akl-grid-tight" },
        h("div", { className: "akl-grid akl-grid-2" },
          cards.map(([title, body], i) =>
            h("div", { key: i, className: "akl-grid-card" },
              h(Placeholder, { label: title + " cover", height: 140 }),
              h("h3", { className: "akl-grid-title", style: { marginTop: 16 } }, title),
              h("p", { className: "akl-grid-body" }, body),
            )),
        ),
      ),
    );
  }

  // ---- Router ------------------------------------------------------------------
  function currentRoute() {
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (hash === "/features") return "features";
    if (hash === "/how-it-works") return "how";
    if (hash === "/docs") return "docs";
    if (hash === "/resources") return "resources";
    return "home";
  }

  function LandingPage({ onGetStarted, onLogin }) {
    const [route, setRoute] = useState(currentRoute());
    useEffect(() => {
      const onHash = () => { setRoute(currentRoute()); window.scrollTo({ top: 0 }); };
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);

    let body;
    switch (route) {
      case "features": body = h(FeaturesPage, { onGetStarted }); break;
      case "how": body = h(HowItWorksPage, { onGetStarted }); break;
      case "docs": body = h(DocsPage); break;
      case "resources": body = h(ResourcesPage); break;
      default: body = h(Home, { onGetStarted, onLogin });
    }

    return h("div", { className: "akl-root" },
      h(Nav, { onGetStarted, onLogin }),
      body,
      h(Footer),
    );
  }

  window.LandingPage = LandingPage;
})();
