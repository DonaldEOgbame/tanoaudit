// VaultScan demo data — facts, dependencies, scans, repos, learning hub, categories
(function () {
  // 40+ rotating tech facts for the live scan screen
  window.VS_FACTS = [
    "The first computer bug was an actual moth, found in a Harvard Mark II relay in 1947.",
    "NASA still runs code from the 1970s on the Voyager probes — now over 15 billion miles away.",
    "The term 'debugging' predates computers; Edison used it in 1878 to describe fixing faults.",
    "Roughly 70% of all security breaches trace back to just three bug classes: injection, broken auth, and misconfiguration.",
    "The 'Y2K' fix is estimated to have cost the world over $300 billion.",
    "JavaScript was created in just 10 days by Brendan Eich in 1995.",
    "The most expensive software bug ever — the Ariane 5 rocket — cost ~$370M from a single integer overflow.",
    "SQL injection was first publicly described in 1998 and is still the #3 web risk in OWASP's 2021 list.",
    "Git was written by Linus Torvalds in about two weeks in 2005.",
    "The average codebase contains 70% open-source code — most of it never reviewed by the team shipping it.",
    "A single misconfigured S3 bucket has leaked billions of records over the past decade.",
    "The Heartbleed bug existed in OpenSSL for over two years before discovery in 2014.",
    "'Hello, World!' first appeared in a 1972 Bell Labs tutorial for the B language.",
    "The longest-lived software bug took 30+ years to surface in some Unix date routines.",
    "Passwords stored with bcrypt cost 12 take ~250ms each to verify — that's the point.",
    "The first webcam watched a coffee pot at Cambridge so researchers wouldn't walk to an empty one.",
    "There are an estimated 26.9 million professional software developers in the world.",
    "The Morris Worm of 1988 infected ~10% of the internet — which was about 6,000 machines then.",
    "Regular expressions were formalized by mathematician Stephen Kleene in 1951.",
    "The '404' status code is not named after a room at CERN — that's a popular myth.",
    "A CWE is a 'Common Weakness Enumeration' — there are over 900 catalogued weakness types.",
    "The padlock icon in browsers dates back to Netscape Navigator in 1994.",
    "Cross-site scripting (XSS) was named by Microsoft engineers in the year 2000.",
    "The first ransomware, the 'AIDS Trojan', spread via floppy disks mailed in 1989.",
    "Stack Overflow launched in 2008; it now serves over 100 million developers a month.",
    "The Unix epoch starts at midnight UTC on January 1, 1970.",
    "RSA encryption is named after Rivest, Shamir, and Adleman, who published it in 1977.",
    "The word 'spam' for junk messages comes from a 1970 Monty Python sketch.",
    "Modern GPUs can attempt billions of password guesses per second against weak hashes.",
    "The first version of Linux was released to a Usenet group with the note 'just a hobby'.",
    "CORS — Cross-Origin Resource Sharing — exists to safely relax the same-origin policy.",
    "The 2017 Equifax breach exploited a known Apache Struts flaw left unpatched for months.",
    "Cryptographically secure randomness and Math.random() are NOT interchangeable.",
    "The 'Turing completeness' of a language means it can compute anything computable, given time.",
    "CVE — Common Vulnerabilities and Exposures — has catalogued over 200,000 entries.",
    "The shortest valid HTTP/1.0 response is just a status line and two CRLFs.",
    "JWTs are signed, not encrypted — anyone can read the payload, so never put secrets in them.",
    "The first emoji set was created in 1999 by Shigetaka Kurita — just 176 tiny images.",
    "Defense in depth means no single control failure should compromise the whole system.",
    "The 'principle of least privilege' was articulated by Saltzer and Schroeder in 1975.",
    "Rubber duck debugging — explaining your code to a toy duck — is a real, effective technique.",
    "An estimated 30% of npm packages have at least one known vulnerability in their dependency tree.",
    "TLS 1.3, finalized in 2018, removed dozens of legacy options to shrink the attack surface.",
    "The first domain ever registered was symbolics.com, on March 15, 1985.",
  ];

  // Live-scan terminal log lines (templated with file names at runtime)
  window.VS_LOG_TEMPLATES = [
    "Cloning repository user/ecommerce-api@main…",
    "Detected runtime: Node.js 18 · Express 4 · Sequelize 6",
    "Building dependency graph (47 packages)…",
    "Parsing {file} — {n} segments created",
    "Dispatching segment batch to Gemini 2.0 Flash",
    "Dispatching segment batch to OpenRouter / Claude Haiku",
    "Cross-verifying critical finding across 2 models",
    "OWASP A03:2021 pattern matched in {file}",
    "Optimization engine: analyzing query patterns in {file}",
    "Rate limit warning from Gemini — throttling to 60 rpm",
    "Rerouting 23 segments to OpenRouter (failover)",
    "AI-generation heuristic flagged {file} (confidence 0.81)",
    "Computing severity rollup for src/routes/",
    "Resolving CWE mappings for 43 findings",
    "Finalizing report · generating executive summary",
  ];

  // Dependencies tab
  window.VS_DEPS = [
    { name: "lodash", version: "4.17.15", status: "Vulnerable", cve: "CVE-2021-23337", note: "Command injection via template", suggested: "4.17.21" },
    { name: "jsonwebtoken", version: "8.5.1", status: "Vulnerable", cve: "CVE-2022-23529", note: "Insecure key type confusion", suggested: "9.0.2" },
    { name: "express", version: "4.17.1", status: "Outdated", cve: "—", note: "Several patch releases behind", suggested: "4.21.2" },
    { name: "axios", version: "0.21.1", status: "Vulnerable", cve: "CVE-2021-3749", note: "ReDoS in trim function", suggested: "1.7.9" },
    { name: "multer", version: "1.4.2", status: "Vulnerable", cve: "CVE-2022-24434", note: "DoS via malformed request", suggested: "1.4.5-lts.1" },
    { name: "sequelize", version: "6.6.5", status: "Outdated", cve: "—", note: "Minor versions behind", suggested: "6.37.5" },
    { name: "nodemailer", version: "6.6.3", status: "Outdated", cve: "—", note: "Patches available", suggested: "6.9.16" },
    { name: "stripe", version: "8.222.0", status: "Outdated", cve: "—", note: "Major versions behind", suggested: "17.5.0" },
    { name: "bcrypt", version: "5.0.1", status: "Clean", cve: "—", note: "Up to date", suggested: "—" },
    { name: "helmet", version: "7.1.0", status: "Clean", cve: "—", note: "Up to date (but unused!)", suggested: "—" },
    { name: "cors", version: "2.8.5", status: "Clean", cve: "—", note: "Latest", suggested: "—" },
    { name: "dotenv", version: "16.4.5", status: "Clean", cve: "—", note: "Latest", suggested: "—" },
    { name: "pg", version: "8.7.1", status: "Outdated", cve: "—", note: "Patches available", suggested: "8.13.1" },
    { name: "express-rate-limit", version: "5.3.0", status: "Outdated", cve: "—", note: "Major versions behind", suggested: "7.4.1" },
    { name: "winston", version: "3.3.3", status: "Clean", cve: "—", note: "Latest minor", suggested: "—" },
  ];

  // AI-Gen analysis patterns
  window.VS_AIGEN = {
    percent: 38,
    delta: 2.4, // AI sections X times more vulnerable
    patterns: [
      { name: "Incomplete auth stubs", count: 6, desc: "`// TODO: verify token` left next to a passthrough." },
      { name: "Permissive CORS boilerplate", count: 3, desc: "`origin: true` copied from a Stack Overflow snippet." },
      { name: "Hallucinated / unused imports", count: 9, desc: "Imported modules that are never referenced." },
      { name: "Missing error handling", count: 12, desc: "Awaited calls with no try/catch on the happy path only." },
      { name: "Generic variable naming", count: 21, desc: "data, result, temp, item used pervasively." },
      { name: "Copy-pasted validation regexes", count: 4, desc: "Three different email regexes, none correct." },
    ],
  };

  // Recent scans (sidebar + dashboard)
  window.VS_SCANS = [
    { id: "scan-1", repo: "user/ecommerce-api", sev: "critical", issues: 43, when: "just now", score: 38, optScore: 64, active: true },
    { id: "scan-2", repo: "user/payments-gateway", sev: "high", issues: 19, when: "2h ago", score: 61, optScore: 72 },
    { id: "scan-3", repo: "acme/marketing-site", sev: "clean", issues: 2, when: "yesterday", score: 94, optScore: 88 },
    { id: "scan-4", repo: "user/auth-service", sev: "high", issues: 14, when: "2d ago", score: 67, optScore: 70 },
    { id: "scan-5", repo: "acme/internal-dashboard", sev: "medium", issues: 8, when: "4d ago", score: 79, optScore: 81 },
    { id: "scan-6", repo: "user/mobile-bff", sev: "clean", issues: 1, when: "1w ago", score: 96, optScore: 90 },
  ];

  // Watchlist
  window.VS_WATCHLIST = [
    { repo: "user/ecommerce-api", score: 38, change: "+3 new", changeDir: "up", freq: "daily", last: "just now" },
    { repo: "user/payments-gateway", score: 61, change: "−2 fixed", changeDir: "down", freq: "daily", last: "2h ago" },
    { repo: "acme/marketing-site", score: 94, change: "no change", changeDir: "flat", freq: "weekly", last: "yesterday" },
    { repo: "user/auth-service", score: 67, change: "+1 new", changeDir: "up", freq: "manual", last: "2d ago" },
  ];

  // Optimization plans
  window.VS_PLANS = [
    {
      name: "Q3 Latency Reduction", repo: "user/ecommerce-api", priority: "High", progress: 60, health: 82,
      goals: [
        { text: "Eliminate all N+1 query patterns in order flows", status: "Done" },
        { text: "Add composite indexes for top 5 slow queries", status: "In progress" },
        { text: "Introduce a 60s TTL cache for the category tree", status: "In progress" },
        { text: "Move static assets behind a CDN", status: "Pending" },
        { text: "Right-size the Postgres connection pool", status: "Done" },
      ],
      linked: 4,
    },
    {
      name: "Dependency Health", repo: "user/payments-gateway", priority: "Medium", progress: 33, health: 70,
      goals: [
        { text: "Patch all Vulnerable dependencies", status: "In progress" },
        { text: "Replace wholesale lodash import", status: "Pending" },
        { text: "Upgrade Stripe SDK to v17", status: "Pending" },
      ],
      linked: 3,
    },
    {
      name: "Auth Hardening", repo: "user/auth-service", priority: "High", progress: 100, health: 100,
      goals: [
        { text: "Verify JWT signatures everywhere", status: "Done" },
        { text: "Add rate limiting to login + reset", status: "Done" },
        { text: "Raise bcrypt cost to 12", status: "Done" },
      ],
      linked: 5,
    },
  ];

  // Custom vulnerabilities library
  window.VS_CUSTOM_VULNS = [
    { name: "Leaked internal Slack webhook", sev: "high", active: true, desc: "Detects hooks.slack.com webhook URLs committed to source." },
    { name: "Use of deprecated internal SDK v1", sev: "medium", active: true, desc: "Flags imports of @acme/sdk below v2 (EOL)." },
    { name: "PII in log statements", sev: "high", active: true, desc: "Emails, SSNs, or card numbers passed to logger calls." },
    { name: "Feature flag left hardcoded true", sev: "low", active: false, desc: "isEnabled = true overrides flag service." },
    { name: "Direct prod DB connection string", sev: "critical", active: true, desc: "prod-db.acme.internal referenced outside config." },
  ];

  // Full real vulnerability taxonomy and unique contents
  window.VS_TAXONOMY = {
    "Injection": [
      { name: "SQL Injection", cwe: "CWE-89", owasp: "A03:2021", severity: "critical", what: "Concatenating user input directly into SQL statements, altering database query structure.", exploit: "Sending ' OR '1'='1 to bypass logins or run stack queries.", example: "Heartland Payment Systems (2008), 130M cards stolen.", fix: "Use parameterized queries or structured query builders." },
      { name: "Command Injection", cwe: "CWE-78", owasp: "A03:2021", severity: "critical", what: "Injecting OS commands into arguments passed to system shell executors.", exploit: "Appending shell characters like ; cat /etc/passwd to read files.", example: "Shellshock Bash vulnerability (2014) allowed command execution.", fix: "Use direct execution methods like child_process.execFile instead of shell interpreters." },
      { name: "Code Injection (eval)", cwe: "CWE-95", owasp: "A03:2021", severity: "critical", what: "Evaluating user-supplied input strings directly inside the application's runtime interpreter.", exploit: "Passing strings containing process termination or file system read APIs.", example: "Node.js serialization libraries exploited via untrusted input execution.", fix: "Avoid eval entirely; parse expressions with structured, non-executable grammars." },
      { name: "XXE (XML External Entity)", cwe: "CWE-611", owasp: "A05:2021", severity: "high", what: "XML parser configured to parse external entity definitions inside user-provided XML payloads.", exploit: "Defining system entities referencing file:///etc/passwd to exfiltrate local files.", example: "A major tax-prep firm leaked private server configurations via XXE.", fix: "Configure XML parser options to disable DTD validation and external entities." },
      { name: "LDAP Injection", cwe: "CWE-90", owasp: "A03:2021", severity: "high", what: "Unsafe interpolation of user parameters into LDAP query statements.", exploit: "Tampering with query arguments using wildcards to view unauthorized directories.", example: "Active Directory authentication bypasses via LDAP filter modification.", fix: "Sanitize and escape input queries before passing them to the directory server." },
      { name: "Server-Side Template Injection", cwe: "CWE-1336", owasp: "A03:2021", severity: "critical", what: "Rendering user input inside server templates (EJS, Pug, Jinja) before engine evaluation.", exploit: "Using template syntax such as <%= process.mainModule.require(...) %> to run code.", example: "A gaming forum hacked via custom email templates referencing local modules.", fix: "Always pass user parameters as context variables, not raw template body." },
      { name: "NoSQL Injection", cwe: "CWE-943", owasp: "A03:2021", severity: "high", what: "Unescaped query expressions passed directly to NoSQL engines (e.g. MongoDB).", exploit: "Sending JSON payloads with $gt operators to bypass account checks.", example: "Node-Express API database access bypassed via object query manipulation.", fix: "Enforce strict schema types and cast query parameters to basic types." },
      { name: "Header Injection", cwe: "CWE-113", owasp: "A03:2021", severity: "medium", what: "Inserting carriage return and line feed characters (CRLF) into HTTP headers.", exploit: "Using %0D%0ASet-Cookie: session=evil to inject malicious cookies.", example: "A web mail system was hacked by sending forged cookies via URL parameters.", fix: "Sanitize and strip newline sequences from HTTP headers before output." },
      { name: "Log Injection", cwe: "CWE-117", owasp: "A09:2021", severity: "medium", what: "Writing user-provided newlines and log lines into system error output files.", exploit: "Forging authentication logs by writing fake server records.", example: "An attacker hid intrusion tracks by inserting forged system status events.", fix: "Strip newlines and escape control characters before logging any input." }
    ],
    "Authentication": [
      { name: "Broken Authentication Flow", cwe: "CWE-287", owasp: "A07:2021", severity: "high", what: "Incomplete login or verification checks, allowing authentication bypasses.", exploit: "Skipping authentication checks by tampering with client state parameters.", example: "A major car rental API leaked account bookings due to auth checks bypass.", fix: "Validate authentication states on the server for all requests." },
      { name: "Predictable Reset Tokens", cwe: "CWE-330", owasp: "A07:2021", severity: "high", what: "Using predictable algorithms to generate password reset tokens.", exploit: "Brute-forcing tokens generated via timestamp or simple Math.random().", example: "A forum app account takeover via guessable reset links.", fix: "Generate reset tokens using crypto.randomBytes and hash them in DB." },
      { name: "Missing Rate Limiting", cwe: "CWE-307", owasp: "A07:2021", severity: "high", what: "Allowing unlimited password validation attempts on auth endpoints.", exploit: "Brute-forcing admin credentials using dictionary attacks.", example: "Mass credential stuffing attacks targeting popular API login gateways.", fix: "Implement IP and account-based rate limiting on sensitive routes." },
      { name: "Credential Stuffing Exposure", cwe: "CWE-307", owasp: "A07:2021", severity: "medium", what: "Exposing authentication checks to automated dictionary queries without lockouts.", exploit: "Replaying leaked breach dumps to compromise user accounts.", example: "A bank portal credential stuffed, compromising thousands of user accounts.", fix: "Enforce multi-factor authentication (MFA) and lock accounts on high failure rates." },
      { name: "Weak Password Policy", cwe: "CWE-521", owasp: "A07:2021", severity: "medium", what: "Accepting highly common passwords or very short key lengths.", exploit: "Guessing simple credentials like 'password123' or '12345678'.", example: "Capital One compromise triggered by easily guessable employee credentials.", fix: "Validate passwords against a minimum length (e.g. 12+ chars) and leak lists." },
      { name: "Session Fixation", cwe: "CWE-384", owasp: "A07:2021", severity: "medium", what: "Keeping the same session identifier before and after a user logs in.", exploit: "Setting a victim's session ID, waiting for them to log in, and hijacking it.", example: "A banking system account takeover via shared link containing session IDs.", fix: "Regenerate session identifiers immediately upon user authentication." },
      { name: "Insecure Remember-Me", cwe: "CWE-539", owasp: "A07:2021", severity: "medium", what: "Storing sensitive authentication credentials in plain text remember-me cookies.", exploit: "Stealing cookie values from a shared computer to clone active sessions.", example: "A shopping cart site hijacked via decoding base64 remember-me strings.", fix: "Use cryptographically signed, random remember-me tokens with strict expiry." },
      { name: "OAuth Misconfiguration", cwe: "CWE-1021", owasp: "A07:2021", severity: "high", what: "Permissive redirect URI validation or authorization code leaks in OAuth.", exploit: "Changing redirect_uri parameters to steal oauth authorization codes.", example: "A social media platform account takeover via open redirect in login callback.", fix: "Enforce strict redirect URI white-lists on the identity provider." }
    ],
    "Access Control": [
      { name: "IDOR (Insecure Direct Object References)", cwe: "CWE-639", owasp: "A01:2021", severity: "high", what: "Exposing internal database IDs directly, allowing unauthorized records lookup.", exploit: "Changing /api/orders/123 to /api/orders/124 to view others' receipts.", example: "A ride-sharing app leaked trip histories by auto-incrementing route IDs.", fix: "Scope queries to the authenticated user or check authorization rules." },
      { name: "Missing Function-Level Auth", cwe: "CWE-862", owasp: "A01:2021", severity: "high", what: "Gating client UI routes while leaving backend endpoints public.", exploit: "Requesting /admin/delete-user` directly without admin group permissions.", example: "An e-commerce backend API leaked user catalogs to raw API calls.", fix: "Apply role verification middleware to every single admin route." },
      { name: "Mass Assignment", cwe: "CWE-915", owasp: "A08:2021", severity: "high", what: "Binding untrusted request payloads directly to database entity update models.", exploit: "Sending {\"role\": \"admin\"} in a profile update payload to self-elevate.", example: "GitHub repository takeovers due to mass assignment in model parameters.", fix: "White-list fields allowed for updates; avoid passing raw body objects." },
      { name: "Privilege Escalation", cwe: "CWE-269", owasp: "A01:2021", severity: "high", what: "Allowing a user to perform actions outside their assigned security tier.", exploit: "Manipulating parameters (e.g. role=admin) in cookies or requests.", example: "A cloud platform compromise via local privilege escalation in API endpoints.", fix: "Always fetch user roles directly from server DB; never trust client parameters." },
      { name: "Path-Based Access Bypass", cwe: "CWE-22", owasp: "A01:2021", severity: "high", what: "Using path traversal characters to access files outside the public web root.", exploit: "Calling /images/../../etc/passwd to view sensitive system setups.", example: "A file converter service exposed internal environment settings.", fix: "Validate that resolved file paths remain strictly inside the storage directory." },
      { name: "Missing RBAC", cwe: "CWE-862", owasp: "A01:2021", severity: "high", what: "Lack of Role-Based Access Control logic on server actions.", exploit: "Calling tenant APIs from an unrelated client account.", example: "A multi-tenant SaaS provider leaked user files to cross-tenant users.", fix: "Enforce object-level verification checking that the tenant owns the resource." },
      { name: "Forced Browsing", cwe: "CWE-425", owasp: "A01:2021", severity: "medium", what: "Accessing sensitive file paths by guessing unlinked URLs (e.g. /config.json).", exploit: "Enumerating hidden admin URL directories to locate unsecured panels.", example: "An online store leaked backup directories containing DB dumps.", fix: "Restrict access permissions for all assets and disable directory listings." }
    ],
    "Cryptography": [
      { name: "Weak Hashing Algorithms", cwe: "CWE-328", owasp: "A02:2021", severity: "high", what: "Using outdated hash functions (like MD5 or SHA-1) that are prone to collision attacks.", exploit: "Cracking password hashes quickly using precomputed rainbow tables.", example: "Leaked credentials cracked within seconds due to MD5 storage.", fix: "Use modern slow hashing algorithms like bcrypt or Argon2id." },
      { name: "ECB Mode Encryption", cwe: "CWE-327", owasp: "A02:2021", severity: "high", what: "Encrypting blocks independently, exposing patterns in the ciphertext.", exploit: "Analyzing patterns in encrypted images or cookies to map internal structure.", example: "Adobe database leaks cracked due to reuse of block keys.", fix: "Use secure cipher modes like CBC (with random IV) or GCM." },
      { name: "Static IV/Nonce Reuse", cwe: "CWE-329", owasp: "A02:2021", severity: "high", what: "Using the same Initialization Vector or Nonce across multiple encryption cycles.", exploit: "Reconstructing plaintext details by XORing ciphertexts encrypted with the same IV.", example: "A custom messaging app key stream compromise via static IV reuse.", fix: "Ensure a cryptographically secure, random IV is generated for every cipher run." },
      { name: "Insufficient Key Length", cwe: "CWE-326", owasp: "A02:2021", severity: "medium", what: "Using short RSA keys or symmetric keys that can be brute-forced.", exploit: "Factoring a 512-bit or 1024-bit RSA key using cloud resources.", example: "A legacy VPN gateway key cracked by factoring weak RSA keys.", fix: "Upgrade keys to modern minimums (RSA 2048+ bits, AES 256 bits)." },
      { name: "Insecure Key Storage", cwe: "CWE-320", owasp: "A02:2021", severity: "high", what: "Storing cryptographic keys inside application config files or repositories.", exploit: "Reading code files to extract decryption keys and decrypting database records.", example: "A healthcare provider leak occurred when keys were found in public S3 buckets.", fix: "Store keys in dedicated key vaults or environment variables." },
      { name: "Missing Certificate Validation", cwe: "CWE-295", owasp: "A07:2021", severity: "high", what: "Skipping hostname or signature validation during outbound HTTPS/TLS requests.", exploit: "Intercepting credentials and API payloads via a proxy (Man-in-the-Middle).", example: "A mobile banking app intercepted due to ignoring invalid TLS certs.", fix: "Never set rejectUnauthorized: false in production TLS requests." },
      { name: "Self-Signed Cert Acceptance", cwe: "CWE-295", owasp: "A07:2021", severity: "medium", what: "Allowing untrusted self-signed SSL/TLS certificates on production systems.", exploit: "Forging certificates to intercept private API communications.", example: "An internal telemetry service hijacked via self-signed spoofing.", fix: "Enforce connection validation against trusted, public Certificate Authorities." },
      { name: "Broken PRNG (Predictable Randomness)", cwe: "CWE-338", owasp: "A02:2021", severity: "medium", what: "Using insecure generators like Math.random() for sensitive tokens.", exploit: "Predicting future tokens or codes by analyzing seed state from prior samples.", example: "Predictable coupon codes farmed on an e-commerce site.", fix: "Use crypto.getRandomValues() or crypto.randomBytes() for security tokens." }
    ],
    "Session Management": [
      { name: "JWT Missing Expiry", cwe: "CWE-613", owasp: "A07:2021", severity: "medium", what: "Issuing JSON Web Tokens without an expiration claim (exp).", exploit: "Using stolen tokens indefinitely since they never expire.", example: "A compromise of user accounts via reuse of tokens leaked in 2024.", fix: "Always configure short expiration times (e.g. 15m) on access tokens." },
      { name: "JWT Weak Secret", cwe: "CWE-326", owasp: "A02:2021", severity: "high", what: "Signing JWT tokens with common or short strings.", exploit: "Brute-forcing the signing key offline and issuing arbitrary admin tokens.", example: "An API breached by signing tokens with the secret key 'secret'.", fix: "Use strong, randomly generated secrets (e.g. HS256 with 256+ bits)." },
      { name: "JWT None Algorithm", cwe: "CWE-347", owasp: "A02:2021", severity: "critical", what: "Accepting JWTs signed with the 'none' algorithm header.", exploit: "Modifying token payload and changing the alg header to 'none' to bypass signatures.", example: "A major SaaS login system bypassed due to JWT library vulnerabilities.", fix: "Enforce explicit signature validation and block 'none' in algorithm list." },
      { name: "Session Token Prediction", cwe: "CWE-340", owasp: "A07:2021", severity: "high", what: "Generating session IDs using predictable sequential algorithms.", exploit: "Incrementing cookie session numbers to log in as other users.", example: "An legacy web app breached by guessing sequential integer cookies.", fix: "Generate high-entropy session IDs using cryptographically secure random bytes." },
      { name: "Concurrent Session Limits", cwe: "CWE-770", owasp: "A04:2021", severity: "low", what: "Allowing an account to maintain infinite simultaneous sessions.", exploit: "Stealing session cookies and using them indefinitely alongside the active user.", example: "A corporate VPN allowed multiple concurrent logins from different continents.", fix: "Enforce maximum session counts and invalidate older sessions on login." },
      { name: "Missing Cookie Security Flags", cwe: "CWE-1004", owasp: "A05:2021", severity: "medium", what: "Failing to set HttpOnly, Secure, or SameSite attributes on sensitive cookies.", exploit: "Stealing session cookies via client-side XSS scripts or plain HTTP sniffing.", example: "Session cookies leaked over non-HTTPS links in public coffee shops.", fix: "Configure cookie middleware with httpOnly: true, secure: true, sameSite: 'lax'." },
      { name: "Session Fixation", cwe: "CWE-384", owasp: "A07:2021", severity: "medium", what: "Allowing session identifiers to persist across authentication boundaries.", exploit: "Fixing a session ID, sharing the link with a victim, and waiting for them to log in.", example: "A portal exposed accounts via sharing session IDs in landing page URLs.", fix: "Always rotate session identifiers upon login and logout." },
      { name: "Session Hijacking", cwe: "CWE-294", owasp: "A07:2021", severity: "high", what: "Stealing an active session token and replaying it to masquerade as the user.", exploit: "Sniffing session keys or stealing them via cross-site scripts.", example: "An administrative panel hijacked via stolen session keys.", fix: "Tie sessions to user fingerprint checks (IP changes, user-agent resets)." }
    ],
    "Configuration": [
      { name: "Debug Mode in Production", cwe: "CWE-489", owasp: "A05:2021", severity: "high", what: "Exposing diagnostic console logs or configuration panels on live websites.", exploit: "Accessing /debug to download env variables and DB structure details.", example: "An app leaked environment secrets due to debug mode left active.", fix: "Disable debug flags in production environments via config files." },
      { name: "Verbose Error Messages", cwe: "CWE-209", owasp: "A05:2021", severity: "medium", what: "Returning database exception strings or backend files stack traces to clients.", exploit: "Reading database table structure or directory setups from error logs.", example: "An online store leaked its SQL structure via 500 error messages.", fix: "Return generic, non-descriptive error responses; log details to server." },
      { name: "Missing Security Headers", cwe: "CWE-693", owasp: "A05:2021", severity: "medium", what: "Failing to send standard headers that restrict browser execution rules.", exploit: "Executing clickjacking or content-sniffing exploits due to absent headers.", example: "An API breached via iframe overlay framing due to missing X-Frame-Options.", fix: "Use helmet middleware to add headers like CSP, XFO, HSTS, and Content-Type-Options." },
      { name: "Insecure TLS/SSL Configuration", cwe: "CWE-326", owasp: "A02:2021", severity: "high", what: "Accepting outdated connection protocols (like SSLv3, TLS 1.0, or TLS 1.1) or weak ciphers.", exploit: "Decrypting network payloads via cryptographic protocol downgrade attacks.", example: "POODLE attack targeting legacy SSLv3 clients on corporate gateways.", fix: "Configure servers to restrict TLS connection ranges to TLS 1.2 and 1.3 only." },
      { name: "HTTP Instead of HTTPS", cwe: "CWE-319", owasp: "A02:2021", severity: "high", what: "Serving web routes or APIs over plain text HTTP connections.", exploit: "Sniffing usernames and session cookies on unencrypted Wi-Fi networks.", example: "A forum credentials exfiltrated due to sending forms over HTTP.", fix: "Redirect all HTTP traffic to HTTPS and set HTTP Strict Transport Security (HSTS)." },
      { name: "Exposed Admin Interfaces", cwe: "CWE-419", owasp: "A05:2021", severity: "high", what: "Mounting database portals or administrative panels on public routes.", exploit: "Brute-forcing root login fields on pages like /admin/db-login.", example: "A ransomware gang accessed databases via a public, unauthenticated admin panel.", fix: "Restrict admin portals to internal networks or require strong VPN/MFA." },
      { name: "Default Framework Configs", cwe: "CWE-1188", owasp: "A05:2021", severity: "medium", what: "Using default credentials or setup keys shipped with frameworks.", exploit: "Logging into database backends using defaults like admin/admin.", example: "A CMS site taken over using default configuration passwords.", fix: "Ensure all default framework parameters are overridden during install." },
      { name: "Unvalidated Environment Variables", cwe: "CWE-15", owasp: "A05:2021", severity: "low", what: "Relying on environment config values without testing type safety or bounds.", exploit: "Crashing services or altering logic by modifying system environment bounds.", example: "An application crashed due to invalid integer configuration inputs.", fix: "Validate system configurations on startup using structured validation libraries." },
      { name: "Docker Misconfigurations", cwe: "CWE-250", owasp: "A05:2021", severity: "medium", what: "Running container processes with administrative root user privileges.", exploit: "Escaping container boxes to access physical host operating systems.", example: "A container compromise escalated to root access on the physical server.", fix: "Enforce a non-root USER directive inside container Dockerfiles." }
    ],
    "Cross-Site Scripting": [
      { name: "Reflected XSS", cwe: "CWE-79", owasp: "A03:2021", severity: "high", what: "Reflecting untrusted URL parameters directly into web output templates.", exploit: "Sending a link containing <script> tags that execute on the victim's account.", example: "eBay accounts compromised via reflected script parameters in search pages.", fix: "HTML encode all output fields before rendering in client browsers." },
      { name: "Stored XSS", cwe: "CWE-79", owasp: "A03:2021", severity: "high", what: "Saving malicious scripts in databases and rendering them to other site users.", exploit: "Posting a comment containing script tags that hijack viewer sessions.", example: "MySpace Samy worm exploited stored scripting to infect millions of users.", fix: "Sanitize HTML markup using secure libraries like DOMPurify." },
      { name: "DOM-Based XSS", cwe: "CWE-79", owasp: "A03:2021", severity: "high", what: "Writing client-side JS inputs to unsafe sinks like innerHTML or eval.", exploit: "Tampering with URL fragments (hash strings) to trigger local code execution.", example: "A login dashboard hijacked via reading hash parameters into document.write.", fix: "Use safe DOM interfaces like textContent or element properties instead of innerHTML." },
      { name: "Insecure postMessage XSS", cwe: "CWE-345", owasp: "A08:2021", severity: "medium", what: "Receiving window message payloads without validating origin domains.", exploit: "Sending malicious script objects to listening frame elements.", example: "An embedded chat widget exploited to exfiltrate visitor cookie states.", fix: "Always verify the event origin matching allowed domains list." },
      { name: "SVG-Based XSS", cwe: "CWE-79", owasp: "A03:2021", severity: "high", what: "Rendering user-uploaded SVG files directly inside browser frame elements.", exploit: "Uploading an SVG image containing embedded Javascript inside XML elements.", example: "A portfolio platform compromised by users uploading script-embedded SVGs.", fix: "Sanitize SVGs or serve them with Content-Disposition attachment headers." },
      { name: "Client-Side Template Bypass", cwe: "CWE-79", owasp: "A03:2021", severity: "medium", what: "Mixing server-side data templates with client templates (e.g. Angular/Vue).", exploit: "Injecting client template syntax to bypass standard server escape filters.", example: "A landing page compromised via template expression injections.", fix: "Ensure client framework scopes are strictly separated from server markup." }
    ],
    "CSRF": [
      { name: "Missing CSRF Protection", cwe: "CWE-352", owasp: "A01:2021", severity: "high", what: "State-changing APIs accepting cookie-authenticated actions without token verification.", exploit: "Host a form that submits a POST request to update the victim's email address.", example: "A home router configuration reset via visitor loading a malicious image.", fix: "Enforce anti-CSRF tokens or set SameSite cookie rules for all POST/PUT routes." },
      { name: "Weak CSRF Token Validation", cwe: "CWE-352", owasp: "A01:2021", severity: "medium", what: "Comparing anti-CSRF token strings with static or user-owned values.", exploit: "Bypassing checks by supplying a valid token from a different user session.", example: "An API was bypassed by sending any matching CSRF header.", fix: "Bind CSRF tokens directly to the active session ID on the server." },
      { name: "CSRF Token Leakage", cwe: "CWE-352", owasp: "A01:2021", severity: "low", what: "Exposing anti-CSRF tokens inside HTTP GET URLs or client Referer headers.", exploit: "Stealing active tokens from web logs to execute authenticated actions.", example: "Third-party analytics tracked and recorded CSRF tokens in URLs.", fix: "Only transmit anti-CSRF tokens in secure cookies or custom request headers." },
      { name: "Double-Submit Cookie Bypass", cwe: "CWE-352", owasp: "A01:2021", severity: "medium", what: "Relying on matching cookie/header fields without server state verification.", exploit: "Spoofing cookies on subdomains to execute authenticated API actions.", example: "A subdomain compromise allowed spoofing cookies to override parent domain checks.", fix: "Sign CSRF cookies or verify matching tokens against session states." },
      { name: "SameSite Cookie Misconfiguration", cwe: "CWE-1004", owasp: "A05:2021", severity: "medium", what: "Omitting the SameSite flag, defaulting cookies to permissive browser rules.", exploit: "Executing cross-origin requests that automatically attach victim session cookies.", example: "A money transfer API compromised via cross-site form actions.", fix: "Explicitly set SameSite: 'Lax' or 'Strict' on all session cookies." },
      { name: "CSRF in API Endpoints", cwe: "CWE-352", owasp: "A01:2021", severity: "high", what: "Failing to validate anti-forgery tokens on JSON REST/GraphQL endpoints.", exploit: "Using simple HTML forms with text/plain encoding to bypass simple CORS checks.", example: "A cloud platform configuration updated via cross-origin API form posts.", fix: "Enforce custom headers (like X-Requested-With) or tokens on all API methods." },
      { name: "Login CSRF", cwe: "CWE-352", owasp: "A01:2021", severity: "medium", what: "Omitting anti-forgery validation checks during sign-in transactions.", exploit: "Logging a victim into an attacker-owned account to record their searches.", example: "A search engine leaked user histories by logging them into tracking profiles.", fix: "Apply anti-CSRF token verification to all login forms." },
      { name: "Logout CSRF", cwe: "CWE-352", owasp: "A01:2021", severity: "low", what: "Failing to secure session termination endpoints against cross-site requests.", exploit: "Sending image requests that log users out of their dashboards.", example: "An online test site logged students out during exams via cross-site requests.", fix: "Require POST requests with valid anti-CSRF tokens to trigger logout." }
    ],
    "SSRF": [
      { name: "Basic SSRF", cwe: "CWE-918", owasp: "A10:2021", severity: "high", what: "Allowing users to specify arbitrary URLs for server-side fetches.", exploit: "Sending internal database URLs to retrieve confidential records.", example: "Capital One breach (2019) utilized SSRF to steal AWS access tokens.", fix: "Allow-list upstream endpoints and validate input hosts." },
      { name: "Blind SSRF", cwe: "CWE-918", owasp: "A10:2021", severity: "medium", what: "Triggering outbound server requests without returning payloads to clients.", exploit: "Mapping internal network infrastructure via timing analysis.", example: "An internal network scanned via blind SSRF in webhooks.", fix: "Configure firewalls to isolate server outbound calls." },
      { name: "SSRF via DNS Rebinding", cwe: "CWE-918", owasp: "A10:2021", severity: "high", what: "Resolving hostnames during checks, then fetching from changed IPs.", exploit: "Providing DNS queries that resolve to public IPs first, then to 127.0.0.1.", example: "An internal console breached via DNS rebinding on local ports.", fix: "Resolve domains once and enforce connections to that specific IP." },
      { name: "SSRF via Cloud Metadata Endpoint", cwe: "CWE-918", owasp: "A10:2021", severity: "critical", what: "Allowing servers to fetch cloud metadata hosts (e.g. 169.254.169.254).", exploit: "Requesting metadata paths to extract AWS/GCP IAM credentials.", example: "An app server exfiltrated cloud admin keys via proxy URLs.", fix: "Block outbound requests to link-local and cloud metadata addresses." },
      { name: "SSRF via IP Sanitization Bypass", cwe: "CWE-918", owasp: "A10:2021", severity: "high", what: "Using alternate IP encodings (octal, hex, dword) to bypass regex rules.", exploit: "Sending http://0177.0.0.1 to access local system services.", example: "An IP filter bypassed by feeding decimal values like 2130706433.", fix: "Normalize URLs and resolve IP addresses before verification checks." },
      { name: "SSRF via Redirects", cwe: "CWE-918", owasp: "A10:2021", severity: "high", what: "Following HTTP redirects without re-validating destination URLs.", exploit: "Redirecting white-listed server calls to internal databases.", example: "A profile scanner redirected to fetch server configuration files.", fix: "Verify redirection target addresses before initiating connections." },
      { name: "Out-of-Band SSRF", cwe: "CWE-918", owasp: "A10:2021", severity: "medium", what: "Inducing outbound traffic to extract metadata through side-channel requests.", exploit: "Injecting lookup domains inside HTTP request parameters.", example: "An XML processor triggered DNS requests to lookup hosts.", fix: "Disable external network queries inside parsing libraries." },
      { name: "SSRF via Image Proxy", cwe: "CWE-918", owasp: "A10:2021", severity: "high", what: "Proxying user-provided image links without host validation.", exploit: "Requesting administrative dashboard URLs inside image source fields.", example: "A markdown editor proxy used to scan port states.", fix: "Restrict proxy connections to verified image content domains." }
    ],
    "File Handling": [
      { name: "Path Traversal", cwe: "CWE-22", owasp: "A01:2021", severity: "high", what: "Using file path directories modifiers (../) to access local folders.", exploit: "Requesting ../../etc/passwd inside file download parameters.", example: "A router interface leaked configuration databases via path traversal.", fix: "Use path.resolve and check that target path starts with sandbox directory." },
      { name: "File Upload Without Type Validation", cwe: "CWE-434", owasp: "A04:2021", severity: "high", what: "Accepting uploads without verifying file extensions or MIME types.", exploit: "Uploading a .php web shell to gain interactive remote command access.", example: "A corporate site hacked via uploading script scripts to image paths.", fix: "Validate file types against a strict whitelist; do not trust client MIME headings." },
      { name: "Zip Slip", cwe: "CWE-22", owasp: "A01:2021", severity: "high", what: "Extracting archive files containing paths with directory traversal sequences.", exploit: "Uploading a zip containing files named ../../shell.js to overwrite files.", example: "A build service compromised via extracting malicious zip directories.", fix: "Verify target folder boundaries for all unpacked archive paths." },
      { name: "Insecure File Storage Paths", cwe: "CWE-22", owasp: "A01:2021", severity: "medium", what: "Saving uploaded files inside public web server access roots.", exploit: "Uploading executable scripts and requesting them directly via browser link.", example: "An app server compromised by execution of scripts uploaded to web paths.", fix: "Save uploads outside the web access folder and serve them dynamically." },
      { name: "World-Readable Permissions", cwe: "CWE-732", owasp: "A05:2021", severity: "medium", what: "Creating sensitive files with permissive access configurations (e.g. chmod 777).", exploit: "Other users on the system reading database secrets or logs.", example: "An app key exfiltrated due to world-readable log folder setups.", fix: "Apply least-privilege permission masks (e.g. 0600) to sensitive assets." },
      { name: "Backup Files in Web Root", cwe: "CWE-530", owasp: "A05:2021", severity: "medium", what: "Leaving backup archives or configuration text files inside public directories.", exploit: "Downloading backup.zip or .env to extract application secrets.", example: "An online store database leaked due to exposed backup files.", fix: "Ensure backup routines save files outside web root folders." },
      { name: "Arbitrary File Deletion", cwe: "CWE-22", owasp: "A01:2021", severity: "high", what: "Allowing users to delete arbitrary paths via unsanitized file keys.", exploit: "Sending path traversal parameters to delete server config files.", example: "A blog platform crashed by deleting local application index files.", fix: "Map file parameters to database entries instead of passing paths directly." },
      { name: "Unrestricted File Size Upload", cwe: "CWE-434", owasp: "A04:2021", severity: "medium", what: "Allowing users to upload files of unlimited size to server storage.", exploit: "Uploading gigabytes of data to exhaust disk space and crash servers.", example: "A profile image upload endpoint abused to trigger server OOM crash.", fix: "Configure upload libraries to limit request payload sizes (e.g. max 5MB)." },
      { name: "Local File Inclusion", cwe: "CWE-22", owasp: "A01:2021", severity: "high", what: "Passing unvalidated file parameters to local require or include functions.", exploit: "Requesting system paths to trigger execution of local configuration logs.", example: "A template loader was abused to execute arbitrary internal configs.", fix: "Use static path map arrays instead of building path variables from inputs." }
    ],
    "Information Disclosure": [
      { name: "Stack Traces Exposed", cwe: "CWE-209", owasp: "A05:2021", severity: "medium", what: "Leaking internal framework call stack traces inside HTTP responses.", exploit: "Reading trace logs to find database query fragments or server directories.", example: "A major travel site exposed internal server paths via error stacks.", fix: "Log detailed traces to backend server files; return generic messages to users." },
      { name: "Sensitive Data in Logs", cwe: "CWE-532", owasp: "A09:2021", severity: "medium", what: "Logging raw user passwords, keys, or private profile information in text files.", exploit: "Reading log files to steal credentials and compromise customer accounts.", example: "Twitter leaked millions of passwords due to plain text logging in 2018.", fix: "Filter and redact known sensitive keys before writing events to log files." },
      { name: "Inconsistent Error Responses", cwe: "CWE-209", owasp: "A05:2021", severity: "low", what: "Different server errors for different input validity states.", exploit: "Brute-forcing user list by matching 'password wrong' vs 'username wrong'.", example: "Credential enumeration on login page via specific error templates.", fix: "Return uniform responses for both username and password mismatches." },
      { name: "Error Codes Revealing Architecture", cwe: "CWE-209", owasp: "A05:2021", severity: "low", what: "Leaking library names or database types (e.g. Postgres vs MySQL) in response codes.", exploit: "Mapping database cve history based on explicit error strings.", example: "SQL syntax details leaked in API response allowed target profiling.", fix: "Map internal errors to clean, abstract API codes." },
      { name: "Directory Indexing Enabled", cwe: "CWE-548", owasp: "A05:2021", severity: "low", what: "Server displaying lists of files inside directory folders.", exploit: "Browsing file systems to discover unlinked assets or source backups.", example: "A developer portal leaked source zip archives via directory indexes.", fix: "Disable indexing features inside web server configurations." },
      { name: "Version Disclosure (X-Powered-By)", cwe: "CWE-200", owasp: "A05:2021", severity: "low", what: "Sending detailed software version headers (e.g. Express, Apache) in responses.", exploit: "Using targeted exploits matching the active library version.", example: "A server compromised via a known PHP exploit after sending version headers.", fix: "Disable headers like X-Powered-By and Server." },
      { name: "Metadata Leakage in Files", cwe: "CWE-200", owasp: "A05:2021", severity: "low", what: "Exposing author tags, edit locations, or creation software in uploaded files.", exploit: "Reading image EXIF blocks to trace creator GPS coordinates.", example: "An activist compromised due to GPS metadata in uploaded document files.", fix: "Strip EXIF and document attributes before saving file uploads." },
      { name: "Exposed Git Repository", cwe: "CWE-538", owasp: "A05:2021", severity: "high", what: "Leaving the .git metadata directory accessible in public web folders.", exploit: "Reconstructing full application source code by downloading Git index files.", example: "A government site leaked its backend system source via exposed .git paths.", fix: "Restrict access permissions for hidden files and folders." }
    ],
    "Validation": [
      { name: "Missing Input Validation", cwe: "CWE-20", owasp: "A03:2021", severity: "medium", what: "Processing parameters without checking types, formats, or bounds.", exploit: "Submitting negative amounts to increment account credit balances.", example: "A DeFi app compromised by passing zero or negative currency limits.", fix: "Enforce strict schema validation rules using libraries like Zod." },
      { name: "Regular Expression DoS (ReDoS)", cwe: "CWE-1333", owasp: "A05:2021", severity: "medium", what: "Using poorly designed regular expressions that trigger catastrophic backtracking.", exploit: "Sending long strings that lock up CPU execution loops indefinitely.", example: "Cloudflare offline (2019) due to one bad regular expression backtrack.", fix: "Use safe regex engines or validate string lengths before running match checks." },
      { name: "Integer Overflow/Underflow", cwe: "CWE-190", owasp: "A03:2021", severity: "medium", what: "Math operations exceeding variable bit limits, resetting values.", exploit: "Sending huge counts to bypass checks, causing transaction value flips.", example: "The Ariane 5 rocket exploded due to a 64-bit to 16-bit integer overflow.", fix: "Use safe math libraries or execute checks on size boundaries." },
      { name: "Type Confusion", cwe: "CWE-843", owasp: "A03:2021", severity: "medium", what: "Processing variables as different formats than expected (e.g. object vs string).", exploit: "Passing array arguments to string matching functions to bypass validation.", example: "An authentication check bypassed via array parameter tampering.", fix: "Explicitly validate and cast incoming data types before processing." },
      { name: "Mass Assignment Validation", cwe: "CWE-915", owasp: "A08:2021", severity: "high", what: "Accepting model fields directly without filtering updates.", exploit: "Modifying profile settings to set system permissions fields.", example: "A REST service allowed database updates via unvalidated POST fields.", fix: "Pick only allowed update properties from incoming objects." },
      { name: "Open Redirect", cwe: "CWE-601", owasp: "A01:2021", severity: "medium", what: "Redirecting users to unvalidated external links based on URL query inputs.", exploit: "Crafting phishing links bouncing through trusted domain names.", example: "Users redirected to replica login sites via open redirects on trusted portals.", fix: "Only redirect to relative URLs starting with a single slash (/)." },
      { name: "SQL String Interpolation", cwe: "CWE-89", owasp: "A03:2021", severity: "high", what: "Concatenating user inputs into SQL strings rather than using query parameters.", exploit: "Altering query statements to bypass access controls.", example: "An administrative panel bypassed due to string concatenation.", fix: "Enforce parameterized bindings for all dynamic queries." },
      { name: "Unsafe Deserialization Validation", cwe: "CWE-502", owasp: "A08:2021", severity: "high", what: "Deserializing user data without checking data schema shapes.", exploit: "Passing customized payloads to execute code during initialization.", example: "Node.js apps compromised via deserialization of unsafe JSON formats.", fix: "Validate serialized data structures before processing them." }
    ],
    "Secrets & Credentials": [
      { name: "Hardcoded API Keys", cwe: "CWE-798", owasp: "A05:2021", severity: "critical", what: "Committing active API connection keys inside application files.", exploit: "Extracting credentials from source repositories to access third-party integrations.", example: "Stripe key leaks resulting in thousands of dollars of refund fraud.", fix: "Load secrets from environment variables and rotate compromised keys." },
      { name: "Hardcoded Passwords or Tokens", cwe: "CWE-798", owasp: "A07:2021", severity: "critical", what: "Saving database passwords or access tokens directly in source.", exploit: "Connecting directly to database hosts using committed login keys.", example: "A corporate repository leak exposed main system DB credentials.", fix: "Manage secrets using dedicated vault managers or container configurations." },
      { name: "Private Keys in Source", cwe: "CWE-321", owasp: "A02:2021", severity: "critical", what: "Committing private decryption keys (like SSH or JWT signing keys) to repository files.", exploit: "Signing administrative tokens offline to access system APIs.", example: "A software provider compromised due to exposed JWT private keys.", fix: "Keep private keys in environment stores or secure vaults." },
      { name: "Exposed DB Connection Strings", cwe: "CWE-200", owasp: "A05:2021", severity: "high", what: "Exposing database logins in configuration templates.", exploit: "Connecting directly to database instances exposed on public ports.", example: "MongoDB instances exfiltrated due to committed login paths.", fix: "Inject connection strings at runtime; avoid committing configs." },
      { name: "Secrets in Committed Env Files", cwe: "CWE-538", owasp: "A05:2021", severity: "high", what: "Committing .env configuration files into repository history.", exploit: "Downloading repository history to extract committed production secrets.", example: "A public repository exposure leaked secret configs inside .env.", fix: "Add .env to .gitignore and use environment injectors." },
      { name: "Cloud Credentials in Source", cwe: "CWE-798", owasp: "A05:2021", severity: "critical", what: "Saving cloud provider IAM keys inside configuration files.", exploit: "Using keys to provision cloud resources and access private data buckets.", example: "AWS keys leaked on GitHub utilized to mine cryptocurrency.", fix: "Enforce cloud identity roles (IAM profiles) instead of static keys." }
    ],
    "Deserialization": [
      { name: "Insecure Object Deserialization", cwe: "CWE-502", owasp: "A08:2021", severity: "critical", what: "Parsing untrusted serialized streams to rebuild programming objects.", exploit: "Crafting serialized payloads to trigger helper methods that run system code.", example: "Java deserialization flaws used to compromise major enterprise middleware.", fix: "Avoid serializing code object structures; use simple JSON or Protocol Buffers." },
      { name: "Untrusted Data Deserialization", cwe: "CWE-502", owasp: "A08:2021", severity: "high", what: "Accepting serialized data from untrusted clients without authentication.", exploit: "Manipulating serialized streams to modify private properties.", example: "A gaming portal compromised via tampered serialized game saves.", fix: "Sign and encrypt serialized data inputs before processing." },
      { name: "Missing Type Validation", cwe: "CWE-502", owasp: "A08:2021", severity: "high", what: "Restoring serialized strings without validating final class type targets.", exploit: "Instantiating arbitrary class objects to bypass safety checks.", example: "An API breached by instantiating internal execution classes.", fix: "Verify type schemas before instantiating objects." },
      { name: "YAML/XML Deserialization Attacks", cwe: "CWE-502", owasp: "A08:2021", severity: "high", what: "Using YAML or XML parsers configured to instantiate arbitrary code paths.", exploit: "Sending YAML strings like !!js/function to trigger code execution.", example: "Node.js js-yaml library exploited to execute arbitrary shell scripts.", fix: "Use safe parsing flags (e.g. yaml.safeLoad) to restrict execution." },
      { name: "JSON Deserialization Vulnerability", cwe: "CWE-20", owasp: "A08:2021", severity: "medium", what: "Parsing JSON strings directly to object models without schema validation.", exploit: "Adding prototype settings or overriding model functions.", example: "An administrative panel bypassed via schema injection in REST inputs.", fix: "Validate JSON objects against predefined type definitions." },
      { name: "Pickle with User-Supplied Data", cwe: "CWE-502", owasp: "A08:2021", severity: "critical", what: "Using Python's pickle library to load untrusted data streams.", exploit: "Using the __reduce__ method inside pickle files to execute commands.", example: "An AI model hub compromised via malicious pickle model files.", fix: "Use safer data formats like safetensors or json." },
      { name: "PHP unserialize on User Input", cwe: "CWE-502", owasp: "A08:2021", severity: "critical", what: "Passing untrusted user input directly to PHP's unserialize parser.", exploit: "Triggering object injection chains using magic functions.", example: "A vBulletin forum compromised via serialized input parameters.", fix: "Avoid serialize/unserialize; use json_encode/json_decode." },
      { name: "Missing Integrity Check on Serialized Data", cwe: "CWE-345", owasp: "A08:2021", severity: "high", what: "Processing serialized objects without verify signatures.", exploit: "Altering session data payloads and re-encrypting with defaults.", example: "A shopping cart cookie edited to set purchase price values.", fix: "Apply HMAC signatures to all serialized session cookies." }
    ],
    "Business Logic": [
      { name: "Race Condition", cwe: "CWE-362", owasp: "A04:2021", severity: "high", what: "Executing check-then-act logic without thread or transaction locks.", exploit: "Submitting simultaneous withdrawal requests to double-spend balances.", example: "An online wallet drained via sending multiple withdrawal posts in parallel.", fix: "Enforce database transaction locks or atomic operations." },
      { name: "Time-of-Check Time-of-Use", cwe: "CWE-367", owasp: "A04:2021", severity: "high", what: "Validating conditions and then assuming they hold true later.", exploit: "Replacing validated files with symlinks before file system write runs.", example: "A file printer service manipulated to overwrite system records.", fix: "Verify states and execute actions atomically within safe boundaries." },
      { name: "Insufficient Workflow Validation", cwe: "CWE-841", owasp: "A04:2021", severity: "medium", what: "Allowing users to execute steps in multi-stage actions out of order.", exploit: "Calling payment-complete routes directly before confirming orders.", example: "A checkout portal bypassed by calling final success endpoints.", fix: "Validate workflow state flags on the server before updating data." },
      { name: "Price/Quantity Manipulation", cwe: "CWE-840", owasp: "A04:2021", severity: "high", what: "Trusting client-supplied price or quantity parameters in checkout payloads.", exploit: "Sending negative quantity values to subtract price sums from totals.", example: "A web store compromised via sending custom negative checkout variables.", fix: "Recalculate pricing solely on the server side using database prices." },
      { name: "Insecure State Management", cwe: "CWE-642", owasp: "A04:2021", severity: "medium", what: "Saving business flags inside client cookies or hidden inputs.", exploit: "Modifying coupon-count variables to get unlimited cart discounts.", example: "A booking portal bypassed by modifying parameters in browser cookies.", fix: "Maintain session states strictly on server databases." },
      { name: "Missing Transaction Atomicity", cwe: "CWE-362", owasp: "A04:2021", severity: "medium", what: "Updating related database records without wrapping in transactional locks.", exploit: "Crashing the app mid-transaction to leave databases in corrupted states.", example: "A ledger system balance mismatched due to partial transaction failures.", fix: "Use database transaction blocks (e.g. BEGIN/COMMIT) for related updates." },
      { name: "Predictable Resource IDs", cwe: "CWE-340", owasp: "A01:2021", severity: "medium", what: "Generating sequential integer identifiers for private resources.", exploit: "Iterating resource numbers to download other customer files.", example: "An invoice portal leaked files by incrementing URL integer IDs.", fix: "Generate high-entropy resource keys like UUID v4." },
      { name: "Forced Browsing Flow", cwe: "CWE-425", owasp: "A01:2021", severity: "medium", what: "Accessing intermediate check screens directly by typing links.", exploit: "Bypassing payment pages by jumping directly to receipt screens.", example: "An onboarding site bypassed by skipping verification URL stages.", fix: "Enforce server-side workflow steps checks." }
    ],
    "API Security": [
      { name: "Missing Rate Limiting", cwe: "CWE-770", owasp: "A04:2021", severity: "medium", what: "Exposing public API routes without bounding transaction rates.", exploit: "Flooding endpoints with search scripts to exhaust resource capacities.", example: "An API server knocked offline due to infinite loop queries.", fix: "Implement rate-limit middleware on all public endpoints." },
      { name: "Broken Object-Level Authorization", cwe: "CWE-639", owasp: "A01:2021", severity: "high", what: "Retrieving records using client inputs without checking ownership.", exploit: "Sending another client's card ID to charge purchases to their account.", example: "A fintech portal leaked statements due to missing checks.", fix: "Scope database fetches to the verified session account." },
      { name: "Excessive Data Exposure", cwe: "CWE-213", owasp: "A03:2021", severity: "medium", what: "Returning full database records to clients, relying on UI filters.", exploit: "Inspecting raw network responses to view passwords or addresses.", example: "A profile page returned password hashes in background JSON payloads.", fix: "Use data transfer objects (DTOs) or pick only required fields." },
      { name: "Missing API Versioning Security", cwe: "CWE-1059", owasp: "A04:2021", severity: "low", what: "Maintaining legacy unpatched API versions alongside updated endpoints.", exploit: "Accessing /api/v1 to execute queries blocked on /api/v2.", example: "An authentication bypass exploit re-enabled by calling legacy paths.", fix: "Completely disable and decommission deprecated API pathways." },
      { name: "Missing Endpoint Authentication", cwe: "CWE-306", owasp: "A07:2021", severity: "high", what: "Leaving new or legacy routes open without auth middleware gates.", exploit: "Calling database sync endpoints directly without tokens.", example: "A dashboard leaked due to developers forgetting to mount auth checkers.", fix: "Enforce authentication validation by default for all API routes." },
      { name: "CORS Misconfiguration in API", cwe: "CWE-942", owasp: "A05:2021", severity: "high", what: "Reflecting any Origin request header and enabling credentials.", exploit: "Reading target API responses from arbitrary cross-origin sites.", example: "A banking API exposed credentials to malicious external websites.", fix: "Configure CORS to white-list only explicitly trusted domain names." },
      { name: "GraphQL Introspection in Production", cwe: "CWE-200", owasp: "A05:2021", severity: "medium", what: "Leaving schema inspection queries enabled on production servers.", exploit: "Downloading full API maps and schema structures using query engines.", example: "An attacker mapped private API fields via automated queries.", fix: "Disable introspection flags in production server builds." },
      { name: "REST Verb Tampering", cwe: "CWE-650", owasp: "A01:2021", severity: "medium", what: "Applying checks to specific HTTP methods while leaving others open.", exploit: "Calling POST instead of GET to bypass path auth checkers.", example: "A router bypass achieved by sending custom HTTP verbs.", fix: "Apply authentication checks globally to routes, regardless of verb." },
      { name: "Insecure API Key Transmission", cwe: "CWE-319", owasp: "A02:2021", severity: "high", what: "Passing authorization credentials inside URL query parameters.", exploit: "Reading access keys from server routing logs or proxy setups.", example: "Third-party trackers recorded API tokens from browser links.", fix: "Pass credentials inside HTTP Authorization request headers." },
      { name: "Missing Request Size Limits", cwe: "CWE-770", owasp: "A04:2021", severity: "medium", what: "Processing huge API request payloads without size limitations.", exploit: "Sending megabytes of JSON text to lock parser CPU loops.", example: "A NodeJS server crashed due to JSON body parsing overflows.", fix: "Set strict body parsing size limits on request handlers." }
    ],
    "Dependencies": [
      { name: "Known Vulnerable Packages (CVE)", cwe: "CWE-1035", owasp: "A06:2021", severity: "high", what: "Using dependencies containing public security vulnerabilities.", exploit: "Running exploit scripts targeting outdated package routines.", example: "Equifax breach (2017) occurred via known Apache Struts CVEs.", fix: "Run npm audit regularly and update vulnerable packages." },
      { name: "Outdated Dependencies", cwe: "CWE-1104", owasp: "A06:2021", severity: "medium", what: "Running software with components that are multiple major versions behind.", exploit: "Leveraging unpatched bugs that are resolved in newer builds.", example: "A legacy library caused memory leaks and connection failures.", fix: "Schedule monthly checks to update outdated dependency suites." },
      { name: "Unpinned Versions", cwe: "CWE-1104", owasp: "A06:2021", severity: "medium", what: "Using wildcards in package files, allowing arbitrary updates.", exploit: "Insecure packages automatically installing on production deployments.", example: "A malicious sub-dependency hijacked during routine rebuilds.", fix: "Enforce exact version pins and commit package lockfiles." },
      { name: "Typosquatting-Prone Imports", cwe: "CWE-427", owasp: "A06:2021", severity: "medium", what: "Importing packages with names spelling-similar to common utilities.", exploit: "Executing malicious setup scripts shipped inside typosquatted packages.", example: "Malware spread via packages named 'lodaash' or 'reqeusts'.", fix: "Carefully inspect import names during library installations." },
      { name: "Abandoned Packages", cwe: "CWE-1104", owasp: "A06:2021", severity: "low", what: "Relying on libraries that are no longer maintained or supported.", exploit: "Security vulnerabilities remaining unpatched indefinitely.", example: "An abandoned parser library left an API open to denial of service.", fix: "Replace abandoned libraries with active, modern alternatives." },
      { name: "Dev Dependencies in Production", cwe: "CWE-1104", owasp: "A06:2021", severity: "low", what: "Bundling diagnostic test packages inside production environments.", exploit: "Leveraging dev utilities to run test operations on live servers.", example: "Testing scripts exploited to run arbitrary shell diagnostics.", fix: "Install modules using the --production flag." },
      { name: "Malicious Package Patterns", cwe: "CWE-506", owasp: "A06:2021", severity: "high", what: "Importing packages containing backdoor scripts or logic.", exploit: "The module exfiltrating environment variables to remote servers.", example: "The ua-parser-js hijack exfiltrated server variables in 2021.", fix: "Use lockfile monitors and lock down outbound container networking." }
    ],
    "Logging & Monitoring": [
      { name: "PII Logged in Plaintext", cwe: "CWE-532", owasp: "A09:2021", severity: "medium", what: "Logging names, addresses, or private parameters in clear text logs.", exploit: "Reading server logs to extract personal customer data.", example: "A chat app recorded passenger coordinates in plain text files.", fix: "Filter and redact PII tokens before sending data to logger tools." },
      { name: "Missing Audit Logs", cwe: "CWE-778", owasp: "A09:2021", severity: "medium", what: "Failing to log sensitive administrative actions (e.g. password modifications).", exploit: "Modifying security setups without leaving diagnostic logs.", example: "An attacker altered security groups without leaving any audit trace.", fix: "Write structured audit events for all critical database modifications." },
      { name: "Log Forging/Injection", cwe: "CWE-117", owasp: "A09:2021", severity: "medium", what: "Allowing users to write newline characters into application log files.", exploit: "Writing fake entries like '[SUCCESS] User authenticated' to hide attacks.", example: "An attacker forged server reports to mask bulk data queries.", fix: "Sanitize newlines and escape control inputs prior to logging." },
      { name: "Excessive User Behavior Logging", cwe: "CWE-532", owasp: "A09:2021", severity: "low", what: "Logging every keystroke or click to server logs, risking PII leaks.", exploit: "Reading system logs to extract typed credit card details.", example: "An analytics service recorded card CVVs inside web console traces.", fix: "Only record high-level application events; exclude user input text." },
      { name: "Insufficient Logging & Monitoring", cwe: "CWE-778", owasp: "A09:2021", severity: "medium", what: "Failing to log failed auth attempts or check access patterns.", exploit: "Running dictionary attacks over weeks without triggering security alerts.", example: "A database exfiltrated over months due to lack of detection alerts.", fix: "Configure alerts for high rates of login failures or anomalies." },
      { name: "Insecure Log Storage Permissions", cwe: "CWE-732", owasp: "A05:2021", severity: "medium", what: "Exposing diagnostic log folders to world-readable permissions.", exploit: "Other local processes reading application secrets from logs.", example: "A local user read credentials from public log directories.", fix: "Restrict log storage folder permissions to application user groups only." }
    ],
    "Denial of Service": [
      { name: "Regular Expression DoS (ReDoS)", cwe: "CWE-1333", owasp: "A05:2021", severity: "medium", what: "Triggering regex backtracking loops to exhaust CPU capacities.", exploit: "Sending input strings that take minutes to evaluate, locking CPU cores.", example: "Cloudflare outages triggered by single nested backtracking patterns.", fix: "Validate input lengths and use non-backtracking regex engines." },
      { name: "Uncontrolled Resource Consumption", cwe: "CWE-400", owasp: "A04:2021", severity: "high", what: "Failing to bound file allocations or database transaction pools.", exploit: "Exhausting database connections to lock out legitimate users.", example: "An API server locked up due to infinite database connection requests.", fix: "Configure connection pools and request timeout limits." },
      { name: "DoS via Large Payload", cwe: "CWE-400", owasp: "A04:2021", severity: "high", what: "Parsing massive request bodies without size limits, causing OOM.", exploit: "Sending 50MB of JSON nested structures to crash Node.js runtimes.", example: "An application crashed due to JSON parser memory exhaustion.", fix: "Enforce body size limits in parsing middleware configurations." },
      { name: "Missing Timeout on External Calls", cwe: "CWE-1088", owasp: "A04:2021", severity: "medium", what: "Calling third-party APIs without configuring timeout boundaries.", exploit: "Hanging server connections indefinitely by slowing down response rates.", example: "An API server stalled because an external gateway went offline.", fix: "Configure reasonable connection and request timeouts (e.g. 5s)." },
      { name: "Algorithmic Complexity Attacks", cwe: "CWE-400", owasp: "A04:2021", severity: "medium", what: "Triggering worst-case performance bounds in hashing or search algorithms.", exploit: "Sending key collisions to lock up hashing dictionaries.", example: "A hash collision attack crashed web servers via POST inputs.", fix: "Use randomize hashing seeds or limit maximum map sizes." },
      { name: "Asymmetric Connection Exhaustion", cwe: "CWE-400", owasp: "A04:2021", severity: "high", what: "Allowing clients to hold connections open indefinitely with minimal traffic.", exploit: "Opening thousands of connections using Slowloris tools to lock ports.", example: "A server knocked offline by minimal bandwidth connection holds.", fix: "Enforce request headers timeouts and keep-alive limits." }
    ],
    "Code Hygiene": [
      { name: "TODO/FIXME Security Markers", cwe: "CWE-546", owasp: "A04:2021", severity: "low", what: "Leaving security notes like 'TODO: authorize this' in source code.", exploit: "Grep-searching repository history to locate unfinished check paths.", example: "A researcher found a login bypass by searching for 'TODO: fix auth'.", fix: "Track issues inside bug trackers; remove security notes from code." },
      { name: "Overly Broad Exception Catching", cwe: "CWE-396", owasp: "A04:2021", severity: "low", what: "Using try/catch statements that capture and ignore all errors.", exploit: "Triggering unexpected crashes that bypass subsequent security logic.", example: "An application allowed execution after bypassing db checks via try/catch.", fix: "Enforce specific error assertions; log unhandled failures." },
      { name: "Unhandled Promise Rejections", cwe: "CWE-755", owasp: "A04:2021", severity: "low", what: "Failing to attach catch blocks to asynchronous calls.", exploit: "Crashing Node.js server processes by triggering async errors.", example: "A server crashed during load because db failures had no catch blocks.", fix: "Attach catch handlers to all promises or configure global exception loggers." },
      { name: "Dead Code / Unused Functions", cwe: "CWE-561", owasp: "A06:2021", severity: "low", what: "Maintaining unused or deprecated functions in source code.", exploit: "Discovering legacy entry points that skip modern middleware checks.", example: "An attacker bypassed authentication via calling an old unused test method.", fix: "Regularly audit and clean up dead code branches using linters." },
      { name: "Deprecated API Usage", cwe: "CWE-1104", owasp: "A06:2021", severity: "low", what: "Relying on deprecated methods that have known security flaws.", exploit: "Exploiting security bugs in old APIs that are no longer patched.", example: "An API breached by relying on deprecated MD5 hash methods.", fix: "Update systems to leverage modern, secure library alternatives." },
      { name: "Unsafe Direct Eval Calls", cwe: "CWE-95", owasp: "A03:2021", severity: "critical", what: "Using the eval function to parse JSON or run code fragments.", exploit: "Injecting shell scripts inside evaluated strings.", example: "A site hacked via parsing server JSON inputs using eval.", fix: "Use JSON.parse or secure expression builders." },
      { name: "Hardcoded IP Addresses", cwe: "CWE-540", owasp: "A05:2021", severity: "low", what: "Configuring server IPs directly inside codebase files.", exploit: "Hijacking traffic by claiming old, unallocated server IP ranges.", example: "A service connection hijacked when an IP was reallocated.", fix: "Use DNS names and load addresses from configuration files." }
    ],
    "Optimization": [
      { name: "Performance", cwe: "—", owasp: "—", severity: "info", what: "Code that does more work, more often, or more slowly than needed — hot loops, N+1 queries, blocking I/O on a request path, unbounded allocations.", exploit: "Correct-but-slow code passes tests, then degrades under real data volume and concurrency; a 50ms inefficiency on a hot path becomes seconds of tail latency at scale.", example: "An endpoint issuing one query per row (N+1) timed out once production data grew past a few thousand rows.", fix: "Profile first, then batch or cache repeated work, replace N+1 with a join/prefetch, move blocking work off the request path, and re-measure." },
      { name: "Code Quality", cwe: "—", owasp: "—", severity: "info", what: "Maintainability risks — duplication, dead code, overly complex functions, unclear naming, swallowed errors — that don't break today but slow every future change.", exploit: "Quality debt compounds: tangled code is harder to change safely, so changes take longer and add defects, which tangles it further.", example: "A 300-line function with copy-pasted branches drifted out of sync, and a fix applied to one copy silently missed the others.", fix: "Refactor toward small single-purpose units, extract duplication to one source of truth, name for intent, make error paths explicit; lean on linters and tests." },
      { name: "Scalability", cwe: "—", owasp: "—", severity: "info", what: "Designs that work at current load but won't hold as data, traffic, or concurrency grow — in-memory state that can't shard, global locks, unbounded growth.", exploit: "Code can be fast today and still fail to scale: it keeps all sessions in process memory or serialises every request through one lock.", example: "A service storing sessions in process memory couldn't be horizontally scaled when traffic doubled.", fix: "Push shared state into a scalable store, bound queues and result sets, make work stateless, replace coarse locks with finer-grained ones, load-test against projected growth." },
      { name: "Dependency Optimization", cwe: "—", owasp: "—", severity: "info", what: "Third-party usage that bloats build or runtime — heavyweight libraries for trivial tasks, duplicate transitive packages, unused dependencies.", exploit: "Every dependency adds install time, bundle/image size, attack surface, and upgrade burden; pulling a large library for one helper is pure cost.", example: "A bundle shipped a full date library to format one timestamp, adding hundreds of KB to the client.", fix: "Replace heavyweight imports with small built-ins or focused utilities, remove unused packages, deduplicate versions, split dev deps out of the production build." }
    ],
    "Stubs & Placeholders": [
      { name: "Stub", cwe: "—", owasp: "—", severity: "info", what: "A function or module that exists but has no real implementation — an empty body, a hardcoded return, or a NotImplementedError standing in for logic never written.", exploit: "A stub on a real code path silently does nothing or returns a fixed value, so the system looks like it works while skipping a step.", example: "A payment handler stubbed to always return success let orders complete without ever charging the card.", fix: "Implement the intended logic, or make a deliberate stub explicit: feature-flag it and raise a clear error so it can't silently no-op." },
      { name: "Placeholder", cwe: "—", owasp: "—", severity: "info", what: "A stand-in value left in code — test email, localhost URL, dummy API key, sample data — meant to be replaced before going live.", exploit: "Placeholders make code behave correctly in dev and wrongly in production: requests go to the wrong host, emails to a dummy address, integrations fail on a fake key.", example: "A service shipped with http://localhost:3000 as its API base URL and silently failed every outbound call in production.", fix: "Move the value into configuration or an environment variable, supply the real value per environment, and fail loudly when a required value is missing." },
      { name: "Incomplete", cwe: "—", owasp: "—", severity: "info", what: "Code that's partially written — handles the happy path but not errors, validation that always passes, an empty catch block, an unfinished branch.", exploit: "Incomplete code works on the inputs you tested and fails on the ones you didn't: an unhandled error path or an unvalidated edge case.", example: "A validation function that returned true regardless of input let malformed records into the database.", fix: "Finish the missing paths: surface errors instead of swallowing them, make validation reject bad input, cover remaining branches, add edge-case tests." },
      { name: "AI-Generated", cwe: "—", owasp: "—", severity: "info", what: "Hollow scaffolding left by code assistants — boilerplate handlers, 'add your logic here' comments, plausible structure with no real behaviour behind it.", exploit: "AI-generated boilerplate is fluent and well-structured, so it reads as finished even when empty — which makes hollow code easy to merge by accident.", example: "A scaffolded handler returning a canned response was merged as complete, and the real logic was never wired in.", fix: "Treat the scaffold as a TODO: implement the intended logic, remove placeholder comments, review AI-written code for behaviour rather than appearance." }
    ]
  };

  window.VS_CATEGORIES = Object.keys(window.VS_TAXONOMY);

  window.VS_LEARNING = {};
  for (const cat in window.VS_TAXONOMY) {
    window.VS_TAXONOMY[cat].forEach(c => {
      window.VS_LEARNING[c.name] = {
        category: cat,
        cwe: c.cwe,
        owasp: c.owasp,
        severity: c.severity,
        what: c.what,
        exploit: c.exploit,
        example: c.example,
        fix: c.fix
      };
    });
  }

  // Activity feed
  window.VS_ACTIVITY = [
    { who: "You", action: "ran a Deep scan on", target: "user/ecommerce-api", when: "just now", icon: "scan" },
    { who: "System", action: "rerouted 23 segments to OpenRouter after a rate limit on", target: "ecommerce-api", when: "1h ago", icon: "reroute" },
    { who: "You", action: "completed the goal ‘Verify JWT signatures’ in", target: "Auth Hardening", when: "yesterday", icon: "check" },
    { who: "Watchlist", action: "detected 3 new findings in", target: "ecommerce-api", when: "yesterday", icon: "bell" },
  ];

  // History — previous scans of ecommerce-api for the diff view
  window.VS_HISTORY = {
    trend: [22, 28, 31, 35, 33, 38], // score over last 6 scans
    diffNew: [
      { sev: "critical", name: "Remote code execution via eval() on webhook payload", file: "src/routes/webhooks.js" },
      { sev: "high", name: "Server-side request forgery in image proxy", file: "src/routes/products.js" },
      { sev: "medium", name: "Unsigned webhook payloads accepted", file: "src/routes/webhooks.js" },
    ],
    diffFixed: [
      { sev: "high", name: "Plaintext password comparison", file: "src/routes/auth.js" },
      { sev: "medium", name: "Missing input length validation", file: "src/routes/users.js" },
    ],
    diffOpen: [
      { sev: "critical", name: "SQL Injection via string interpolation", file: "src/routes/products.js" },
      { sev: "critical", name: "Hardcoded Stripe secret key", file: "src/services/paymentService.js" },
      { sev: "critical", name: "JWT signature not verified", file: "src/middleware/auth.js" },
      { sev: "high", name: "Missing authorization on admin order export", file: "src/routes/admin.js" },
    ],
  };

  // Per-model activity for live scan
  window.VS_MODELS = [
    { id: "gemini", name: "Gemini 2.0 Flash", short: "Gemini", color: "#7aa2f7", provider: "Google" },
    { id: "openrouter", name: "OpenRouter / Claude Haiku", short: "OpenRouter", color: "#c792ea", provider: "OpenRouter" },
  ];

  // Repo file tree (for new-scan picker + heatmap). Severity is worst finding in file.
  window.VS_REPO_FILES = [
    { path: "src/index.js", sec: 4, opt: 2, sev: "high" },
    { path: "src/routes/products.js", sec: 2, opt: 1, sev: "critical" },
    { path: "src/routes/auth.js", sec: 4, opt: 1, sev: "high" },
    { path: "src/routes/orders.js", sec: 2, opt: 1, sev: "high" },
    { path: "src/routes/users.js", sec: 1, opt: 1, sev: "medium" },
    { path: "src/routes/admin.js", sec: 2, opt: 1, sev: "high" },
    { path: "src/routes/webhooks.js", sec: 2, opt: 0, sev: "critical" },
    { path: "src/middleware/auth.js", sec: 1, opt: 0, sev: "critical" },
    { path: "src/middleware/errorHandler.js", sec: 1, opt: 0, sev: "medium" },
    { path: "src/middleware/rateLimit.js", sec: 1, opt: 0, sev: "info" },
    { path: "src/services/paymentService.js", sec: 1, opt: 0, sev: "critical" },
    { path: "src/services/uploadService.js", sec: 1, opt: 0, sev: "high" },
    { path: "src/services/searchService.js", sec: 1, opt: 0, sev: "high" },
    { path: "src/services/emailService.js", sec: 1, opt: 0, sev: "medium" },
    { path: "src/services/cartService.js", sec: 0, opt: 1, sev: "low" },
    { path: "src/utils/crypto.js", sec: 1, opt: 0, sev: "high" },
    { path: "src/utils/logger.js", sec: 1, opt: 0, sev: "medium" },
    { path: "src/utils/helpers.js", sec: 1, opt: 1, sev: "low" },
    { path: "src/utils/validator.js", sec: 0, opt: 1, sev: "opt" },
    { path: "src/models/order.js", sec: 0, opt: 1, sev: "opt" },
    { path: "src/config/database.js", sec: 0, opt: 1, sev: "opt" },
    { path: "src/jobs/cleanup.js", sec: 0, opt: 1, sev: "opt" },
    { path: ".env.example", sec: 1, opt: 0, sev: "info" },
    { path: "docker-compose.yml", sec: 1, opt: 0, sev: "info" },
  ];

  // GitHub repos for the new-scan picker
  window.VS_GH_REPOS = [
    { name: "user/ecommerce-api", lang: "JavaScript", stars: 12, private: false, pushed: "2h ago" },
    { name: "user/payments-gateway", lang: "TypeScript", stars: 4, private: true, pushed: "1d ago" },
    { name: "user/auth-service", lang: "Go", stars: 28, private: false, pushed: "3d ago" },
    { name: "user/mobile-bff", lang: "TypeScript", stars: 7, private: true, pushed: "5d ago" },
    { name: "acme/marketing-site", lang: "Astro", stars: 2, private: false, pushed: "1w ago" },
    { name: "acme/internal-dashboard", lang: "React", stars: 0, private: true, pushed: "2w ago" },
    { name: "acme/data-pipeline", lang: "Python", stars: 15, private: true, pushed: "3w ago" },
  ];

  window.VS_REPO_META = {
    repo: "user/ecommerce-api", files: 24, segments: 318, duration: "12m 04s",
    models: ["Gemini 2.0 Flash", "OpenRouter / Claude Haiku"],
    score: 38, optScore: 64, stubScore: 52, branch: "main", commit: "a3f9c21",
  };
})();
