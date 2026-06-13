// Akira AI — frontend API client.
// Talks to the FastAPI backend. Loaded as plain JS (before the JSX scripts) and
// exposed as window.AkiraAPI. Handles the {data, error} envelope, JWT storage,
// and transparent access-token refresh on 401.
(function () {
  // Base URL: ?api= override, then <meta name="akira-api">, then default.
  function resolveBase() {
    try {
      const q = new URLSearchParams(window.location.search).get("api");
      if (q) return q.replace(/\/$/, "");
    } catch (e) { /* ignore */ }
    const meta = document.querySelector('meta[name="akira-api"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, "");
    return "http://localhost:8000/api/v1";
  }

  const BASE = resolveBase();
  const ACCESS_KEY = "akira.access";
  const REFRESH_KEY = "akira.refresh";

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

  // A surfaced API error: carries the backend's code + message + HTTP status.
  class ApiError extends Error {
    constructor(code, message, status) {
      super(message || code || "Request failed");
      this.code = code;
      this.status = status;
    }
  }

  // Single in-flight refresh shared by concurrent callers.
  let refreshing = null;
  function doRefresh() {
    if (refreshing) return refreshing;
    const rt = tokens.refresh;
    if (!rt) return Promise.reject(new ApiError("unauthorized", "Not authenticated", 401));
    refreshing = fetch(BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
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
      .finally(() => { refreshing = null; });
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

    let res;
    try {
      res = await fetch(BASE + path, { method: opts.method || "GET", headers, body });
    } catch (e) {
      throw new ApiError("network_error", "Could not reach the server", 0);
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
    me() { return get("/profile"); },
    isAuthed() { return !!tokens.access; },
  };

  window.AkiraAPI = {
    BASE, ApiError,
    request, get, post, patch, del,
    auth, tokens, onAuthChange,
  };
})();
