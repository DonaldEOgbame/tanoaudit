// VaultScan icon set — minimal stroke icons as React components
(function () {
  const React = window.React;
  function mk(paths, opts) {
    opts = opts || {};
    return function Icon(props) {
      props = props || {};
      const size = props.size || 16;
      return React.createElement("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: opts.fill ? "currentColor" : "none",
        stroke: opts.fill ? "none" : "currentColor", strokeWidth: props.sw || 1.7,
        strokeLinecap: "round", strokeLinejoin: "round",
        className: props.className, style: props.style,
      }, paths.map((d, i) => React.createElement("path", { key: i, d })));
    };
  }
  function mkRaw(children) {
    return function Icon(props) {
      props = props || {};
      const size = props.size || 16;
      return React.createElement("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: props.sw || 1.7,
        strokeLinecap: "round", strokeLinejoin: "round",
        className: props.className, style: props.style,
      }, children(React));
    };
  }

  window.Icons = {
    shield: mk(["M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z"]),
    shieldCheck: mkRaw((R) => [
      R.createElement("path", { key: 0, d: "M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" }),
      R.createElement("path", { key: 1, d: "M9 11.5l2 2 4-4" }),
    ]),
    plus: mk(["M12 5v14", "M5 12h14"]),
    search: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 11, cy: 11, r: 7 }),
      R.createElement("path", { key: 1, d: "M21 21l-4.3-4.3" }),
    ]),
    home: mk(["M3 11l9-8 9 8", "M5 10v10h14V10"]),
    list: mk(["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"]),
    eye: mkRaw((R) => [
      R.createElement("path", { key: 0, d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" }),
      R.createElement("circle", { key: 1, cx: 12, cy: 12, r: 3 }),
    ]),
    eyeOff: mk(["M3 3l18 18", "M10.6 10.6a3 3 0 004.2 4.2", "M9.4 5.2A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.8", "M6.1 6.1A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 003.9-.8"]),
    file: mk(["M14 3v5h5", "M6 3h8l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"]),
    folder: mk(["M3 7a1 1 0 011-1h5l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z"]),
    bookmark: mk(["M6 4h12v16l-6-4-6 4V4z"]),
    report: mk(["M14 3v5h5", "M6 3h8l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z", "M9 13h6", "M9 16h4"]),
    bug: mkRaw((R) => [
      R.createElement("rect", { key: 0, x: 8, y: 8, width: 8, height: 10, rx: 4 }),
      R.createElement("path", { key: 1, d: "M8 12H4M16 12h4M8 16l-3 2M16 16l3 2M8 9L6 6M16 9l2-3M12 4v4" }),
    ]),
    sliders: mk(["M4 6h11", "M19 6h1", "M4 12h5", "M13 12h7", "M4 18h9", "M17 18h3"]),
    target: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 8 }),
      R.createElement("circle", { key: 1, cx: 12, cy: 12, r: 4 }),
      R.createElement("circle", { key: 2, cx: 12, cy: 12, r: 0.8, fill: "currentColor" }),
    ]),
    github: mkRaw((R) => [
      R.createElement("path", { key: 0, d: "M9 19c-4 1.3-4-2-6-2.5M15 21v-3.4a3 3 0 00-.8-2.3c2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 00-6 0C6.5 1.3 5.5 1.6 5.5 1.6a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 004 8c0 4.6 2.7 5.7 5.5 6a3 3 0 00-.8 2.3V21" }),
    ]),
    users: mkRaw((R) => [
      R.createElement("path", { key: 0, d: "M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19" }),
      R.createElement("circle", { key: 1, cx: 10, cy: 8, r: 3.2 }),
      R.createElement("path", { key: 2, d: "M20 19v-1.5a3.5 3.5 0 00-2.6-3.4M15 5.2a3.2 3.2 0 010 5.6" }),
    ]),
    book: mk(["M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z", "M4 5v14"]),
    settings: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 3 }),
      R.createElement("path", { key: 1, d: "M19.4 13.5a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H10a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V10a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" }),
    ]),
    key: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 7.5, cy: 15.5, r: 4 }),
      R.createElement("path", { key: 1, d: "M10.5 12.5L20 3M16 4l3 3M14 6l2 2" }),
    ]),
    gauge: mk(["M12 14l4-4", "M5.6 18a9 9 0 1112.8 0"]),
    chart: mk(["M4 20V10", "M10 20V4", "M16 20v-6", "M22 20H2"]),
    bell: mk(["M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 01-3.4 0"]),
    chevR: mk(["M9 6l6 6-6 6"]),
    chevD: mk(["M6 9l6 6 6-6"]),
    chevL: mk(["M15 6l-6 6 6 6"]),
    x: mk(["M6 6l12 12", "M18 6L6 18"]),
    check: mk(["M5 12l5 5L20 6"]),
    copy: mkRaw((R) => [
      R.createElement("rect", { key: 0, x: 9, y: 9, width: 11, height: 11, rx: 2 }),
      R.createElement("path", { key: 1, d: "M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" }),
    ]),
    download: mk(["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"]),
    share: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 18, cy: 5, r: 2.5 }),
      R.createElement("circle", { key: 1, cx: 6, cy: 12, r: 2.5 }),
      R.createElement("circle", { key: 2, cx: 18, cy: 19, r: 2.5 }),
      R.createElement("path", { key: 3, d: "M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" }),
    ]),
    refresh: mk(["M21 12a9 9 0 01-9 9 9 9 0 01-7.5-4M3 12a9 9 0 019-9 9 9 0 017.5 4", "M21 4v4h-4", "M3 20v-4h4"]),
    sparkle: mk(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z", "M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"]),
    cpu: mkRaw((R) => [
      R.createElement("rect", { key: 0, x: 7, y: 7, width: 10, height: 10, rx: 1.5 }),
      R.createElement("path", { key: 1, d: "M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" }),
    ]),
    terminal: mk(["M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z", "M7 9l3 3-3 3", "M13 15h4"]),
    play: mk(["M7 4v16l13-8z"], { fill: true }),
    pause: mk(["M8 5h3v14H8zM13 5h3v14h-3z"], { fill: true }),
    clock: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9 }),
      R.createElement("path", { key: 1, d: "M12 7v5l3 2" }),
    ]),
    flag: mk(["M5 21V4", "M5 4h11l-2 3.5L16 11H5"]),
    alert: mkRaw((R) => [
      R.createElement("path", { key: 0, d: "M12 3l9 16H3z" }),
      R.createElement("path", { key: 1, d: "M12 10v4M12 17h.01" }),
    ]),
    info: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9 }),
      R.createElement("path", { key: 1, d: "M12 11v5M12 8h.01" }),
    ]),
    zap: mk(["M13 2L4 14h7l-1 8 9-12h-7l1-8z"]),
    cmd: mk(["M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 10 3 3V6z"]),
    arrowUp: mk(["M12 19V5", "M6 11l6-6 6 6"]),
    arrowDown: mk(["M12 5v14", "M18 13l-6 6-6-6"]),
    moon: mk(["M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"]),
    sun: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 4 }),
      R.createElement("path", { key: 1, d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" }),
    ]),
    menu: mk(["M3 6h18", "M3 12h18", "M3 18h18"]),
    panelLeft: mkRaw((R) => [
      R.createElement("rect", { key: 0, x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      R.createElement("path", { key: 1, d: "M9 4v16" }),
    ]),
    trash: mk(["M4 7h16", "M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2", "M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"]),
    edit: mk(["M12 20h9", "M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"]),
    link: mk(["M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5", "M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5"]),
    upload: mk(["M12 17V5", "M7 10l5-5 5 5", "M5 19h14"]),
    globe: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9 }),
      R.createElement("path", { key: 1, d: "M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" }),
    ]),
    layers: mk(["M12 3l9 5-9 5-9-5 9-5z", "M3 13l9 5 9-5", "M3 17l9 5 9-5"]),
    activity: mk(["M3 12h4l2 6 4-14 2 8h6"]),
    grid: mkRaw((R) => [
      R.createElement("rect", { key: 0, x: 3, y: 3, width: 7, height: 7, rx: 1 }),
      R.createElement("rect", { key: 1, x: 14, y: 3, width: 7, height: 7, rx: 1 }),
      R.createElement("rect", { key: 2, x: 3, y: 14, width: 7, height: 7, rx: 1 }),
      R.createElement("rect", { key: 3, x: 14, y: 14, width: 7, height: 7, rx: 1 }),
    ]),
    logout: mk(["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4", "M16 17l5-5-5-5", "M21 12H9"]),
    help: mkRaw((R) => [
      R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9 }),
      R.createElement("path", { key: 1, d: "M9.5 9a2.5 2.5 0 014.5 1.5c0 1.5-2 2-2 3.5M12 17h.01" }),
    ]),
    package: mkRaw((R) => [
      R.createElement("path", { key: 0, d: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" }),
      R.createElement("path", { key: 1, d: "M4 7.5l8 4.5 8-4.5M12 21v-9" }),
    ]),
    history: mk(["M3 12a9 9 0 109-9 9 9 0 00-7.5 4M3 4v4h4", "M12 8v4l3 2"]),
    dot: mk(["M12 12h.01"], { fill: false }),
    more: mk(["M5 12h.01", "M12 12h.01", "M19 12h.01"]),
    pin: mk(["M12 17v5", "M9 3h6l-1 7 3 3H7l3-3-1-7z"]),
    thumbUp: mk(["M7 10v11", "M7 10l4-7a2 2 0 012 2v3h5a2 2 0 012 2l-1.5 6a2 2 0 01-2 1.5H7"]),
    thumbDown: mk(["M17 14V3", "M17 14l-4 7a2 2 0 01-2-2v-3H6a2 2 0 01-2-2l1.5-6a2 2 0 012-1.5h9"]),
    gitlab: mk(["m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z"], { fill: true }),
    bitbucket: mk(["M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"], { fill: true }),
    slack: mk(["M5.042 15.165a2.528 2.528 0 0 1-2.522 2.523A2.528 2.528 0 0 1 0 15.165a2.528 2.528 0 0 1 2.52-2.52h2.522v2.52zM6.315 15.165a2.528 2.528 0 0 1 2.523-2.522 2.528 2.528 0 0 1 2.522 2.522v6.316a2.528 2.528 0 0 1-2.522 2.522 2.528 2.528 0 0 1-2.523-2.522v-6.316zM8.838 5.042a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 13.883 0a2.528 2.528 0 0 1 2.522 2.522v2.52H8.838zM8.838 6.315a2.528 2.528 0 0 1 0 5.043 2.528 2.528 0 0 1-5.043 0 2.528 2.528 0 0 1 0-5.043h5.043zM18.958 8.838a2.528 2.528 0 0 1 2.522 2.522 2.528 2.528 0 0 1-2.522 2.523h-6.315a2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.522h6.315zM17.685 8.838a2.528 2.528 0 0 1-2.522 2.522 2.528 2.528 0 0 1-2.523-2.522V2.522a2.528 2.528 0 0 1 2.523-2.522 2.528 2.528 0 0 1 2.522 2.522v6.316zM11.162 18.958a2.528 2.528 0 0 1-2.522 2.522 2.528 2.528 0 0 1-2.522-2.522v-6.315a2.528 2.528 0 0 1 2.522-2.523 2.528 2.528 0 0 1 2.522 2.523v6.315zM12.435 18.958a2.528 2.528 0 0 1 2.523-2.522 2.528 2.528 0 0 1 5.043 0 2.528 2.528 0 0 1-5.043 0h-2.523z"], { fill: true }),
    jira: mk(["M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"], { fill: true }),
    datadog: mk(["M19.57 17.04l-1.997-1.316-1.665 2.782-1.937-.567-1.706 2.604.087.82 9.274-1.71-.538-5.794zm-8.649-2.498l1.488-.204c.241.108.409.15.697.223.45.117.97.23 1.741-.16.18-.088.553-.43.704-.625l6.096-1.106.622 7.527-10.444 1.882zm11.325-2.712l-.602.115L20.488 0 .789 2.285l2.427 19.693 2.306-.334c-.184-.263-.471-.581-.96-.989-.68-.564-.44-1.522-.039-2.127.53-1.022 3.26-2.322 3.106-3.956-.056-.594-.15-1.368-.702-1.898-.02.22.017.432.017.432s-.227-.289-.34-.683c-.112-.15-.2-.199-.319-.4-.085.233-.073.503-.073.503s-.186-.437-.216-.807c-.11.166-.137.48-.137.48s-.241-.69-.186-1.062c-.11-.323-.436-.965-.343-2.424.6.421 1.924.321 2.44-.439.171-.251.288-.939-.086-2.293-.24-.868-.835-2.16-1.066-2.651l-.028.02c.122.395.374 1.223.47 1.625.293 1.218.372 1.642.234 2.204-.116.488-.397.808-1.107 1.165-.71.358-1.653-.514-1.713-.562-.69-.55-1.224-1.447-1.284-1.883-.062-.477.275-.763.445-1.153-.243.07-.514.192-.514.192s.323-.334.722-.624c.165-.109.262-.178.436-.323a9.762 9.762 0 0 0-.456.003s.42-.227.855-.392c-.318-.014-.623-.003-.623-.003s.937-.419 1.678-.727c.509-.208 1.006-.147 1.286.257.367.53.752.817 1.569.996.501-.223.653-.337 1.284-.509.554-.61.99-.688.99-.688s-.216.198-.274.51c.314-.249.66-.455.66-.455s-.134.164-.259.426l.03.043c.366-.22.797-.394.797-.394s-.123.156-.268.358c.277-.002.838.012 1.056.037 1.285.028 1.552-1.374 2.045-1.55.618-.22.894-.353 1.947.68.903.888 1.609 2.477 1.259 2.833-.294.295-.874-.115-1.516-.916a3.466 3.466 0 0 1-.716-1.562 1.533 1.533 0 0 0-.497-.85s.23.51.23.96c0 .246.03 1.165.424 1.68-.039.076-.057.374-.1.43-.458-.554-1.443-.95-1.604-1.067.544.445 1.793 1.468 2.273 2.449.453.927.186 1.777.416 1.997.065.063.976 1.197 1.15 1.767.306.994.019 2.038-.381 2.685l-1.117.174c-.163-.045-.273-.068-.42-.153.08-.143.241-.5.243-.572l-.063-.111c-.348.492-.93.97-1.414 1.245-.633.359-1.363.304-1.838.156-1.348-.415-2.623-1.327-2.93-1.566 0 0-.01.191.048.234.34.383 1.119 1.077 1.872 1.56l-1.605.177.759 5.908c-.337.048-.39.071-.757.124-.325-1.147-.946-1.895-1.624-2.332-.599-.384-1.424-.47-2.214-.314l-.05.059a2.851 2.851 0 0 1 1.863.444c.654.413 1.181 1.481 1.375 2.124.248.822.42 1.7-.248 2.632-.476.662-1.864 1.028-2.986.237.3.481.705.876 1.25.95.809.11 1.577-.03 2.106-.574.452-.464.69-1.434.628-2.456l.714-.104.258 1.834 11.827-1.424zM15.05 6.848c-.034.075-.085.125-.007.37l.004.014.013.032.032.073c.14.287.295.558.552.696.067-.011.136-.019.207-.023.242-.01.395.028.492.08.009-.048.01-.119.005-.222-.018-.364.072-.982-.626-1.308-.264-.122-.634-.084-.757.068a.302.302 0 0 1 .058.013c.186.066.06.13.027.207m1.958 3.392c-.092-.05-.52-.03-.821.005-.574.068-1.193.267-1.328.372-.247.191-.135.523.047.66.511.382.96.638 1.432.575.29-.038.546-.497.728-.914.124-.288.124-.598-.058-.698m-5.077-2.942c.162-.154-.805-.355-1.556.156-.554.378-.571 1.187-.041 1.646.053.046.096.078.137.104a4.77 4.77 0 0 1 1.396-.412c.113-.125.243-.345.21-.745-.044-.542-.455-.456-.146-.749"], { fill: true }),
    sentry: mk(["M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z"], { fill: true }),
  };

  const TechIcons = {
    // Languages
    javascript: {
      color: "#f7df1e",
      draw: (R) => [
        R.createElement("rect", { key: "bg", x: 2, y: 2, width: 20, height: 20, rx: 3, fill: "#f7df1e", stroke: "none" }),
        R.createElement("path", { key: "txt", d: "M12.4 14.1c-.2-.4-.4-.6-.7-.8-.3-.2-.7-.3-1.1-.3-.4 0-.8.1-1.1.3-.3.2-.5.5-.5.9s.2.7.5.9c.3.2.7.3 1.2.5.6.2 1.1.4 1.5.6.4.2.7.5.9.9s.3.9.3 1.5c0 .6-.2 1.1-.5 1.5-.3.4-.8.7-1.3.9-.5.2-1.1.3-1.8.3-.7 0-1.3-.1-1.8-.4s-.9-.7-1.1-1.2l1.4-.9c.2.3.4.5.7.7.3.2.6.2 1 .2.4 0 .7-.1.9-.2.2-.1.3-.3.3-.6s-.1-.4-.3-.5c-.2-.1-.6-.3-1.1-.4-.6-.2-1.1-.4-1.5-.6-.4-.2-.7-.5-.9-.9s-.3-.9-.3-1.5c0-.6.2-1.1.5-1.5.3-.4.8-.7 1.3-.9.5-.2 1.1-.3 1.8-.3.6 0 1.2.1 1.7.3.5.2.8.5 1.1.9l-1.2.9zm6.7 4c0 .5-.1.9-.3 1.3s-.5.7-.9.9c-.4.2-.9.3-1.5.3-.5 0-.9-.1-1.3-.3s-.7-.5-.9-.9c-.2-.4-.3-.8-.3-1.3V11h1.6v7.2c0 .4.1.7.3.9.2.2.4.3.8.3.4 0 .6-.1.8-.3s.3-.5.3-.9V11h1.6v7.1z", fill: "#000000", stroke: "none" })
      ]
    },
    typescript: {
      color: "#3178c6",
      draw: (R) => [
        R.createElement("rect", { key: "bg", x: 2, y: 2, width: 20, height: 20, rx: 3, fill: "#3178c6", stroke: "none" }),
        R.createElement("path", { key: "txt", d: "M8.4 11h-3v1.6H7V19h1.8v-6.4H10V11H8.4zm8.1 3.1c-.2-.4-.4-.6-.7-.8-.3-.2-.7-.3-1.1-.3-.4 0-.8.1-1.1.3-.3.2-.5.5-.5.9s.2.7.5.9c.3.2.7.3 1.2.5.6.2 1.1.4 1.5.6.4.2.7.5.9.9s.3.9.3 1.5c0 .6-.2 1.1-.5 1.5-.3.4-.8.7-1.3.9-.5.2-1.1.3-1.8.3-.7 0-1.3-.1-1.8-.4s-.9-.7-1.1-1.2l1.4-.9c.2.3.4.5.7.7.3.2.6.2 1 .2.4 0 .7-.1.9-.2.2-.1.3-.3.3-.6s-.1-.4-.3-.5c-.2-.1-.6-.3-1.1-.4-.6-.2-1.1-.4-1.5-.6-.4-.2-.7-.5-.9-.9s-.3-.9-.3-1.5c0-.6.2-1.1.5-1.5.3-.4.8-.7 1.3-.9.5-.2 1.1-.3 1.8-.3.6 0 1.2.1 1.7.3.5.2.8.5 1.1.9l-1.2.9z", fill: "#ffffff", stroke: "none" })
      ]
    },
    python: {
      color: "#3776ab",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2c-2.8 0-2.6 1.2-2.6 1.2h2.7c1.4 0 2.5 1.1 2.5 2.5V8.4h1.2c1.4 0 2.5-1.1 2.5-2.5V5.2c0-2.8-2.5-3.2-3.8-3.2h-2.5z", fill: "#3776ab" }),
        R.createElement("path", { key: 1, d: "M12 22c2.8 0 2.6-1.2 2.6-1.2h-2.7c-1.4 0-2.5-1.1-2.5-2.5v-2.7H8.2c-1.4 0-2.5 1.1-2.5 2.5v0.7c0 2.8 2.5 3.2 3.8 3.2h2.5z", fill: "#ffd343" }),
        R.createElement("path", { key: 2, d: "M9.4 3.8A4.6 4.6 0 005.7 8.2v0.7c0 1.4 1.1 2.5 2.5 2.5h1.2V8.7c0-1.4 1.1-2.5 2.5-2.5h2.5V5.1s-.2-1.3-2.6-1.3H9.4z", fill: "#3776ab" }),
        R.createElement("path", { key: 3, d: "M14.6 20.2a4.6 4.6 0 003.7-4.4v-0.7c0-1.4-1.1-2.5-2.5-2.5h-1.2v2.7c0 1.4-1.1 2.5-2.5 2.5H9.6v1.1s.2 1.3 2.6 1.3h2.4z", fill: "#ffd343" }),
        R.createElement("circle", { key: 4, cx: 8.5, cy: 5.5, r: 0.6, fill: "#ffffff" }),
        R.createElement("circle", { key: 5, cx: 15.5, cy: 18.5, r: 0.6, fill: "#000000" })
      ]
    },
    go: {
      color: "#00add8",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M6.5 17c-2.5 0-4.5-2-4.5-5s2-5 4.5-5c2 0 3.2 1.2 3.8 2.2l-2 1.3c-.4-.7-.9-1.2-1.8-1.2-1.2 0-2.2 1-2.2 2.7s1 2.7 2.2 2.7c1 0 1.5-.6 1.8-1.2h-2.2v-1.8h4.2v4.8c-.8.8-1.9 1.5-3.8 1.5zm9 0c-2.5 0-4.5-2-4.5-5s2-5 4.5-5 4.5 2 4.5 5-2 5-4.5 5zm0-2.3c1.2 0 2.2-1 2.2-2.7s-1-2.7-2.2-2.7-2.2 1-2.2 2.7 1 2.7 2.2 2.7z", fill: "#00add8" })
      ]
    },
    rust: {
      color: "#ce412b",
      draw: (R) => [
        R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 7.5, fill: "none", stroke: "#e05d44", strokeWidth: 1.5 }),
        R.createElement("path", { key: 1, d: "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4", stroke: "#e05d44", strokeWidth: 2 }),
        R.createElement("path", { key: 2, d: "M9 8.5h3c1.5 0 2.2.6 2.2 1.8 0 1-.6 1.5-1.7 1.7l2 3.5h-1.8L11 12.3H10.5V15.5H9V8.5zm1.5 2.5h1.2c.6 0 .9-.3.9-.7s-.3-.7-.9-.7h-1.2V11z", fill: "#e05d44" })
      ]
    },
    ruby: {
      color: "#cc342d",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M6 3h12l4 5-10 13L2 8z", fill: "#cc342d" }),
        R.createElement("path", { key: 1, d: "M12 21L2 8h8z", fill: "#9b111e" }),
        R.createElement("path", { key: 2, d: "M12 3L6 8h12z", fill: "#e0115f" }),
        R.createElement("path", { key: 3, d: "M18 3l4 5h-4z", fill: "#ff3366" }),
        R.createElement("path", { key: 4, d: "M6 3L2 8h4z", fill: "#7b1113" })
      ]
    },
    php: {
      color: "#777bb4",
      draw: (R) => [
        R.createElement("ellipse", { key: 0, cx: 12, cy: 12, rx: 10, ry: 6, fill: "#777bb4" }),
        R.createElement("path", { key: 1, d: "M6.5 9h1.8c.8 0 1.3.4 1.3 1.1s-.5 1.1-1.3 1.1H7.3v1.8H6.5V9zm.8 1.5h.9c.4 0 .6-.2.6-.5 0-.4-.2-.5-.6-.5h-.9v1zm4.5-1.5h.8v1.6h1.2V9h.8v5h-.8v-1.8h-1.2V14h-.8V9zm5.5 0h1.8c.8 0 1.3.4 1.3 1.1s-.5 1.1-1.3 1.1h-1v1.8h-.8V9zm.8 1.5h.9c.4 0 .6-.2.6-.5 0-.4-.2-.5-.6-.5h-.9v1z", fill: "#ffffff" })
      ]
    },
    java: {
      color: "#ea2d2e",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M9 19c-.5-1.8 1.5-3.3 2.5-4.2.3-.3.2-.5-.1-.4-.8.3-2.3 1.2-2.5 2.4-.2.8.2 1.5.8 2.2h.5c-.7-.3-.9-.6-1-.2z", fill: "#007396" }),
        R.createElement("path", { key: 1, d: "M13.5 18c1.3-.4 2.8-.7 3.5-1.3s1.2-1.5-.2-2c-.8-.3-2.5-.2-3.8.3-1.8.7-3.8 2.2-1.5 2.8 1.2.3 2 .2 2 2zm.8-4.8c1-1.2 1.8-3.2 1.3-4.8-.2-.8-.8-1.5-1.2-1.2-.5.3-.8 1.2-.8 2 0 1.2.3 2.8.7 4zm-2.8.8c.8-1 1.2-2.8 1-4.2-.2-1-.8-2-1.4-1.8-.7.3-1 1.4-.8 2.4.3 1.2.7 2.6 1.2 3.6z", fill: "#ea2d2e" }),
        R.createElement("path", { key: 2, d: "M6 21c3.5-1 7.5-1.5 11-1 1 .1 1.8.3 1.8.8v.3c0 .5-1 .7-2 .8C13.2 22 9.5 22 6 21.3v-.3z", fill: "#007396" })
      ]
    },
    cpp: {
      color: "#00599c",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2L3 7v10l9 5 9-5V7l-9-5z", fill: "#00599c" }),
        R.createElement("path", { key: 1, d: "M14.5 14.5A3.5 3.5 0 1114.5 9.5", fill: "none", stroke: "#ffffff", strokeWidth: 2 }),
        R.createElement("path", { key: 2, d: "M16 12h3M17.5 10.5v3M20 12h3M21.5 10.5v3", stroke: "#ffffff", strokeWidth: 1.5 })
      ]
    },
    html: {
      color: "#e34f26",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M3 2l1.6 16.5L12 22l7.4-3.5L21 2H3z", fill: "#e34f26" }),
        R.createElement("path", { key: 1, d: "M12 3.8v16.4l5.8-2.7L19.2 3.8H12z", fill: "#f06529" }),
        R.createElement("path", { key: 2, d: "M12 8.5H8.3L8 5H12V3.8m0 8.2H8.6l-.3-3H12V7.8m0 7.2L8.8 14.5l-.2-1.5H7.1l.4 4.5 4.5 1.5v-1.2m0-3.3v-1.3", fill: "#ffffff" })
      ]
    },
    css: {
      color: "#1572b6",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M3 2l1.6 16.5L12 22l7.4-3.5L21 2H3z", fill: "#1572b6" }),
        R.createElement("path", { key: 1, d: "M12 3.8v16.4l5.8-2.7L19.2 3.8H12z", fill: "#33a9dc" }),
        R.createElement("path", { key: 2, d: "M12 8.5H8.3L8 5H12V3.8m0 8.2H8.6l-.3-3H12V7.8m0 7.2L8.8 14.5l-.2-1.5H7.1l.4 4.5 4.5 1.5v-1.2m0-3.3v-1.3", fill: "#ffffff" })
      ]
    },

    // Frameworks & Tools
    react: {
      color: "#61dafb",
      draw: (R) => [
        R.createElement("ellipse", { key: 0, cx: 12, cy: 12, rx: 9, ry: 3.5, transform: "rotate(30,12,12)", stroke: "#61dafb", strokeWidth: 1.2, fill: "none" }),
        R.createElement("ellipse", { key: 1, cx: 12, cy: 12, rx: 9, ry: 3.5, transform: "rotate(90,12,12)", stroke: "#61dafb", strokeWidth: 1.2, fill: "none" }),
        R.createElement("ellipse", { key: 2, cx: 12, cy: 12, rx: 9, ry: 3.5, transform: "rotate(150,12,12)", stroke: "#61dafb", strokeWidth: 1.2, fill: "none" }),
        R.createElement("circle", { key: 3, cx: 12, cy: 12, r: 1.5, fill: "#61dafb" })
      ]
    },
    vue: {
      color: "#42b883",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 21L2 4h4.5L12 13.5 17.5 4H22z", fill: "#42b883" }),
        R.createElement("path", { key: 1, d: "M12 21L5.5 4H10l2 3.5L14 4h4.5z", fill: "#35495e" })
      ]
    },
    angular: {
      color: "#dd0031",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2L3 5.2l1.4 12.3 7.6 4.5 7.6-4.5 1.4-12.3L12 2z", fill: "#dd0031" }),
        R.createElement("path", { key: 1, d: "M12 2v20l7.6-4.5 1.4-12.3L12 2z", fill: "#c3002f" }),
        R.createElement("path", { key: 2, d: "M12 5.8l4.8 11.2h-1.8L12 10.5 9 17H7.2L12 5.8z", fill: "#ffffff" })
      ]
    },
    svelte: {
      color: "#ff3e00",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M15.5 8.5c-.8-1.5-2.2-2.5-3.8-2.5-2 0-3.5 1.5-3.5 3.5 0 1.2.6 2.3 1.5 3l4.5 3.5c1.8 1.5 2.8 3.5 2.8 5.5s-1.8 5.5-4.5 5.5c-2.3 0-4.2-1.5-5-3.5M8.5 15.5c.8 1.5 2.2 2.5 3.8 2.5 2 0 3.5-1.5 3.5-3.5 0-1.2-.6-2.3-1.5-3l-4.5-3.5C8 9.5 7 7.5 7 5.5S8.8 0 11.5 0c2.3 0 4.2 1.5 5 3.5", fill: "none", stroke: "#ff3e00", strokeWidth: 2, strokeLinecap: "round" })
      ]
    },
    nextjs: {
      color: "#ffffff",
      draw: (R) => [
        R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 10, fill: "#000000", stroke: "#333", strokeWidth: 1 }),
        R.createElement("path", { key: 1, d: "M7.5 16.5V7.5h1.5l5.5 6.5V7.5h1.5v9h-1.5l-5.5-6.5v6.5H7.5z", fill: "#ffffff" })
      ]
    },
    express: {
      color: "#999999",
      draw: (R) => [
        R.createElement("rect", { key: 0, x: 2, y: 5, width: 20, height: 14, rx: 3, fill: "#1e1e1e", stroke: "#444", strokeWidth: 1.2 }),
        R.createElement("path", { key: 1, d: "M5 9.5h2.5V11H6.2v1h1.2v1.5H6.2v1H7.5v1.5H5V9.5zM11 9.5l1.2 2.2 1.2-2.2h1.6l-2 3.2 2 3.3h-1.6l-1.2-2.2-1.2 2.2H9.4l2-3.3-2-3.2h1.6z", fill: "#ffffff" }),
        R.createElement("path", { key: 2, d: "M16 11.5c0-.6.3-1 1-1s1 .4 1 1v3c0 .6-.3 1-1 1s-1-.4-1-1v-3z", fill: "#10b981" })
      ]
    },
    node: {
      color: "#339933",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2L4 6.5v11L12 22l8-4.5v-11L12 2z", fill: "none", stroke: "#339933", strokeWidth: 1.7 }),
        R.createElement("path", { key: 1, d: "M12 5.5l5.5 3.2v6.6L12 18.5 6.5 15.3V8.7L12 5.5z", fill: "#339933" })
      ]
    },
    django: {
      color: "#092e20",
      draw: (R) => [
        R.createElement("rect", { key: 0, x: 2, y: 2, width: 20, height: 20, rx: 4, fill: "#092e20" }),
        R.createElement("path", { key: 1, d: "M6.5 7.5h2c2 0 3 1.2 3 3v2c0 1.8-1 3-3 3h-2V7.5zm2 6.5c1 0 1.5-.7 1.5-1.5v-2c0-.8-.5-1.5-1.5-1.5h-1V14h1zm8-6.5h-2v8h2v-8z", fill: "#ffffff" })
      ]
    },
    rails: {
      color: "#cc0000",
      draw: (R) => [
        R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9, fill: "#cc0000" }),
        R.createElement("path", { key: 1, d: "M8.5 7.5c0-.5.5-.8 1-.8h5c.5 0 1 .3 1 .8v1.5H8.5v-1.5zm0 3h7V12h-7v-1.5zm0 3h7v1.5c0 .5-.5.8-1 .8h-5c-.5 0-1-.3-1-.8v-1.5zM12 6.5v11", stroke: "#ffffff", strokeWidth: 1.2, fill: "none" })
      ]
    },
    docker: {
      color: "#2496ed",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M2 13.5c1 1 3.5 1 5 1s4.5-.5 5.5-2.5c1-2 1-5 0-6.5s-3-2-3-2V6c0 .8-.5 1.5-1.5 1.5s-2-.5-3-2v2.5S3.5 9 2.5 10c-1 1-1.5 2.5-.5 3.5z", fill: "#2496ed" }),
        R.createElement("rect", { key: 1, x: 5, y: 10, width: 2, height: 1.5, fill: "#ffffff" }),
        R.createElement("rect", { key: 2, x: 7.5, y: 10, width: 2, height: 1.5, fill: "#ffffff" }),
        R.createElement("rect", { key: 3, x: 6, y: 8, width: 2, height: 1.5, fill: "#ffffff" })
      ]
    },
    kubernetes: {
      color: "#326ce5",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2L4 6v10l8 4 8-4V6L12 2z", fill: "#326ce5" }),
        R.createElement("path", { key: 1, d: "M12 5.5l4.5 2.5v5.5L12 16.5 7.5 13.5V8L12 5.5z", fill: "#ffffff" }),
        R.createElement("circle", { key: 2, cx: 12, cy: 11, r: 2, fill: "#326ce5" })
      ]
    },
    aws: {
      color: "#ff9900",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M5 13.5c1-1.2 3-2 5.5-2s4.5.8 5.5 2", fill: "none", stroke: "#ffffff", strokeWidth: 1.5 }),
        R.createElement("path", { key: 1, d: "M4 17c3.5 2.5 8.5 2.5 12 0", fill: "none", stroke: "#ff9900", strokeWidth: 1.7, strokeLinecap: "round" }),
        R.createElement("path", { key: 2, d: "M16 16.2l1.2.8-.2-1.5", fill: "none", stroke: "#ff9900", strokeWidth: 1.7, strokeLinecap: "round" })
      ]
    },
    gcp: {
      color: "#4285f4",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2L4.5 6v9.5L12 20l7.5-4.5V6L12 2z", fill: "none", stroke: "#4285f4", strokeWidth: 1.5 }),
        R.createElement("path", { key: 1, d: "M12 2v18", stroke: "#34a853", strokeWidth: 1.5 }),
        R.createElement("path", { key: 2, d: "M4.5 15.5l15-7.5", stroke: "#fbbc05", strokeWidth: 1.5 }),
        R.createElement("path", { key: 3, d: "M4.5 8l15 7.5", stroke: "#ea4335", strokeWidth: 1.5 })
      ]
    },
    vercel: {
      color: "#ffffff",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 3l10 17H2L12 3z", fill: "#ffffff" })
      ]
    },
    firebase: {
      color: "#ffca28",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M3.8 17.5L8.5 3c.1-.4.6-.4.7-.1l2.5 4.6 4.1-8c.2-.3.7-.3.8 0L20.8 17H3.8z", fill: "#ffca28" }),
        R.createElement("path", { key: 1, d: "M3.8 17.5l8.5 4.8c.4.2.9.2 1.3 0l7.2-4.8H3.8z", fill: "#f57c00" }),
        R.createElement("path", { key: 2, d: "M9 10l8 7.5H3.8L9 10z", fill: "#ff9800" })
      ]
    },

    // Databases
    postgres: {
      color: "#336791",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M8 6c0-2 2-3 4-3s4 1 4 3v5c0 3.3-2.7 6-6 6-2 0-3-1-4-2.5V6z", fill: "#336791" }),
        R.createElement("path", { key: 1, d: "M8.5 12h7c2 0 3-1 3-3V6c0-1.5-1-2.5-3-2.5h-4.5c-.8.8-1 2-1 2.5", fill: "none", stroke: "#ffffff", strokeWidth: 1.2 }),
        R.createElement("circle", { key: 2, cx: 10.5, cy: 7.5, r: 0.6, fill: "#ffffff" })
      ]
    },
    mysql: {
      color: "#00758f",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M17.5 12c.5-1.5.5-3.5-1-4.5-1.8-1-3.5 0-4.5 1.5s.5 3.5 1 4c.3-.8.7-1.5 1.5-1.5s1 .8 1 1v2c-2.3-.3-4.5-1-6.5-2-.8-.4-2-.8-2-1.8 0-.8.8-1.5 1.8-1.8.8-.2 2.3.2 3.3.8", fill: "none", stroke: "#00758f", strokeWidth: 1.7 }),
        R.createElement("path", { key: 1, d: "M19.5 15.5l-2.7-1.3v-1.8L19.5 11v4.5z", fill: "#ff8f00" })
      ]
    },
    mongodb: {
      color: "#47a248",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2c0 0-5 3.8-5 8.5 0 3.2 2 5.5 5 7.5v-16z", fill: "#47a248" }),
        R.createElement("path", { key: 1, d: "M12 2c0 0 5 3.8 5 8.5 0 3.2-2 5.5-5 7.5v-16z", fill: "#3fa049" }),
        R.createElement("path", { key: 2, d: "M12 18V22l-1.5-2.5L12 18z", fill: "#7f7f7f" })
      ]
    },
    redis: {
      color: "#dc382d",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M3 7.5L12 3l9 4.5-9 4.5-9-4.5z", fill: "#dc382d" }),
        R.createElement("path", { key: 1, d: "M3 12.5L12 8l9 4.5-9 4.5-9-4.5z", fill: "#b62821" }),
        R.createElement("path", { key: 2, d: "M3 17.5L12 13l9 4.5-9 4.5-9-4.5z", fill: "#8a1714" })
      ]
    },
    graphql: {
      color: "#e10098",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2.5l8 4.6v9.3l-8 4.6-8-4.6V7.1l8-4.6z", fill: "none", stroke: "#e10098", strokeWidth: 1.5 }),
        R.createElement("path", { key: 1, d: "M12 7.5v9M7.7 10l8.6 5M16.3 10l-8.6 5", stroke: "#e10098", strokeWidth: 1.2 }),
        R.createElement("circle", { key: 2, cx: 12, cy: 12, r: 1.5, fill: "#e10098" })
      ]
    },
    git: {
      color: "#f05032",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 2.5l8.5 8.5c.6.6.6 1.5 0 2L12 21.5c-.6.6-1.5.6-2 0L1.5 13c-.6-.6-.6-1.5 0-2L10 2.5c.6-.6 1.5-.6 2 0z", fill: "#f05032" }),
        R.createElement("path", { key: 1, d: "M12 15.5V8.5m0 3.5c-1 0-2 .5-2 1.5v1.5", fill: "none", stroke: "#ffffff", strokeWidth: 1.7, strokeLinecap: "round" }),
        R.createElement("circle", { key: 2, cx: 12, cy: 15.5, r: 1.5, fill: "#ffffff" }),
        R.createElement("circle", { key: 3, cx: 12, cy: 8.5, r: 1.5, fill: "#ffffff" }),
        R.createElement("circle", { key: 4, cx: 10, cy: 15.0, r: 1.5, fill: "#ffffff" })
      ]
    },

    // Package Inventory specific dependencies
    lodash: {
      color: "#3075b4",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M4 6h3V4H3v16h4v-2H4V6zm13-2h4v16h-4v-2h3V6h-3V4zm-9 9h6v2H8v-2z", fill: "#3075b4", stroke: "none" }),
        R.createElement("rect", { key: 1, x: 8, y: 15, width: 8, height: 1.8, fill: "#3075b4" })
      ]
    },
    jsonwebtoken: {
      color: "#fb015b",
      draw: (R) => [
        R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9, stroke: "#ffd100", strokeWidth: 2, fill: "none" }),
        R.createElement("path", { key: 1, d: "M12 3A9 9 0 0121 12", stroke: "#fb015b", strokeWidth: 2.5, fill: "none" }),
        R.createElement("path", { key: 2, d: "M21 12A9 9 0 0112 21", stroke: "#00b9f1", strokeWidth: 2.5, fill: "none" }),
        R.createElement("path", { key: 3, d: "M9 10.5l2 2 4-4", stroke: "#ffffff", strokeWidth: 1.8, fill: "none", strokeLinecap: "round" })
      ]
    },
    axios: {
      color: "#5a29e4",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 3l8 8h-5v8h-6v-8H4l8-8z", fill: "#5a29e4" }),
        R.createElement("path", { key: 1, d: "M10 13h4v4h-4z", fill: "#ffffff" })
      ]
    },
    multer: {
      color: "#e9573f",
      draw: (R) => [
        R.createElement("rect", { key: 0, x: 4, y: 11, width: 16, height: 8, rx: 1.5, fill: "none", stroke: "#e9573f", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M12 4v9M8 8l4-4 4 4", fill: "none", stroke: "#e9573f", strokeWidth: 1.8, strokeLinecap: "round" }),
        R.createElement("path", { key: 2, d: "M8 15h8", stroke: "#e9573f", strokeWidth: 1.5, strokeLinecap: "round" })
      ]
    },
    sequelize: {
      color: "#3b75c3",
      draw: (R) => [
        R.createElement("rect", { key: 0, x: 6, y: 4, width: 12, height: 16, rx: 3, fill: "none", stroke: "#3b75c3", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M6 9h12M6 14h12", stroke: "#3b75c3", strokeWidth: 1.5 }),
        R.createElement("path", { key: 2, d: "M9 11.5c0-.8.6-1.5 1.5-1.5S12 10.7 12 11.5c0 .6-.4 1-.8 1.2-.8.4-1.2.8-1.2 1.3 0 .8.6 1.5 1.5 1.5s1.5-.7 1.5-1.5", fill: "none", stroke: "#ffffff", strokeWidth: 1.3, strokeLinecap: "round" })
      ]
    },
    nodemailer: {
      color: "#2bb0ed",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M3 6h18v12H3V6z", fill: "none", stroke: "#2bb0ed", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M3 6.5l9 6 9-6", fill: "none", stroke: "#2bb0ed", strokeWidth: 1.5 }),
        R.createElement("path", { key: 2, d: "M15 15l5.5 5.5M20.5 15l-5.5 5.5", stroke: "#ff6c00", strokeWidth: 1.5 })
      ]
    },
    stripe: {
      color: "#635bff",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M13.8 6.8c-.8-.5-2-.5-2.7-.2-.6.3-.9.9-.9 1.6 0 1.5 2.1 1.9 3.1 2.3 1.2.5 2.4 1.2 2.4 2.8 0 1.9-1.6 3-3.8 3-1.6 0-3-.4-3.8-1l.7-1.7c.8.5 2 .8 2.8.8.7 0 1.2-.3 1.2-.9 0-1.5-2.1-1.9-3.1-2.3C8.6 11 7.6 10.2 7.6 8.7c0-1.8 1.5-2.9 3.6-2.9 1.5 0 2.6.4 3.2.7l-.6 1.3z", fill: "#635bff" })
      ]
    },
    bcrypt: {
      color: "#10b981",
      draw: (R) => [
        R.createElement("rect", { key: 0, x: 5, y: 10, width: 14, height: 10, rx: 2, fill: "none", stroke: "#10b981", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M8 10V6.5a4 4 0 018 0V10", fill: "none", stroke: "#10b981", strokeWidth: 1.8 }),
        R.createElement("path", { key: 2, d: "M10 14h4M12 14v3", stroke: "#10b981", strokeWidth: 1.5 })
      ]
    },
    helmet: {
      color: "#94a3b8",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M12 3a8 8 0 00-8 8v3c0 2 1.5 3.5 3 4l5 2 5-2c1.5-.5 3-2 3-4v-3a8 8 0 00-8-8z", fill: "none", stroke: "#94a3b8", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M6 11h12M12 11v8", stroke: "#94a3b8", strokeWidth: 1.5 }),
        R.createElement("path", { key: 2, d: "M9 6a3 3 0 016 0", fill: "none", stroke: "#94a3b8", strokeWidth: 1.5 })
      ]
    },
    cors: {
      color: "#f97316",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M4 7h10M4 17h10M17 4l3 3-3 3M17 14l3 3-3 3", fill: "none", stroke: "#f97316", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M14 7c.5 2 1.5 3 3 3M14 17c.5-2 1.5-3 3-3", fill: "none", stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "2 2" })
      ]
    },
    dotenv: {
      color: "#eab308",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M14 3v5h5M6 3h8l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z", fill: "none", stroke: "#eab308", strokeWidth: 1.8 }),
        R.createElement("circle", { key: 1, cx: 9, cy: 13, r: 2, fill: "#eab308" }),
        R.createElement("path", { key: 2, d: "M9 15v3M13 13h3", stroke: "#eab308", strokeWidth: 1.5 })
      ]
    },
    winston: {
      color: "#d97706",
      draw: (R) => [
        R.createElement("path", { key: 0, d: "M4 12c0-3.5 2-6 8-6s8 2.5 8 6M3 13h18M6 13a2 2 0 004 0M14 13a2 2 0 004 0", fill: "none", stroke: "#d97706", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M9 6V4h6v2h-6z", fill: "#d97706" })
      ]
    },
    "express-rate-limit": {
      color: "#e11d48",
      draw: (R) => [
        R.createElement("circle", { key: 0, cx: 12, cy: 12, r: 9, fill: "none", stroke: "#e11d48", strokeWidth: 1.8 }),
        R.createElement("path", { key: 1, d: "M12 12l4-4M8.5 15.5l1.5-1.5", stroke: "#e11d48", strokeWidth: 1.5 }),
        R.createElement("path", { key: 2, d: "M12 6V4M6 12H4", stroke: "#e11d48", strokeWidth: 1.5 })
      ]
    }
  };

  const getCleanKey = (name) => name.toLowerCase().trim().replace(/[-\s_]/g, "");

  const extraBrandColors = {
    babel: "#f96332",
    webpack: "#8ed6fb",
    vite: "#646cff",
    npm: "#cb3837",
    yarn: "#2c8ebb",
    eslint: "#4b32c3",
    prettier: "#f7b93e",
    jest: "#c21325",
    mocha: "#8d6748",
    cypress: "#172b4d",
    graphql: "#e10098",
    apollo: "#311c87",
    prisma: "#2d3748",
    supabase: "#3ecf8e",
    tailwind: "#06b6d4",
    bootstrap: "#7952b3",
    sass: "#cf649a",
    less: "#1d365d",
    gulp: "#cf4647",
    grunt: "#fba919",
    rollup: "#ec4a3f",
    parcel: "#e68a00",
    swc: "#d97706",
    jquery: "#0769ad",
    lodash: "#3075b4",
    undici: "#000000",
    fastify: "#000000",
    hapi: "#ecbb45",
    koa: "#333333",
    socketio: "#010101",
    cors: "#f97316",
    helmet: "#94a3b8",
    morgan: "#333333",
    winston: "#d97706",
    uuid: "#854fff",
    chalk: "#eab308",
    commander: "#007acc",
    yargs: "#f7df1e",
    inquirer: "#d97706",
    dotenv: "#eab308",
    minimist: "#333333",
    rimraf: "#ff0000",
    mkdirp: "#ff0000",
    semver: "#3f9e4d",
    debug: "#333333",
    cheerio: "#e88024",
    jsdom: "#f05032",
    puppeteer: "#00d7a0",
    playwright: "#2ead33",
    axios: "#5a29e4",
    request: "#10b981",
    superagent: "#ff5b5b",
    nodemailer: "#2bb0ed",
    multer: "#e9573f",
    jsonwebtoken: "#fb015b",
    bcrypt: "#10b981",
    stripe: "#635bff",
    braintree: "#000000",
    paypal: "#003087",
    sendgrid: "#009ee2",
    mailgun: "#ff3366",
    twilio: "#f22f46",
    cloudinary: "#3448c5",
    aws: "#ff9900",
    azure: "#0078d4",
    gcp: "#4285f4",
    firebase: "#ffca28",
    supabase: "#3ecf8e",
    heroku: "#430098",
    digitalocean: "#0080ff",
    cloudflare: "#f38020"
  };

  const getStableColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    const s = 65;
    const l = 50;
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  window.Icons.getTechColor = function (name) {
    if (!name) return null;
    const key = getCleanKey(name);
    let match = TechIcons[key];
    if (!match) {
      if (key === "js") match = TechIcons.javascript;
      else if (key === "ts") match = TechIcons.typescript;
      else if (key === "py" || key === "python3") match = TechIcons.python;
      else if (key === "golang") match = TechIcons.go;
      else if (key === "postgresql" || key === "pg") match = TechIcons.postgres;
      else if (key === "mongo") match = TechIcons.mongodb;
      else if (key === "next") match = TechIcons.nextjs;
      else if (key === "jwt") match = TechIcons.jsonwebtoken;
    }
    if (match) return match.color;

    const slug = name.toLowerCase().trim().replace(/^@/, "").replace(/\//g, "-").replace(/\./g, "-dot-");
    if (extraBrandColors[slug]) return extraBrandColors[slug];
    if (extraBrandColors[name]) return extraBrandColors[name];
    
    return getStableColor(name);
  };

  function DynamicTechIcon({ name, size, fallbackInitials, fallbackBg, fallbackColor }) {
    const [failed, setFailed] = React.useState(false);
    
    const key = getCleanKey(name);
    let match = TechIcons[key];
    if (!match) {
      if (key === "js") match = TechIcons.javascript;
      else if (key === "ts") match = TechIcons.typescript;
      else if (key === "py" || key === "python3") match = TechIcons.python;
      else if (key === "golang") match = TechIcons.go;
      else if (key === "postgresql" || key === "pg") match = TechIcons.postgres;
      else if (key === "mongo") match = TechIcons.mongodb;
      else if (key === "next") match = TechIcons.nextjs;
      else if (key === "jwt") match = TechIcons.jsonwebtoken;
    }

    if (match) {
      return React.createElement("div", {
        style: {
          width: 28, height: 28, borderRadius: 7,
          background: "var(--bg-inset)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          border: match.color ? "1.5px solid color-mix(in srgb, " + match.color + " 30%, var(--border))" : "1px solid var(--border)",
          boxShadow: match.color ? "0 0 6px color-mix(in srgb, " + match.color + " 10%, transparent)" : "none"
        }
      }, React.createElement("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        style: { flexShrink: 0, display: "block" }
      }, match.draw(React, size)));
    }

    if (failed) {
      return React.createElement("div", {
        style: {
          width: 28, height: 28, borderRadius: 7,
          background: fallbackBg, color: fallbackColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
          flexShrink: 0, border: "1px solid color-mix(in srgb, " + fallbackColor + " 25%, transparent)"
        }
      }, fallbackInitials);
    }

    let slug = name.toLowerCase().trim()
      .replace(/^@/, "")
      .replace(/\//g, "-")
      .replace(/\./g, "-dot-");

    const slugMap = {
      "nodejs": "node-dot-js",
      "node": "node-dot-js",
      "next": "next-dot-js",
      "nextjs": "next-dot-js",
      "vue": "vue-dot-js",
      "vuejs": "vue-dot-js",
      "express-rate-limit": "express",
      "pg": "postgresql",
      "postgres": "postgresql",
      "mongo": "mongodb",
      "aws": "amazon-aws",
      "gcp": "google-cloud",
      "cpp": "cplusplus",
      "c++": "cplusplus",
      "c#": "csharp",
      "cs": "csharp",
      "f#": "fsharp",
      "fs": "fsharp"
    };

    if (slugMap[slug]) {
      slug = slugMap[slug];
    }

    const techColor = window.Icons.getTechColor(name);
    return React.createElement("div", {
      style: {
        width: 28, height: 28, borderRadius: 7,
        background: "var(--bg-inset)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        border: techColor ? "1.5px solid color-mix(in srgb, " + techColor + " 30%, var(--border))" : "1px solid var(--border)",
        boxShadow: techColor ? "0 0 6px color-mix(in srgb, " + techColor + " 10%, transparent)" : "none"
      }
    }, React.createElement("img", {
      src: "https://cdn.simpleicons.org/" + slug,
      width: size,
      height: size,
      style: { display: "block", objectFit: "contain", flexShrink: 0 },
      onError: () => setFailed(true),
      alt: name
    }));
  }

  window.Icons.getTechIcon = function (name, props) {
    if (!name) return null;
    props = props || {};
    const size = props.size || 16;
    
    return React.createElement(DynamicTechIcon, {
      name: name,
      size: size,
      fallbackInitials: props.initial,
      fallbackBg: props.bg,
      fallbackColor: props.color
    });
  };
})();

