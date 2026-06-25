// Akira AI — Auth screen (login + register), wired to the real backend.
// Exposes window.AuthScreen. Calls AkiraAPI.auth; on success invokes onAuthed().
(function () {
  const React = window.React;
  const { useState, useRef, useEffect } = React;
  const h = React.createElement;
  const Icons = window.Icons || {};
  const API = window.AkiraAPI;

  function Field({ label, type, value, onChange, autoFocus, placeholder, autoComplete, onEnter }) {
    const [reveal, setReveal] = useState(false);
    const isPassword = type === "password";
    // Show plain text when the eye is toggled on; otherwise honor the given type.
    const effectiveType = isPassword && reveal ? "text" : (type || "text");
    return h("label", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("span", { style: { fontSize: 12.5, fontWeight: 550, color: "var(--text-2)" } }, label),
      h("div", { style: { position: "relative", display: "flex" } },
        h("input", {
          className: "input",
          type: effectiveType,
          value, autoComplete, placeholder, autoFocus,
          onChange: (e) => onChange(e.target.value),
          onKeyDown: (e) => { if (e.key === "Enter" && onEnter) onEnter(); },
          style: {
            flex: 1, width: "100%",
            background: "var(--bg-2, var(--bg-active))", border: "1px solid var(--border)",
            borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "var(--text-1)", outline: "none",
            paddingRight: isPassword ? 40 : 12,
          },
        }),
        isPassword && h("button", {
          type: "button",
          onClick: () => setReveal((v) => !v),
          "aria-label": reveal ? "Hide password" : "Show password",
          title: reveal ? "Hide password" : "Show password",
          tabIndex: -1,
          style: {
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, padding: 0, borderRadius: 6,
            background: "none", border: "none", cursor: "pointer", color: "var(--text-3)",
          },
        }, h((reveal ? Icons.eyeOff : Icons.eye) || (() => null), { size: 16 })),
      ),
    );
  }

  // Social login buttons (Google / GitHub). Both are wired to real OAuth start
  // endpoints; each surfaces a clear "not configured" error if the server lacks
  // that provider's client credentials.
  function SocialButton({ provider, label, onClick }) {
    const icon = provider === "github"
      ? h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor" },
          h("path", { d: "M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" }))
      : h("svg", { width: 18, height: 18, viewBox: "0 0 24 24" },
          h("path", { fill: "#4285F4", d: "M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 01-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" }),
          h("path", { fill: "#34A853", d: "M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" }),
          h("path", { fill: "#FBBC05", d: "M5.3 14.3a7.2 7.2 0 010-4.6V6.6H1.3a12 12 0 000 10.8l4-3.1z" }),
          h("path", { fill: "#EA4335", d: "M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0012 0 12 12 0 001.3 6.6l4 3.1C6.2 6.9 8.9 4.8 12 4.8z" }));
    return h("button", {
      type: "button", onClick,
      style: {
        display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        width: "100%", padding: "10px 14px", borderRadius: 9,
        background: "var(--bg-2, var(--bg-active))", border: "1px solid var(--border)",
        color: "var(--text-1)", fontSize: 13.5, fontWeight: 550, cursor: "pointer",
        transition: "border-color 160ms ease, background 160ms ease",
      },
      onMouseEnter: (e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; },
      onMouseLeave: (e) => { e.currentTarget.style.borderColor = "var(--border)"; },
    }, icon, label);
  }

  function AuthScreen({ onAuthed, initialMode, onBack, initialError }) {
    const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [needTotp, setNeedTotp] = useState(false);
    const [totpMethod, setTotpMethod] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(initialError || null);
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

    async function githubLogin() {
      setError(null); setNotice(null); setBusy(true);
      try {
        await API.auth.githubStart(); // navigates away to GitHub on success
      } catch (e) {
        setBusy(false);
        setError(e && e.code === "github_not_configured"
          ? "GitHub sign-in isn't configured on this server yet."
          : (e && e.message) || "Could not start GitHub sign-in.");
      }
    }

    async function googleLogin() {
      setError(null); setNotice(null); setBusy(true);
      try {
        await API.auth.googleStart(); // navigates away to Google on success
      } catch (e) {
        setBusy(false);
        setError(e && e.code === "google_not_configured"
          ? "Google sign-in isn't configured on this server yet."
          : (e && e.message) || "Could not start Google sign-in.");
      }
    }

    return h("div", {
      style: {
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#000", padding: 24, position: "relative", overflow: "hidden",
      },
    },
      // radial accent glow behind the card
      h("div", {
        "aria-hidden": "true",
        style: {
          position: "absolute", left: "50%", top: "62%", transform: "translate(-50%,-50%)",
          width: "70vw", height: "70vh",
          background: "radial-gradient(ellipse at center, var(--accent-soft), transparent 60%)",
          filter: "blur(50px)", pointerEvents: "none",
        },
      }),
      onBack && h("button", {
        onClick: onBack,
        style: {
          position: "absolute", top: 24, left: 24, zIndex: 2,
          background: "none", border: "none", color: "var(--text-2)",
          fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        },
      }, "← Home"),
      h("div", {
        className: "akl-auth-container vs-page-enter"
      },
        // Left Side Panel: Samurai image & quote
        h("div", { className: "akl-auth-left" },
          h("div", { className: "akl-auth-left-content" },
            h("div", { className: "akl-auth-quote-jp" }, "心眼を開き、目に見えぬところを悟ること"),
            h("div", { className: "akl-auth-quote-en" },
              "\"Open the shingan (mind's eye) and perceive that which cannot be seen by the eyes.\"",
              h("br"),
              "— Miyamoto Musashi, The Book of Five Rings"
            )
          )
        ),
        // Right Side Panel: Form contents
        h("div", { className: "akl-auth-right" },
          h("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" } },
            h("img", { src: "logo.svg", alt: "Akira AI", style: { height: 54, marginBottom: 12 } }),
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

          !needTotp && h(React.Fragment, null,
            h("div", { style: { display: "flex", gap: 12 } },
              h(SocialButton, { provider: "google", label: "Google", onClick: googleLogin }),
              h(SocialButton, { provider: "github", label: "GitHub", onClick: githubLogin }),
            ),
            h("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
              h("div", { style: { flex: 1, height: 1, background: "var(--border)" } }),
              h("span", { style: { fontSize: 11.5, color: "var(--text-3)" } }, "or"),
              h("div", { style: { flex: 1, height: 1, background: "var(--border)" } }),
            ),
          ),

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
        )
      ),
    );
  }

  window.AuthScreen = AuthScreen;
})();
