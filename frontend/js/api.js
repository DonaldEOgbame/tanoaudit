// TanoAudit — frontend API client.
// Talks to the FastAPI backend. Loaded as plain JS (before the JSX scripts) and
// exposed as window.TanoAuditAPI. Handles the {data, error} envelope, JWT storage,
// and transparent access-token refresh on 401.
(function () {
  // Base URL: ?api= override, then <meta name="tanoaudit-api">, then default.
  function resolveBase() {
    try {
      const q = new URLSearchParams(window.location.search).get("api");
      if (q) return q.replace(/\/$/, "");
    } catch (e) { /* ignore */ }
    const meta = document.querySelector('meta[name="tanoaudit-api"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, "");
    return "http://localhost:8000/api/v1";
  }

  const BASE = resolveBase();
  const ACCESS_KEY = "tanoaudit.access";
  const REFRESH_KEY = "tanoaudit.refresh";

  // --- token store ---------------------------------------------------------
  const tokens = {
    get access() { return localStorage.getItem(ACCESS_KEY) || null; },
    get refresh() { return localStorage.getItem(REFRESH_KEY) || null; },
    set(access, refresh) {
      if (access) localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      emit();
    },
    clear() {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      emit();
    },
  };

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) {} }); }
  function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // A surfaced API error: carries the backend's code + message + HTTP status,
  // plus any extra fields from the error object (e.g. resets_in_seconds on a
  // daily_limit_reached 429).
  class ApiError extends Error {
    constructor(code, message, status, details) {
      super(message || code || "Request failed");
      this.code = code;
      this.status = status;
      this.details = details || null;
      if (details && typeof details === "object") {
        for (const k in details) {
          if (k !== "code" && k !== "message" && !(k in this)) this[k] = details[k];
        }
      }
    }
  }

  // Single in-flight refresh shared by concurrent callers.
  let refreshing = null;
  function doRefresh() {
    if (refreshing) return refreshing;
    const rt = tokens.refresh;
    if (!rt) return Promise.reject(new ApiError("unauthorized", "Not authenticated", 401));
    // Timeout the refresh too, so a hung backend can't wedge the boot flow.
    const rc = new AbortController();
    const rtimer = setTimeout(() => rc.abort(), 8000);
    refreshing = fetch(BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
      signal: rc.signal,
    })
      .then((r) => r.json().then((b) => ({ r, b })))
      .then(({ r, b }) => {
        if (!r.ok || (b && b.error)) {
          tokens.clear();
          throw new ApiError("unauthorized", "Session expired", 401);
        }
        tokens.set(b.data.access_token, b.data.refresh_token);
        return b.data.access_token;
      })
      .catch((e) => {
        if (e && e.name === "AbortError") { tokens.clear(); throw new ApiError("timeout", "Session refresh timed out", 0); }
        throw e;
      })
      .finally(() => { clearTimeout(rtimer); refreshing = null; });
    return refreshing;
  }

  // Core request. opts: { method, body, auth (default true), retry (internal) }.
  async function request(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers);
    let body = opts.body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const useAuth = opts.auth !== false;
    if (useAuth && tokens.access) headers["Authorization"] = "Bearer " + tokens.access;

    // Guard every request with a timeout so a down/hung backend rejects (and the
    // app can fall back to the auth screen) instead of spinning forever. Callers
    // may pass opts.timeoutMs; default is 60s to match long analysis requests.
    const timeoutMs = opts.timeoutMs || 60000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(BASE + path, { method: opts.method || "GET", headers, body, signal: controller.signal });
    } catch (e) {
      if (e && e.name === "AbortError") throw new ApiError("timeout", "The server took too long to respond", 0);
      throw new ApiError("network_error", "Could not reach the server", 0);
    } finally {
      clearTimeout(timer);
    }

    // Transparent refresh-and-retry once on 401.
    if (res.status === 401 && useAuth && !opts._retried && tokens.refresh) {
      try {
        await doRefresh();
      } catch (e) {
        throw e;
      }
      return request(path, Object.assign({}, opts, { _retried: true }));
    }

    if (res.status === 204) return null;

    let payload = null;
    try { payload = await res.json(); } catch (e) { /* non-JSON */ }

    if (!res.ok) {
      const err = payload && payload.error;
      throw new ApiError(
        err ? err.code : "http_error",
        err ? err.message : ("HTTP " + res.status),
        res.status,
        err,
      );
    }
    // Enveloped success → unwrap .data; tolerate bare bodies too.
    return payload && Object.prototype.hasOwnProperty.call(payload, "data")
      ? payload.data
      : payload;
  }

  const get = (p, opts) => request(p, Object.assign({ method: "GET" }, opts));
  const post = (p, body, opts) => request(p, Object.assign({ method: "POST", body }, opts));
  const patch = (p, body, opts) => request(p, Object.assign({ method: "PATCH", body }, opts));
  const del = (p, opts) => request(p, Object.assign({ method: "DELETE" }, opts));

  // Server-Sent-Events POST stream (used by the fix generators, which return
  // text/event-stream). onEvent(data) is called per `data:` line (parsed JSON
  // when possible, else the raw string). Resolves when the stream ends; the
  // returned object has abort(). Auth + 401-refresh mirror request().
  function stream(path, body, onEvent, opts) {
    opts = opts || {};
    const controller = new AbortController();
    const run = async (retried) => {
      const headers = { "Content-Type": "application/json", Accept: "text/event-stream" };
      if (tokens.access) headers["Authorization"] = "Bearer " + tokens.access;
      let res;
      try {
        res = await fetch(BASE + path, {
          method: "POST", headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (e) {
        if (e.name === "AbortError") return;
        throw new ApiError("network_error", "Could not reach the server", 0);
      }
      if (res.status === 401 && !retried && tokens.refresh) {
        await doRefresh();
        return run(true);
      }
      if (!res.ok || !res.body) {
        let payload = null;
        try { payload = await res.json(); } catch (e) {}
        const err = payload && payload.error;
        throw new ApiError(err ? err.code : "http_error", err ? err.message : "HTTP " + res.status, res.status);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // Process every complete "data:" line currently in buf.
      const drain = () => {
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let data; try { data = JSON.parse(raw); } catch (e) { data = raw; }
          if (onEvent) onEvent(data);
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        drain();
      }
      // Flush any trailing decoder state + a final line with no trailing newline,
      // so the LAST SSE event (often the most important — e.g. research_completed,
      // chat done) is never dropped when the stream closes mid-buffer.
      buf += decoder.decode();
      if (buf && !buf.endsWith("\n")) buf += "\n";
      drain();
    };
    const promise = run(false);
    return { promise, abort() { controller.abort(); } };
  }

  const qs = (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return q ? "?" + q : "";
  };

  // --- auth helpers --------------------------------------------------------
  const auth = {
    async register({ email, password, full_name }) {
      return post("/auth/register", { email, password, full_name }, { auth: false });
    },
    // Returns { totp_required, method } when 2FA is needed; otherwise stores
    // tokens and returns { ok: true }.
    async login({ email, password, totp_code }) {
      const data = await post("/auth/login", { email, password, totp_code }, { auth: false });
      if (data.totp_required) return { totp_required: true, method: data.method };
      tokens.set(data.tokens.access_token, data.tokens.refresh_token);
      return { ok: true };
    },
    async logout() {
      const rt = tokens.refresh;
      if (rt) { try { await post("/auth/logout", { refresh_token: rt }, { auth: false }); } catch (e) {} }
      tokens.clear();
    },
    // Boot-time session check: short timeout so an unreachable backend drops the
    // user to the auth screen quickly instead of an indefinite "Loading…".
    me() { return get("/profile", { timeoutMs: 8000 }); },
    isAuthed() { return !!tokens.access; },
    // Start "Sign in with GitHub": fetch the authorize URL, then hand the
    // browser off to GitHub. On return the backend redirects to <frontend>/#…
    // with tokens, consumed by consumeAuthRedirect() below.
    async githubStart() {
      const data = await get("/auth/github/start", { auth: false });
      if (data && data.authorize_url) window.location.assign(data.authorize_url);
      return data;
    },
    async googleStart() {
      const data = await get("/auth/google/start", { auth: false });
      if (data && data.authorize_url) window.location.assign(data.authorize_url);
      return data;
    },
    // Pick up tokens the backend put in the URL fragment after GitHub sign-in.
    // Returns true if a session was established. Also surfaces ?auth=error.
    consumeAuthRedirect() {
      try {
        const frag = (window.location.hash || "").replace(/^#/, "");
        if (frag) {
          const p = new URLSearchParams(frag);
          const at = p.get("access_token");
          const rt = p.get("refresh_token");
          if (at && rt) {
            tokens.set(at, rt);
            history.replaceState({}, document.title,
              window.location.pathname + window.location.search);
            return { ok: true };
          }
        }
        const q = new URLSearchParams(window.location.search);
        if (q.get("auth") === "error") {
          const msg = q.get("message") || "Sign-in failed.";
          ["auth", "message"].forEach((k) => q.delete(k));
          history.replaceState({}, document.title,
            window.location.pathname + (q.toString() ? "?" + q : "") + window.location.hash);
          return { error: msg };
        }
      } catch (e) { /* ignore */ }
      return null;
    },
  };

  // --- scans ---------------------------------------------------------------
  const scans = {
    // cfg matches ScanCreate (source_type, repo/source_url, branch, depth,
    // model_mode, models, include_custom, include_optimization).
    create(cfg) { return post("/scans", cfg); },
    // ZIP upload: file is a File/Blob; cfg is the ScanCreate-minus-source fields.
    upload(file, cfg) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("config", JSON.stringify(cfg || {}));
      return post("/scans/upload", fd);
    },
    list(params) {
      const q = new URLSearchParams(params || {}).toString();
      return get("/scans" + (q ? "?" + q : ""));
    },
    // TanoAudit model tiers for the selector: { tiers:[{id,label,description}], default }.
    models() { return get("/scans/models"); },
    // Rolling-24h scan usage vs cap: { used, limit, remaining, resets_in_seconds }.
    limit() { return get("/scans/limit"); },
    get(id) { return get("/scans/" + id); },
    // Rename and/or pin: patch accepts { display_name?, pinned? }.
    update(id, patch_) { return patch("/scans/" + id, patch_); },
    rename(id, name) { return patch("/scans/" + id, { display_name: name }); },
    setPinned(id, pinned) { return patch("/scans/" + id, { pinned: !!pinned }); },
    remove(id) { return del("/scans/" + id); },
    findings(id, params) {
      const q = new URLSearchParams(params || {}).toString();
      return get("/scans/" + id + "/findings" + (q ? "?" + q : ""));
    },
    // Dependency inventory: { items:[...], summary:{total,vulnerable,outdated,clean} }.
    dependencies(id) { return get("/scans/" + id + "/dependencies"); },
    // AI-generation composition derived from real findings.
    aigen(id) { return get("/scans/" + id + "/ai-generation"); },
    // Detected attack chains (vulnerability combinations): array of AttackPath dicts.
    attackPaths(id) { return get("/scans/" + id + "/attack-paths"); },
    control(id, command) {
      return post("/scans/" + id + "/control?command=" + encodeURIComponent(command));
    },
    // Live progress WebSocket. handlers: { onEvent(type, payload), onOpen,
    // onClose, onError }. Returns { socket, send(command), close() }.
    openWS(id, handlers) {
      handlers = handlers || {};
      // ws(s):// + the HTTP base host/path, with the access token as a query
      // param (browsers can't set WS Authorization headers).
      const wsBase = BASE.replace(/^http/i, "ws");
      const url = wsBase + "/scans/" + id + "/ws?token=" + encodeURIComponent(tokens.access || "");
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => handlers.onOpen && handlers.onOpen());
      socket.addEventListener("close", (e) => handlers.onClose && handlers.onClose(e));
      socket.addEventListener("error", (e) => handlers.onError && handlers.onError(e));
      socket.addEventListener("message", (e) => {
        if (!handlers.onEvent) return;
        let msg;
        try { msg = JSON.parse(e.data); } catch (err) { return; }
        if (msg && msg.type) handlers.onEvent(msg.type, msg.payload || {});
      });
      return {
        socket,
        send(command) {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ command }));
        },
        close() { try { socket.close(); } catch (e) {} },
      };
    },
  };

  // --- profile -------------------------------------------------------------
  const profile = {
    get() { return get("/profile"); },                 // GET  /profile
    update(patchBody) { return patch("/profile", patchBody); }, // PATCH /profile
  };

  // --- findings (per-finding actions + suppressions + fix generators) ------
  const findings = {
    markFalsePositive(id, reason) { return post("/findings/" + id + "/false-positive", { reason }); },
    unmarkFalsePositive(id) { return del("/findings/" + id + "/false-positive"); },
    markFixed(id, body) { return post("/findings/" + id + "/fixed", body || {}); },
    markIntentional(id, body) { return patch("/findings/" + id + "/mark-intentional", body || {}); },
    unmarkIntentional(id) { return patch("/findings/" + id + "/unmark-intentional", {}); },
    intentionalStubs(repo) { return get("/repos/" + encodeURIComponent(repo) + "/intentional-stubs"); },
    suppressions() { return get("/suppressions"); },
    deleteSuppression(id) { return del("/suppressions/" + id); },
    // SSE streams: onEvent receives each chunk; returns { promise, abort() }.
    generateFix(id, onEvent) { return stream("/findings/" + id + "/fix", undefined, onEvent); },
    generateImplementation(id, onEvent) { return stream("/findings/" + id + "/generate-implementation", undefined, onEvent); },
  };

  // --- reports (exports + share + diff) ------------------------------------
  const reports = {
    createExport(scanId, format) { return post("/scans/" + scanId + "/exports", { format }); },
    listExports(scanId) { return get("/scans/" + scanId + "/exports"); },
    // Direct file URL (the download endpoint streams the file, not JSON).
    downloadExportUrl(reportId) { return BASE + "/exports/" + reportId + "/download"; },
    createShare(scanId) { return post("/scans/" + scanId + "/share", {}); },
    getShare(scanId) { return get("/scans/" + scanId + "/share"); },
    deleteShare(tokenId) { return del("/share/" + tokenId); },
    diff(scanId, otherScanId) { return get("/scans/" + scanId + "/diff/" + otherScanId); },
  };

  // --- scoped report chat --------------------------------------------------
  const chat = {
    history(scanId) { return get("/scans/" + scanId + "/chat"); },     // info + counters
    // SSE stream: onEvent receives { delta } chunks then { done: true }.
    // Returns { promise, abort() }. Mirrors findings.generateFix.
    // `tier` is an optional TanoAudit model tier id (from scans.models()).
    send(scanId, message, messages, onEvent, tier, attackPathsContext) {
      const body = { message, messages: messages || [], tier: tier || null };
      if (attackPathsContext) body.attack_paths_context = attackPathsContext;
      return stream("/scans/" + scanId + "/chat", body, onEvent);
    },
  };

  // --- custom vulnerabilities ----------------------------------------------
  const customVulns = {
    list() { return get("/custom-vulnerabilities"); },
    get(id) { return get("/custom-vulnerabilities/" + id); },
    create(body) { return post("/custom-vulnerabilities", body); },
    update(id, body) { return patch("/custom-vulnerabilities/" + id, body); },
    remove(id) { return del("/custom-vulnerabilities/" + id); },
    research(body) { return post("/custom-vulnerabilities/research", body); }, // { name, description }
  };

  // --- optimization plans ---------------------------------------------------
  const plans = {
    list() { return get("/optimization-plans"); },
    create(body) { return post("/optimization-plans", body); },
    update(id, body) { return patch("/optimization-plans/" + id, body); },
    remove(id) { return del("/optimization-plans/" + id); },
    addGoal(planId, body) { return post("/optimization-plans/" + planId + "/goals", body); },
    updateGoal(goalId, body) { return patch("/optimization-plans/goals/" + goalId, body); },
    removeGoal(goalId) { return del("/optimization-plans/goals/" + goalId); },
    validate(body) { return post("/optimization-plans/validate", body); },
  };

  // --- watchlist ------------------------------------------------------------
  const watchlist = {
    repositories(params) { return get("/watchlist/repositories" + qs(params)); }, // ?github_only=true
    list() { return get("/watchlist"); },
    pin(repoId, body) { return post("/watchlist/" + repoId + "/pin", body || {}); },
    unpin(repoId) { return post("/watchlist/" + repoId + "/unpin"); },
    frequency(repoId, frequency) { return patch("/watchlist/" + repoId + "/frequency", { frequency }); },
    alerts() { return get("/watchlist/alerts"); },
    rescan(repoId) { return post("/watchlist/" + repoId + "/rescan", {}); },
    runDue() { return post("/watchlist/run-due", {}); },
  };

  // --- github integration ---------------------------------------------------
  const github = {
    status() { return get("/github/status"); },
    // Returns { authorize_url, state }; the page should redirect to authorize_url.
    authorize() { return get("/github/authorize"); },
    disconnect() { return post("/github/disconnect", {}); },
    repos() { return get("/github/repos"); },
    setTriggers(body) { return patch("/github/triggers", body); },
    setIssueSettings(body) { return patch("/github/issue-settings", body); },
    setStatusCheck(body) { return patch("/github/status-check", body); },
    setRepoAccess(body) { return patch("/github/repo-access", body); },
    createIssue(findingId) { return post("/github/findings/" + findingId + "/issue", {}); },
    deliveries() { return get("/github/deliveries"); },
  };

  // --- learning hub ---------------------------------------------------------
  const learning = {
    categories() { return get("/learning-hub/categories"); },
    classes(params) { return get("/learning-hub/classes" + qs(params)); }, // ?category= &q=
    classDetail(slug) { return get("/learning-hub/classes/" + encodeURIComponent(slug)); },
    forFinding(findingId) { return get("/learning-hub/for-finding/" + encodeURIComponent(findingId)); },
  };

  // --- notifications --------------------------------------------------------
  const notifications = {
    list(params) { return get("/notifications" + qs(params)); },
    unreadCount() { return get("/notifications/unread-count"); },
    markRead(id) { return post("/notifications/" + id + "/read", {}); },
    readAll() { return post("/notifications/read-all", {}); },
    remove(id) { return del("/notifications/" + id); },
    getPreferences() { return get("/notifications/preferences"); },
    putPreferences(body) { return request("/notifications/preferences", { method: "PUT", body }); },
  };

  // --- usage ----------------------------------------------------------------
  const usage = { get() { return get("/usage"); } };

  // --- settings (model preference, privacy) ---------------------------------
  // No API keys: the server holds provider keys; users pick TanoAudit model tiers.
  const settings = {
    getModels() { return get("/settings/models"); },          // { default_tier }
    putModels(body) { return request("/settings/models", { method: "PUT", body }); },
    getPrivacy() { return get("/settings/privacy"); },
    putPrivacy(body) { return request("/settings/privacy", { method: "PUT", body }); },
  };

  // --- security (password, 2FA, sessions, login history) --------------------
  const security = {
    changePassword(current_password, new_password) { return post("/security/change-password", { current_password, new_password }); },
    enrollTotp() { return post("/security/2fa/enroll", {}); },          // -> { secret, otpauth_uri }
    verifyTotp(code) { return post("/security/2fa/verify", { code }); },
    disableTotp(code) { return post("/security/2fa/disable", { code }); },
    totpStatus() { return get("/security/2fa/status"); },
    enrollEmailOtp() { return post("/security/2fa/email/enroll", {}); },
    verifyEmailOtp(code) { return post("/security/2fa/email/verify", { code }); },
    disableEmailOtp() { return post("/security/2fa/email/disable", {}); },
    setMethod(method) { return request("/security/2fa/method", { method: "PUT", body: { method } }); },
    backupCodes() { return post("/security/2fa/backup-codes", {}); },   // -> { codes: [...] }
    sessions() { return get("/security/sessions"); },
    deleteSession(id) { return del("/security/sessions/" + id); },
    loginHistory() { return get("/security/login-history"); },
  };

  // --- handoff (Claude Code MCP handoff links) ------------------------------
  const handoff = {
    generate(auditId, body) { return post("/audits/" + auditId + "/handoff/generate", body || {}); },
    links() { return get("/handoff-links"); },
    deleteLink(tokenId) { return del("/handoff-links/" + tokenId); },
  };

  // --- fun facts (optional; live-scan trivia) -------------------------------
  // Pull the full shuffled pool (server caps at 100) so a long scan cycles through
  // the whole set, not just the default batch of 20.
  const funFacts = { get(count) { return get("/fun-facts?count=" + (count || 100)); } };

  window.TanoAuditAPI = {
    BASE, ApiError,
    request, get, post, patch, del, stream,
    auth, scans, profile, findings, reports, chat, customVulns, plans,
    watchlist, github, learning, notifications, usage, settings, security,
    handoff, funFacts,
    tokens, onAuthChange,
  };
})();
