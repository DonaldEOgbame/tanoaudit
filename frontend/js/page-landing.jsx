// Akira AI — Public marketing site (Resend-inspired dark theme).
// Exposes window.LandingPage. Hash-routed public pages (#/features, #/how-it-works,
// #/docs, #/resources) — all client-side, shareable, no backend involvement.
// `onGetStarted` / `onLogin` advance to the auth screen.
(function () {
  const React = window.React;
  const { useEffect, useRef, useState } = React;
  const h = React.createElement;

  // Public pages reachable from the nav/footer. Anything Akira doesn't actually
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
        }, h("img", { src: "logo.svg", alt: "Akira AI", className: "akl-brand-logo" })),
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
          h("img", { src: "logo.svg", alt: "Akira AI", className: "akl-brand-logo" }),
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
        h("span", { className: "akl-footer-copy" }, "© " + new Date().getFullYear() + " Akira AI. All rights reserved."),
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
  // Mirrors Resend's "Companies of all sizes trust…" band: a centered two-line
  // label, two rows of (blank) logo slots, and a single app-icon placeholder.
  // No real companies are named — Akira makes no customer claims here.
  function LogoWall() {
    const row1 = [
      { name: "Stripe", path: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" },
      { name: "Vercel", path: "m12 1.608 12 20.784H0Z" },
      { name: "GitHub", path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
      { name: "Airbnb", path: "M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z" },
      { name: "Netflix", path: "m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z" },
      { name: "Slack", path: "M7.16 2.392a2.392 2.392 0 1 1-2.392-2.392h2.392zM7.16 4.784a2.392 2.392 0 1 1 0 4.784H2.392A2.392 2.392 0 1 1 2.392 4.784zM2.392 7.16a2.392 2.392 0 1 1 2.392 2.392H0zM0 7.16a2.392 2.392 0 1 1 2.392-2.392v2.392zM16.839 7.16a2.392 2.392 0 1 1 2.392 2.392h-2.392zM16.839 4.784a2.392 2.392 0 1 1 0-4.784h4.784a2.392 2.392 0 1 1 0 4.784zM14.448 2.392a2.392 2.392 0 1 1-2.392-2.392h2.392zM14.448 4.784a2.392 2.392 0 1 1 0 4.784h-4.784a2.392 2.392 0 1 1 0-4.784z" }
    ];

    const row2 = [
      { name: "Supabase", path: "M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" },
      { name: "Linear", path: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" },
      { name: "Figma", path: "M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z" },
      { name: "Discord", path: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" },
      { name: "Raycast", path: "M6.004 15.492v2.504L0 11.992l1.258-1.249Zm2.504 2.504H6.004L12.008 24l1.253-1.253zm14.24-4.747L24 11.997 12.003 0 10.75 1.251 15.491 6h-2.865L9.317 2.692 8.065 3.944l2.06 2.06H8.691v9.31H18v-1.432l2.06 2.06 1.252-1.252-3.312-3.32V8.506ZM6.63 5.372 5.38 6.625l1.342 1.343 1.251-1.253Zm10.655 10.655-1.247 1.251 1.342 1.343 1.253-1.251zM3.944 8.059 2.692 9.31l3.312 3.314v-2.506zm9.936 9.937h-2.504l3.314 3.312 1.25-1.252z" },
      { name: "Railway", path: "M.113 10.27A13.026 13.026 0 000 11.48h18.23c-.064-.125-.15-.237-.235-.347-3.117-4.027-4.793-3.677-7.19-3.78-.8-.034-1.34-.048-4.524-.048-1.704 0-3.555.005-5.358.01-.234.63-.459 1.24-.567 1.737h9.342v1.216H.113v.002zm18.26 2.426H.009c.02.326.05.645.094.961h16.955c.754 0 1.179-.429 1.315-.96zm-17.318 4.28s2.81 6.902 10.93 7.024c4.855 0 9.027-2.883 10.92-7.024H1.056zM11.988 0C7.5 0 3.593 2.466 1.531 6.108l4.75-.005v-.002c3.71 0 3.849.016 4.573.047l.448.016c1.563.052 3.485.22 4.996 1.364.82.621 2.007 1.99 2.712 2.965.654.902.842 1.94.396 2.934-.408.914-1.289 1.458-2.353 1.458H.391s.099.42.249.886h22.748A12.026 12.026 0 0024 12.005C24 5.377 18.621 0 11.988 0z" }
    ];

    return h("section", { className: "akl-logos" },
      h("p", { className: "akl-logos-label" },
        "Security teams of all sizes trust Akira", h("br"),
        "to scan their most important code.",
      ),
      h("div", { className: "akl-logos-grid" },
        h("div", { className: "akl-logos-row" },
          row1.map((logo) => h("span", { key: logo.name, className: "akl-logo-slot", title: logo.name },
            h("svg", { viewBox: "0 0 24 24", className: "akl-logo-svg" },
              h("path", { d: logo.path })
            )
          )),
        ),
        h("div", { className: "akl-logos-row" },
          row2.map((logo) => h("span", { key: logo.name, className: "akl-logo-slot", title: logo.name },
            h("svg", { viewBox: "0 0 24 24", className: "akl-logo-svg" },
              h("path", { d: logo.path })
            )
          )),
        ),
      ),
      h(Placeholder, { label: "App icon", className: "akl-ph-appicon" }),
    );
  }

  // Mirrors Resend's "Integrate this weekend": centered gradient headline + lead,
  // a row of integration-target chips, then a large visual panel. Akira's real
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
            "Introducing Akira deep scans", h("span", { className: "akl-announce-arrow" }, " ›"),
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
            title: "Akira hero visual",
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
          "Akira doesn't pattern-match — it reads your code in context, tracing taint flows,", h("br"),
          "auth gaps, and injection paths across files the way a human reviewer would.",
        ),
      }),

      // ---- Two-up cards (Resend "Test mode" + "Modular webhooks") ----
      // Visuals are blank placeholders; copy describes only real Akira capabilities.
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
          "A report that's easy for anyone to triage. Akira ranks every issue by", h("br"),
          "exploitability, dedupes the noise, and explains the blast radius.",
        ),
        h(Placeholder, { label: "Report visual", className: "akl-ph-editor-wide" }),
      ),

      // ---- "Go beyond editing" → "Go beyond linting" + two cards ----
      h(SectionHeading, {
        title: "More than a linter",
        lead: h(React.Fragment, null,
          "Akira goes past static rules — it audits your dependencies for known", h("br"),
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
        lead: "Akira combines AI code analysis, dependency auditing, and concrete fix plans into one workflow that lives in your pipeline.",
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
          body: "Akira reads your code like a senior reviewer — tracing taint flows, auth gaps, and injection paths across files.",
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
      ["01", "Connect your repository", "Link a GitHub repo (or upload a project). Akira clones, indexes, and prepares it for analysis."],
      ["02", "Run a scan", "Kick off a deep scan from the dashboard. Watch it progress file-by-file in real time."],
      ["03", "Triage real findings", "Issues arrive ranked by exploitability, deduped, and explained — not a wall of noise."],
      ["04", "Apply the fix", "Each finding ships with a reviewed remediation and an applyable diff you can turn into a PR."],
    ];
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "How it works",
        title: "From repository to remediation in four steps",
        lead: "Akira fits the way your team already works — connect, scan, triage, and fix without leaving your flow.",
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
      ["Fix plans", "How Akira generates remediations and how to apply a suggested diff."],
      ["GitHub integration", "Connect GitHub, sign in with GitHub, enable PR status checks and auto-scans."],
      ["Account & security", "Profile, sessions, two-factor authentication, and data settings."],
    ];
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "Documentation",
        title: "Docs",
        lead: "Guides and reference for getting the most out of Akira. This section is being filled out — start with the basics below.",
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
      ["Changelog", "What's new in Akira, release by release."],
      ["Security", "How we handle your code and data, and our disclosure policy."],
      ["About", "Why we're building AI-native security tooling for developers."],
    ];
    return h(React.Fragment, null,
      h(PageHead, {
        kicker: "Resources",
        title: "Resources",
        lead: "Reading, updates, and background on Akira. More to come — placeholders mark what's on the way.",
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
