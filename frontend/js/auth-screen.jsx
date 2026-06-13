// Akira AI — Auth screen (login + register), wired to the real backend.
// Exposes window.AuthScreen. Calls AkiraAPI.auth; on success invokes onAuthed().
(function () {
  const React = window.React;
  const { useState, useRef, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons || {};
  const API = window.AkiraAPI;

  function Field({ label, type, value, onChange, autoFocus, placeholder, autoComplete, onEnter }) {
    return h("label", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("span", { style: { fontSize: 12.5, fontWeight: 550, color: "var(--text-2)" } }, label),
      h("input", {
        className: "input",
        type: type || "text",
        value, autoComplete, placeholder, autoFocus,
        onChange: (e) => onChange(e.target.value),
        onKeyDown: (e) => { if (e.key === "Enter" && onEnter) onEnter(); },
        style: {
          background: "var(--bg-2, var(--bg-active))", border: "1px solid var(--border)",
          borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "var(--text-1)", outline: "none",
        },
      }),
    );
  }

  function AuthScreen({ onAuthed }) {
    const [mode, setMode] = useState("login"); // "login" | "register"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [needTotp, setNeedTotp] = useState(false);
    const [totpMethod, setTotpMethod] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    function reset(next) {
      setMode(next); setError(null); setNotice(null);
      setNeedTotp(false); setTotpCode(""); setPassword("");
    }

    async function submit() {
      if (busy) return;
      setError(null); setNotice(null);
      if (!email || !password) { setError("Email and password are required."); return; }
      if (mode === "register" && password.length < 8) {
        setError("Password must be at least 8 characters."); return;
      }
      setBusy(true);
      try {
        if (mode === "register") {
          await API.auth.register({ email, password, full_name: fullName || null });
          // Auto-login straight after a successful registration.
          const r = await API.auth.login({ email, password });
          if (r.ok) { onAuthed(); return; }
        } else {
          const r = await API.auth.login({
            email, password, totp_code: needTotp ? totpCode : undefined,
          });
          if (r.ok) { onAuthed(); return; }
          if (r.totp_required) {
            setNeedTotp(true); setTotpMethod(r.method);
            setNotice(r.method === "email"
              ? "We emailed you a verification code."
              : "Enter the code from your authenticator app.");
            return;
          }
        }
      } catch (e) {
        setError(e && e.message ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    }

    const isLogin = mode === "login";
    return h("div", {
      style: {
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-app)", padding: 24,
      },
    },
      h("div", {
        className: "card vs-page-enter",
        style: {
          width: "100%", maxWidth: 400, padding: "32px 30px",
          display: "flex", flexDirection: "column", gap: 18,
        },
      },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" } },
          h("img", { src: "logo.svg", alt: "Akira AI", style: { height: 34, marginBottom: 6 } }),
          h("h1", { style: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" } },
            isLogin ? "Welcome back" : "Create your account"),
          h("p", { style: { fontSize: 13, color: "var(--text-2)" } },
            isLogin ? "Sign in to continue to your security dashboard."
              : "Start scanning your codebase in minutes."),
        ),

        notice && h("div", {
          style: {
            fontSize: 12.5, padding: "9px 12px", borderRadius: 8,
            background: "var(--accent-soft)", color: "var(--text-1)",
            border: "1px solid var(--border)",
          },
        }, notice),
        error && h("div", {
          style: {
            fontSize: 12.5, padding: "9px 12px", borderRadius: 8,
            background: "rgba(239,68,68,0.12)", color: "var(--sev-high, #ef4444)",
            border: "1px solid rgba(239,68,68,0.3)",
          },
        }, error),

        needTotp
          ? h(Field, {
              label: totpMethod === "email" ? "Email code" : "Authenticator code",
              value: totpCode, onChange: setTotpCode, autoFocus: true,
              placeholder: "123456", autoComplete: "one-time-code", onEnter: submit,
            })
          : h(React.Fragment, null,
              !isLogin && h(Field, {
                label: "Full name", value: fullName, onChange: setFullName,
                placeholder: "Alex Rivera", autoComplete: "name", onEnter: submit,
              }),
              h(Field, {
                label: "Email", type: "email", value: email, onChange: setEmail,
                autoFocus: isLogin, placeholder: "you@company.com",
                autoComplete: "email", onEnter: submit,
              }),
              h(Field, {
                label: "Password", type: "password", value: password, onChange: setPassword,
                placeholder: "••••••••",
                autoComplete: isLogin ? "current-password" : "new-password", onEnter: submit,
              }),
            ),

        h("button", {
          className: "btn btn-primary btn-lg",
          disabled: busy,
          onClick: submit,
          style: { justifyContent: "center", marginTop: 4, opacity: busy ? 0.7 : 1 },
        }, busy ? "Please wait…" : needTotp ? "Verify" : isLogin ? "Sign in" : "Create account"),

        !needTotp && h("div", { style: { fontSize: 12.5, color: "var(--text-2)", textAlign: "center" } },
          isLogin ? "New to Akira AI? " : "Already have an account? ",
          h("button", {
            onClick: () => reset(isLogin ? "register" : "login"),
            style: { background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: 0 },
          }, isLogin ? "Create an account" : "Sign in"),
        ),
        needTotp && h("button", {
          onClick: () => { setNeedTotp(false); setTotpCode(""); setError(null); setNotice(null); },
          style: { background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", fontSize: 12.5, textAlign: "center" },
        }, "← Back"),
      ),
    );
  }

  window.AuthScreen = AuthScreen;
})();
