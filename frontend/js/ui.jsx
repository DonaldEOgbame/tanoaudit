// VaultScan UI primitives: count-up, gauges, badges, code highlighter, toasts, helpers
(function () {
  const React = window.React;
  const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;
  const h = React.createElement;
  const Icons = window.Icons;

  const SEV = {
    critical: { label: "Critical", color: "var(--sev-critical)", bg: "var(--sev-critical-bg)" },
    high: { label: "High", color: "var(--sev-high)", bg: "var(--sev-high-bg)" },
    medium: { label: "Medium", color: "var(--sev-medium)", bg: "var(--sev-medium-bg)" },
    low: { label: "Low", color: "var(--sev-low)", bg: "var(--sev-low-bg)" },
    info: { label: "Info", color: "var(--sev-info)", bg: "var(--sev-info-bg)" },
    clean: { label: "Clean", color: "var(--sev-clean)", bg: "var(--sev-clean-bg)" },
    opt: { label: "Optimization", color: "var(--sev-opt)", bg: "var(--sev-opt-bg)" },
    stub: { label: "Stub", color: "var(--sev-stub)", bg: "var(--sev-stub-bg)" },
  };
  window.SEV = SEV;

  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ---- count-up hook (timer-driven: robust where rAF is throttled) ----
  function useCountUp(target, duration, deps) {
    const [val, setVal] = useState(0);
    useEffect(() => {
      if (prefersReduced()) { setVal(target); return; }
      const dur = duration || 900;
      const start = performance.now();
      const iv = setInterval(() => {
        const p = Math.min((performance.now() - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(target * eased);
        if (p >= 1) { setVal(target); clearInterval(iv); }
      }, 28);
      return () => clearInterval(iv);
    }, deps || [target]);
    return val;
  }
  window.useCountUp = useCountUp;

  function CountUp({ value, duration, decimals, suffix, className, style }) {
    const v = useCountUp(value, duration);
    const d = decimals || 0;
    return h("span", { className, style }, v.toFixed(d) + (suffix || ""));
  }
  window.CountUp = CountUp;

  // ---- Score block (number + label) ----
  function ScoreGauge({ value, size, label, sublabel, colorFor }) {
    const v = useCountUp(value, 1100);
    const color = colorFor ? colorFor(value) : "var(--accent)";
    return h("div", { style: { textAlign: "center", padding: "4px 22px" } },
      h("div", { style: { fontSize: 48, fontWeight: 750, color, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 } }, Math.round(v)),
      label && h("div", { style: { fontSize: 10.5, fontWeight: 650, color: "var(--text-2)", marginTop: 7, textTransform: "uppercase", letterSpacing: "0.09em" } }, label),
      sublabel && h("div", { style: { fontSize: 11, color: "var(--text-3)", marginTop: 2 } }, sublabel),
    );
  }
  window.ScoreGauge = ScoreGauge;

  // ---- AI-gen percentage number (replaces donut chart) ----
  function Donut({ value, size, color }) {
    const v = useCountUp(value, 1100);
    return h("div", { style: { textAlign: "center", padding: "20px 0 8px" } },
      h("div", { style: { fontSize: 64, fontWeight: 750, color: color || "var(--sev-opt)", letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", lineHeight: 1 } }, Math.round(v) + "%"),
    );
  }
  window.Donut = Donut;

  // ---- Severity badge ----
  function SevBadge({ sev, children, size }) {
    const s = SEV[sev] || SEV.info;
    return h("span", {
      className: "badge",
      style: { background: s.bg, color: s.color, fontSize: size === "sm" ? 10.5 : 11 },
    }, h("span", { className: "dot" }), children || s.label);
  }
  window.SevBadge = SevBadge;

  function SevDot({ sev, size }) {
    const s = SEV[sev] || SEV.info;
    return h("span", { className: "sev-dot", style: { width: size || 8, height: size || 8, background: s.color } });
  }
  window.SevDot = SevDot;

  // ---- Tag chip ----
  function Tag({ children, color, style }) {
    return h("span", {
      style: Object.assign({
        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px",
        borderRadius: 5, fontSize: 11, fontWeight: 550, fontFamily: "var(--font-mono)",
        background: "var(--bg-active)", color: color || "var(--text-2)", whiteSpace: "nowrap",
      }, style),
    }, children);
  }
  window.Tag = Tag;

  // ---- Simple syntax highlighter for JS ----
  const KW = /\b(const|let|var|function|return|async|await|if|else|for|while|new|require|module|exports|throw|try|catch|class|extends|of|in|typeof|null|true|false|undefined|this)\b/;
  function highlightLine(line) {
    // tokenize crude but stable
    const parts = [];
    let rest = line;
    // comments first
    const cIdx = rest.indexOf("//");
    let comment = "";
    if (cIdx >= 0 && !/['"`]/.test(rest.slice(0, cIdx).replace(/[^'"`]/g, ""))) {
      comment = rest.slice(cIdx);
      rest = rest.slice(0, cIdx);
    }
    const tokenRe = /(`[^`]*`|'[^']*'|"[^"]*"|\b\d+\b|[A-Za-z_$][\w$]*|\s+|[^\w\s])/g;
    let m, key = 0;
    while ((m = tokenRe.exec(rest)) !== null) {
      const t = m[0];
      if (/^\s+$/.test(t)) { parts.push(t); continue; }
      if (/^['"`]/.test(t)) { parts.push(h("span", { key: key++, className: "tok-str" }, t)); continue; }
      if (/^\d+$/.test(t)) { parts.push(h("span", { key: key++, className: "tok-num" }, t)); continue; }
      if (KW.test(t)) { parts.push(h("span", { key: key++, className: "tok-kw" }, t)); continue; }
      // function call: followed by (
      const after = rest.slice(m.index + t.length).match(/^\s*\(/);
      if (after && /^[A-Za-z_$]/.test(t)) { parts.push(h("span", { key: key++, className: "tok-fn" }, t)); continue; }
      // property access
      const before = rest[m.index - 1];
      if (before === "." && /^[A-Za-z_$]/.test(t)) { parts.push(h("span", { key: key++, className: "tok-prop" }, t)); continue; }
      parts.push(t);
    }
    if (comment) parts.push(h("span", { key: "c", className: "tok-com" }, comment));
    return parts;
  }
  window.highlightLine = highlightLine;

  // ---- Code block with optional highlighted lines ----
  function CodeBlock({ code, startLine, highlight, kind, style }) {
    const lines = code.split("\n");
    startLine = startLine || 1;
    const hl = new Set(highlight || []);
    return h("div", { className: "codeblock", style: Object.assign({ padding: "10px 0", overflowY: "auto" }, style) },
      lines.map((ln, i) =>
        h("div", { key: i, className: "codeline" + (hl.has(i) ? (kind === "added" ? " added" : " vuln") : "") },
          h("span", { className: "ln" }, startLine + i),
          h("span", { className: "lc" }, highlightLine(ln) ),
        )
      )
    );
  }
  window.CodeBlock = CodeBlock;

  // ---- Toast system ----
  const ToastCtx = createContext(null);
  window.useToast = function () { return useContext(ToastCtx); };

  function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const push = useCallback((t) => {
      const id = Math.random().toString(36).slice(2);
      const toast = Object.assign({ id, kind: "info", ttl: 3800 }, typeof t === "string" ? { msg: t } : t);
      setToasts((p) => [...p, toast]);
      setTimeout(() => {
        setToasts((p) => p.map((x) => x.id === id ? Object.assign({}, x, { leaving: true }) : x));
        setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 260);
      }, toast.ttl);
    }, []);
    const iconFor = { success: Icons.shieldCheck, error: Icons.alert, info: Icons.info, reroute: Icons.refresh, critical: Icons.alert };
    const colorFor = { success: "var(--sev-clean)", error: "var(--sev-critical)", info: "var(--accent)", reroute: "var(--sev-high)", critical: "var(--sev-critical)" };
    return h(ToastCtx.Provider, { value: push },
      children,
      h("div", { className: "toast-stack" },
        toasts.map((t) => {
          const I = iconFor[t.kind] || Icons.info;
          return h("div", { key: t.id, className: "toast" + (t.leaving ? " leaving" : "") },
            h("span", { style: { color: colorFor[t.kind], display: "flex" } }, h(I, { size: 17 })),
            h("div", { style: { flex: 1 } },
              t.title && h("div", { style: { fontWeight: 600, fontSize: 13 } }, t.title),
              h("div", { style: { color: t.title ? "var(--text-2)" : "var(--text-1)", fontSize: 12.5 } }, t.msg),
            ),
          );
        })
      )
    );
  }
  window.ToastProvider = ToastProvider;

  // ---- Switch ----
  function Switch({ on, onChange }) {
    return h("button", { className: "switch" + (on ? " on" : ""), onClick: () => onChange && onChange(!on), "aria-pressed": on });
  }
  window.Switch = Switch;

  // ---- Dropdown (custom select; renders dark in every browser, incl. Safari) ----
  // options: [{ value, label }] or ["a","b"].  value/onChange controlled.
  // The popover is position:fixed (measured from the trigger) so it escapes card
  // overflow/stacking and never gets clipped.
  function Dropdown({ options, value, onChange, defaultValue, width, size, minWidth }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const opts = (options || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
    // Uncontrolled mode: manage selection internally when `value` isn't supplied.
    const [internal, setInternal] = useState(defaultValue != null ? defaultValue : (opts[0] && opts[0].value));
    const triggerRef = useRef(null);
    const popRef = useRef(null);
    const selected = value != null ? value : internal;
    const current = opts.find((o) => o.value === selected) || opts[0] || { label: "" };
    const choose = (v) => { setInternal(v); onChange && onChange(v); };

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 4, width: r.width });
    }
    function toggle() {
      if (!open) place();
      setOpen((v) => !v);
    }
    useEffect(() => {
      if (!open) return;
      const onDoc = (e) => {
        if (triggerRef.current && triggerRef.current.contains(e.target)) return;
        if (popRef.current && popRef.current.contains(e.target)) return;
        setOpen(false);
      };
      const onScroll = () => setOpen(false);
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      return () => {
        document.removeEventListener("mousedown", onDoc);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
      };
    }, [open]);

    const pad = size === "sm" ? "5px 10px" : "8px 12px";
    const fs = size === "sm" ? 12.5 : 13.5;
    return h("div", { style: { position: "relative", width: width || "auto", minWidth: minWidth || 0, display: "inline-block" } },
      h("div", { ref: triggerRef, className: "field select-trigger", tabIndex: 0,
        style: { padding: pad, fontSize: fs, borderRadius: "var(--r-md)", width: "100%" },
        onClick: toggle,
        onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } if (e.key === "Escape") setOpen(false); } },
        h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, current.label),
        h(Icons.chevD, { size: 14, style: { color: "var(--text-3)", flexShrink: 0, marginLeft: 8, transition: "transform var(--dur-micro) ease", transform: open ? "rotate(180deg)" : "none" } })),
      open && pos && ReactDOM.createPortal(
        h("div", { ref: popRef, className: "select-popover floating",
          style: { left: pos.left, top: pos.top, minWidth: Math.max(pos.width, minWidth || 0) } },
          h("div", { className: "select-options-list" },
            opts.map((o) =>
              h("button", { key: o.value, className: "select-option-item" + (o.value === selected ? " selected" : ""),
                onClick: () => { setOpen(false); choose(o.value); } },
                o.value === selected && h(Icons.check, { size: 13, style: { flexShrink: 0 } }),
                h("span", { style: { flex: 1 } }, o.label))))),
        document.body
      ));
  }
  window.Dropdown = Dropdown;

  // ---- Animated tab bar ----
  function Tabs({ tabs, active, onChange }) {
    const refs = useRef({});
    const [ink, setInk] = useState({ left: 0, width: 0 });
    useEffect(() => {
      const el = refs.current[active];
      if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth });
    }, [active, tabs]);
    return h("div", { className: "tabs" },
      tabs.map((t) => {
        const key = typeof t === "string" ? t : t.id;
        const label = typeof t === "string" ? t : t.label;
        const count = typeof t === "object" ? t.count : null;
        return h("button", {
          key, ref: (el) => refs.current[key] = el,
          className: "tab" + (active === key ? " active" : ""),
          onClick: () => onChange(key),
        }, label, count != null && h("span", { style: { marginLeft: 6, fontSize: 11, color: "var(--text-3)" } }, count));
      }),
      h("div", { className: "tab-ink", style: { left: ink.left, width: ink.width } }),
    );
  }
  window.Tabs = Tabs;

  // ---- Modal shell ----
  function Modal({ children, onClose, width, style }) {
    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    // Portal to body so the fixed-position scrim anchors to the viewport,
    // not to any ancestor that establishes a containing block (e.g. a page
    // wrapper with a transform animation like .vs-page-enter).
    return ReactDOM.createPortal(
      h("div", { className: "overlay-scrim", onMouseDown: (e) => { if (e.target === e.currentTarget) onClose && onClose(); } },
        h("div", { className: "modal", style: Object.assign({ width: width || 560 }, style) }, children)
      ),
      document.body
    );
  }
  window.Modal = Modal;

  // ---- Avatar ----
  function Avatar({ initials, color, size, ring }) {
    size = size || 28;
    return h("div", {
      style: {
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: color || "var(--accent)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, fontWeight: 650, letterSpacing: "0.01em",
        boxShadow: ring ? "0 0 0 2px var(--bg-surface)" : "none",
      },
    }, initials);
  }
  window.Avatar = Avatar;

  // ---- Progress bar ----
  function ProgressBar({ value, color, height, animated }) {
    return h("div", { style: { height: height || 6, background: "var(--bg-active)", borderRadius: 99, overflow: "hidden", width: "100%" } },
      h("div", { style: {
        height: "100%", width: value + "%", borderRadius: 99,
        background: color || "var(--accent)",
        transition: animated === false ? "none" : "width 0.6s var(--ease-out)",
      } })
    );
  }
  window.ProgressBar = ProgressBar;

  // ---- Ring (small progress ring for plans) ----
  function Ring({ value, size, color, stroke }) {
    size = size || 44;
    const sw = stroke || 4;
    const r = size / 2 - sw;
    const c = 2 * Math.PI * r;
    const v = useCountUp(value, 900);
    return h("div", { style: { position: "relative", width: size, height: size } },
      h("svg", { width: size, height: size, style: { transform: "rotate(-90deg)" } },
        h("circle", { cx: size / 2, cy: size / 2, r, style: { fill: "none", stroke: "var(--bg-active)", strokeWidth: sw } }),
        h("circle", { cx: size / 2, cy: size / 2, r,
          style: { fill: "none", stroke: color || "var(--accent)", strokeWidth: sw,
            strokeLinecap: "round", strokeDasharray: c, strokeDashoffset: c * (1 - v / 100) } }),
      ),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.26, fontWeight: 650 } }, Math.round(v) + "%"),
    );
  }
  window.Ring = Ring;

  // score color helper — higher score = safer = greener.
  window.scoreColor = function (s) {
    if (s >= 85) return "var(--sev-clean)";
    if (s >= 65) return "var(--sev-low)";
    if (s >= 45) return "var(--sev-high)";
    return "var(--sev-critical)";
  };

  // Security RISK = 100 − security_score. Higher RISK = worse. The whole app
  // presents security as risk (higher = more dangerous), so these two helpers
  // convert the stored safety score into the displayed risk value + color.
  window.riskFromScore = function (score) {
    return Math.max(0, Math.min(100, 100 - (score == null ? 0 : score)));
  };
  // Color for a RISK value: high risk = red, low risk = green (inverse of score).
  window.riskColor = function (risk) {
    return window.scoreColor(100 - (risk == null ? 0 : risk));
  };
})();
