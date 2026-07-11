// TanoAudit — chart kit: SegmentArc, TrendArea, RoundedBars, RingStat, HeatGrid
(function () {
  const React = window.React;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function useMounted() {
    const [m, setM] = useState(reduced());
    useEffect(() => { const t = setTimeout(() => setM(true), 60); return () => clearTimeout(t); }, []);
    return m;
  }

  // ============ SEGMENT ARC — fan gauge of rounded ticks ============
  function SegmentArc({ value, max, size, segments, color, label, sublabel, suffix }) {
    max = max || 100; size = size || 148; segments = segments || 16;
    const v = window.useCountUp(value, 1100);
    const lit = Math.round((Math.max(0, Math.min(max, v)) / max) * segments);
    const R = size * 0.38, segW = size * 0.058, segH = size * 0.155;
    const cx = size / 2, cy = R + segH / 2 + 4;
    const start = -210, end = 30;
    const svgH = Math.ceil(cy + R * 0.5 + segH / 2 + 2);
    const ticks = [];
    for (let i = 0; i < segments; i++) {
      const a = start + ((i + 0.5) / segments) * (end - start);
      const rad = (a * Math.PI) / 180;
      const x = cx + R * Math.cos(rad), y = cy + R * Math.sin(rad);
      const on = i < lit;
      ticks.push(h("rect", {
        key: i, x: -segW / 2, y: -segH / 2, width: segW, height: segH, rx: segW / 2,
        transform: "translate(" + x + " " + y + ") rotate(" + (a + 90) + ")",
        style: {
          fill: on ? color : "var(--bg-active)",
          fillOpacity: on ? 0.55 + 0.45 * ((i + 1) / segments) : 1,
          transition: "fill 250ms ease, fill-opacity 250ms ease",
        },
      }));
    }
    return h("div", { style: { width: size, textAlign: "center", position: "relative" } },
      h("svg", { width: size, height: svgH, viewBox: "0 0 " + size + " " + svgH, style: { overflow: "visible", display: "block" } }, ticks),
      h("div", { style: { position: "absolute", left: 0, right: 0, top: cy - size * 0.13, pointerEvents: "none" } },
        h("div", { style: { fontSize: size * 0.2, fontWeight: 750, letterSpacing: "-0.03em", color: "var(--text-1)", lineHeight: 1, fontVariantNumeric: "tabular-nums" } }, Math.round(v) + (suffix || "")),
        sublabel && h("div", { style: { fontSize: 10, color: "var(--text-3)", marginTop: 2 } }, sublabel)),
      label && h("div", { style: { fontSize: 10.5, fontWeight: 650, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: -2 } }, label),
    );
  }
  window.SegmentArc = SegmentArc;

  // ============ TREND AREA — smooth gradient line ============
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = "M " + pts[0][0] + " " + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C " + c1x + " " + c1y + ", " + c2x + " " + c2y + ", " + p2[0] + " " + p2[1];
    }
    return d;
  }

  function TrendArea({ data, labels, height, color, id, tipFor }) {
    height = height || 150;
    color = color || "var(--accent)";
    const m = useMounted();
    const [hover, setHover] = useState(null);
    const wrapRef = useRef();
    const W = 600, H = 150, padX = 8, padY = 14;
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => [
      padX + (i / (data.length - 1)) * (W - padX * 2),
      H - padY - ((v - min) / span) * (H - padY * 2),
    ]);
    const line = smoothPath(pts);
    const area = line + " L " + pts[pts.length - 1][0] + " " + (H - 2) + " L " + pts[0][0] + " " + (H - 2) + " Z";
    const gid = "tg-" + (id || "x");

    function onMove(e) {
      const r = wrapRef.current.getBoundingClientRect();
      const frac = (e.clientX - r.left) / r.width;
      const i = Math.round(frac * (data.length - 1));
      setHover(Math.max(0, Math.min(data.length - 1, i)));
    }
    const hv = hover;

    return h("div", { style: { position: "relative" } },
      h("div", { ref: wrapRef, onMouseMove: onMove, onMouseLeave: () => setHover(null),
        style: { clipPath: m ? "inset(0 0 0 0)" : "inset(0 100% 0 0)", transition: "clip-path 1s var(--ease-out)" } },
        h("svg", { width: "100%", height, viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", style: { display: "block" } },
          h("defs", null,
            h("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
              h("stop", { offset: "0%", stopColor: color, stopOpacity: 0.25 }),
              h("stop", { offset: "100%", stopColor: color, stopOpacity: 0 }))),
          h("path", { d: area, style: { fill: "url(#" + gid + ")" } }),
          h("path", { d: line, style: { fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round", vectorEffect: "non-scaling-stroke" } }),
          hv != null && h("line", { x1: pts[hv][0], y1: 6, x2: pts[hv][0], y2: H - 4,
            style: { stroke: "var(--border-strong)", strokeWidth: 1, strokeDasharray: "3 4", vectorEffect: "non-scaling-stroke" } }),
          pts.map((p, i) => h("circle", { key: i, cx: p[0], cy: p[1], r: i === hv ? 4.5 : (i === pts.length - 1 ? 3.5 : 0),
            style: { fill: "var(--bg-surface)", stroke: color, strokeWidth: 2, transition: "r 120ms ease" } }))),
      ),
      labels && h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6 } },
        labels.map((l, i) => h("span", { key: i, style: { fontSize: 10.5, color: i === hv ? "var(--text-1)" : "var(--text-3)", fontWeight: i === hv ? 600 : 400 } }, l))),
      hv != null && h("div", { style: {
        position: "absolute", left: (pts[hv][0] / W) * 100 + "%", top: 0,
        transform: "translate(-50%, -8px)", pointerEvents: "none",
        background: "var(--text-1)", color: "var(--bg-app)", borderRadius: 8,
        padding: "5px 10px", fontSize: 11.5, fontWeight: 650, whiteSpace: "nowrap",
        boxShadow: "var(--shadow-pop)", zIndex: 5,
      } }, tipFor ? tipFor(hv) : data[hv]),
    );
  }
  window.TrendArea = TrendArea;

  // ============ ROUNDED BARS — muted bars, one highlighted ============
  function RoundedBars({ data, height, highlightIndex, color, tipFor }) {
    height = height || 168;
    color = color || "var(--accent)";
    const m = useMounted();
    const [hover, setHover] = useState(null);
    const max = Math.max(...data.map((d) => d.value)) * 1.12;
    const act = hover != null ? hover : highlightIndex;
    const barArea = height - 24;

    return h("div", { style: { position: "relative" } },
      h("div", { style: { display: "flex", alignItems: "flex-end", gap: 8, height } },
        data.map((d, i) => {
          const hPx = Math.max(5, (d.value / max) * barArea);
          const isAct = i === act;
          return h("div", { key: i, onMouseEnter: () => setHover(i), onMouseLeave: () => setHover(null),
            style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 7, height: "100%", cursor: "default", minWidth: 0 } },
            h("div", { style: {
              width: "100%", maxWidth: 34, borderRadius: 9,
              height: m ? hPx + "px" : "5px",
              background: isAct
                ? "linear-gradient(180deg, " + color + ", color-mix(in oklab, " + color + " 45%, transparent))"
                : "var(--bg-active)",
              transition: "height 700ms var(--ease-out) " + i * 35 + "ms, background 180ms ease",
            } }),
            h("span", { style: { fontSize: 10.5, color: isAct ? "var(--text-1)" : "var(--text-3)", fontWeight: isAct ? 600 : 400, whiteSpace: "nowrap" } }, d.label));
        })),
      act != null && h("div", { style: {
        position: "absolute", left: ((act + 0.5) / data.length) * 100 + "%",
        bottom: 24 + Math.max(5, (data[act].value / max) * barArea) + 10,
        transform: "translateX(-50%)", pointerEvents: "none",
        background: "var(--text-1)", color: "var(--bg-app)", borderRadius: 8,
        padding: "5px 10px", fontSize: 11.5, fontWeight: 650, whiteSpace: "nowrap",
        boxShadow: "var(--shadow-pop)", zIndex: 5,
      } }, tipFor ? tipFor(act) : data[act].value),
    );
  }
  window.RoundedBars = RoundedBars;

  // ============ RING STAT — segmented donut with center stat ============
  function RingStat({ segments, size, stroke, centerBig, centerSmall, total }) {
    size = size || 168; stroke = stroke || 13;
    const m = useMounted();
    const r = (size - stroke) / 2 - 2;
    const C = 2 * Math.PI * r;
    const maxVal = total || segments.reduce((acc, x) => acc + x.value, 0) || 1;
    
    const activeSegments = segments.filter((s) => s.value > 0);
    const k = activeSegments.length;
    
    let acc = 0;
    const arcs = [];
    
    if (k === 1) {
      const s = activeSegments[0];
      const valFrac = s.value / maxVal;
      let len, off;
      if (valFrac >= 0.999) {
        len = C;
        off = 0;
      } else {
        len = Math.max(valFrac * C - stroke, 0.01);
        off = -stroke / 2;
      }
      arcs.push(h("circle", {
        key: 0, cx: size / 2, cy: size / 2, r,
        style: {
          fill: "none", stroke: s.color, strokeWidth: stroke, strokeLinecap: "round",
          strokeDasharray: (m ? len : 0.01) + " " + C, strokeDashoffset: off,
          transition: "stroke-dasharray 950ms var(--ease-out)",
          filter: "url(#ring-glow)",
        },
      }));
    } else if (k > 1) {
      const G = 5; // Visual gap size in pixels
      const P = stroke + G; // Mathematical gap
      const budget = C - k * P;
      
      activeSegments.forEach((s, idx) => {
        const len = Math.max((s.value / maxVal) * budget, 0.01);
        const off = -((acc / maxVal) * budget + idx * P + P / 2);
        acc += s.value;
        
        arcs.push(h("circle", {
          key: idx, cx: size / 2, cy: size / 2, r,
          style: {
            fill: "none", stroke: s.color, strokeWidth: stroke, strokeLinecap: "round",
            strokeDasharray: (m ? len : 0.01) + " " + C, strokeDashoffset: off,
            transition: "stroke-dasharray 950ms var(--ease-out) " + idx * 80 + "ms",
            filter: "url(#ring-glow)",
          },
        }));
      });
    }

    const renderCenterBig = () => {
      if (typeof centerBig === "string" && centerBig.endsWith("%")) {
        const num = centerBig.slice(0, -1);
        return h("span", { style: { display: "inline-flex", alignItems: "baseline" } },
          h("span", null, num),
          h("span", { style: { fontSize: "0.6em", fontWeight: 500, marginLeft: 1, color: "var(--text-2)" } }, "%")
        );
      }
      return centerBig;
    };

    return h("div", { style: { position: "relative", width: size, height: size } },
      h("svg", { width: size, height: size, style: { transform: "rotate(-90deg)", display: "block" } },
        h("defs", null,
          h("filter", { id: "ring-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" },
            h("feGaussianBlur", { stdDeviation: 3, result: "blur" }),
            h("feComponentTransfer", { in: "blur", result: "glow" },
              h("feFuncA", { type: "linear", slope: 0.35 })
            ),
            h("feMerge", null,
              h("feMergeNode", { in: "glow" }),
              h("feMergeNode", { in: "SourceGraphic" })
            )
          )
        ),
        h("circle", { cx: size / 2, cy: size / 2, r, style: { fill: "none", stroke: "var(--bg-active)", strokeWidth: stroke * 0.55 } }),
        arcs),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none" } },
        h("div", { style: { fontSize: size * 0.17, fontWeight: 750, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" } }, renderCenterBig()),
        centerSmall && h("div", { style: { fontSize: 11, fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)", marginTop: 4, maxWidth: size * 0.6 } }, centerSmall)),
    );
  }
  window.RingStat = RingStat;

  // ============ HEAT GRID — intensity matrix ============
  function HeatGrid({ rows, cols, values, colorFor, maxValue, cell, gapPx, tipFor }) {
    cell = cell || 20; gapPx = gapPx || 5;
    const m = useMounted();
    const max = maxValue || Math.max(1, ...values.flat());
    return h("div", { style: { display: "inline-grid", gridTemplateColumns: "auto repeat(" + cols.length + ", " + cell + "px)", gap: gapPx, alignItems: "center" } },
      rows.map((rl, ri) => [
        h("div", { key: "rl" + ri, style: { fontSize: 11, color: "var(--text-3)", paddingRight: 8, textAlign: "right", fontFamily: "var(--font-mono)" } }, rl),
        cols.map((cl, ci) => {
          const v = values[ri][ci];
          const frac = v / max;
          const c = colorFor(ci, ri);
          return h("div", {
            key: "c" + ri + "-" + ci, "data-tip": tipFor ? tipFor(ri, ci, v) : v,
            style: {
              width: cell, height: cell, borderRadius: 5,
              background: v === 0 ? "var(--bg-active)" : "color-mix(in srgb, " + c + " " + Math.round(18 + 82 * frac) + "%, transparent)",
              opacity: m ? 1 : 0, transition: "opacity 400ms ease " + (ri * cols.length + ci) * 14 + "ms",
              cursor: "default",
            },
          });
        }),
      ]),
      h("div", { key: "spacer" }),
      cols.map((cl, ci) => h("div", { key: "cl" + ci, style: { fontSize: 10, color: "var(--text-3)", textAlign: "center", marginTop: 2, whiteSpace: "nowrap" } }, cl)),
    );
  }
  window.HeatGrid = HeatGrid;
})();
