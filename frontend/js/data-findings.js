// VaultScan demo data — findings for user/ecommerce-api
// Finding shape: { id, type, sev, name, file, start, lines, category, cwe, owasp,
//   model, verified, confidence, summary, code, vuln (rel line idx), fixSummary, fixCode, added (rel idx), effort }
(function () {
  let _id = 0;
  function F(o) { _id++; return Object.assign({ id: "VS-" + String(_id).padStart(3, "0"), type: "security", verified: false, confidence: "High" }, o); }
  // Stub-engine finding. `stubCategory` ∈ Stub|Placeholder|Incomplete|AI-Generated.
  // `risk` = risk if shipped. fixCode/fixSummary hold the suggested implementation.
  let _sid = 0;
  function S(o) { _sid++; return Object.assign({ id: "STB-" + String(_sid).padStart(4, "0"), type: "stub", verified: false, confidence: "High", cwe: "—", owasp: "—", category: o.stubCategory }, o); }

  const FINDINGS = [
    // ================= CRITICAL =================
    F({
      sev: "critical", name: "SQL Injection via string interpolation", file: "src/routes/products.js", start: 41, lines: [44, 46],
      category: "Injection", cwe: "CWE-89", owasp: "A03:2021", model: "Gemini 2.0 Flash", verified: true,
      summary: "The search endpoint builds a SQL query by interpolating the raw `q` query parameter directly into the statement. An attacker can submit `' OR 1=1 --` or stacked queries to dump the entire products and users tables. This is reachable without authentication.",
      code: `router.get('/search', async (req, res) => {
  const { q, category } = req.query;
  // TODO: clean this up later
  const sql = \`SELECT * FROM products
    WHERE name LIKE '%\${q}%'
    AND category = '\${category}'\`;
  const rows = await db.raw(sql);
  res.json(rows);
});`,
      vuln: [3, 4, 5],
      fixSummary: "Use parameterized queries. Knex's `whereILike` and bindings keep user input out of the SQL grammar entirely.",
      fixCode: `router.get('/search', async (req, res) => {
  const { q, category } = req.query;
  const rows = await db('products')
    .whereILike('name', \`%\${q}%\`)
    .andWhere('category', category)
    .select();
  res.json(rows);
});`,
      added: [2, 3, 4, 5], effort: "~30 min"
    }),
    F({
      sev: "critical", name: "Hardcoded Stripe secret key", file: "src/services/paymentService.js", start: 1, lines: [3, 3],
      category: "Secrets & Credentials", cwe: "CWE-798", owasp: "A07:2021", model: "Groq Llama 3.3", verified: true,
      summary: "A live Stripe secret key is committed in source. Anyone with repo read access can issue refunds, create charges, and exfiltrate customer payment data. The key must be rotated immediately — removing it from the file is not sufficient since it remains in git history.",
      code: `const Stripe = require('stripe');

const stripe = new Stripe('sk_live_51Hx9mKJ2eZvKYlo2C9qn8aTf');

async function createCharge(order) {
  return stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'usd',`,
      vuln: [2],
      fixSummary: "Load the key from the environment, fail fast if missing, and rotate the leaked key in the Stripe dashboard.",
      fixCode: `const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);`,
      added: [2, 3, 4, 5], effort: "~1 hr (incl. key rotation)"
    }),
    F({
      sev: "critical", name: "JWT signature not verified", file: "src/middleware/auth.js", start: 12, lines: [15, 18],
      category: "Authentication", cwe: "CWE-347", owasp: "A07:2021", model: "Gemini 2.0 Flash", verified: true,
      summary: "The auth middleware uses `jwt.decode()` which only base64-decodes the token — it performs no signature verification. Any client can forge a token with `role: \"admin\"` and pass every auth check in the API.",
      code: `function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  // decode the token payload
  const payload = jwt.decode(token);
  req.user = payload;
  next();
}`,
      vuln: [4, 5],
      fixSummary: "Use `jwt.verify()` with the signing secret and an explicit algorithm allow-list, and handle verification failure.",
      fixCode: `function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}`,
      added: [3, 4, 5, 6, 7, 8, 9, 10], effort: "~45 min"
    }),
    F({
      sev: "critical", name: "Remote code execution via eval() on webhook payload", file: "src/routes/webhooks.js", start: 22, lines: [26, 26],
      category: "Injection", cwe: "CWE-95", owasp: "A03:2021", model: "OpenRouter / Claude Haiku", verified: false, confidence: "Medium",
      summary: "The webhook handler evaluates a `transform` expression supplied in the request body with `eval()`. A crafted webhook delivers arbitrary code execution on the server with the privileges of the Node process.",
      code: `router.post('/inventory', async (req, res) => {
  const { sku, quantity, transform } = req.body;
  let qty = quantity;
  if (transform) {
    // allow partners to adjust quantities
    qty = eval(transform.replace('{qty}', quantity));
  }
  await Inventory.update(sku, qty);
  res.sendStatus(200);
});`,
      vuln: [4, 5],
      fixSummary: "Never evaluate user-supplied code. Support a fixed set of named operations validated against an allow-list.",
      fixCode: `const TRANSFORMS = {
  none: (q) => q,
  dozen: (q) => q * 12,
  gross: (q) => q * 144,
};
router.post('/inventory', async (req, res) => {
  const { sku, quantity, transform } = req.body;
  const fn = TRANSFORMS[transform] ?? TRANSFORMS.none;
  await Inventory.update(sku, fn(Number(quantity)));
  res.sendStatus(200);
});`,
      added: [0, 1, 2, 3, 4, 7], effort: "~1 hr"
    }),

    // ================= HIGH =================
    F({
      sev: "high", name: "Missing authorization on admin order export", file: "src/routes/admin.js", start: 55, lines: [57, 62],
      category: "Access Control", cwe: "CWE-862", owasp: "A01:2021", model: "Gemini 2.0 Flash", verified: true,
      summary: "The `/admin/orders/export` route is mounted before the admin role check is applied. Any authenticated user can download a CSV of all orders including emails and shipping addresses.",
      code: `// NOTE: requireAdmin applied below for admin routes
router.get('/orders/export', async (req, res) => {
  const orders = await Order.findAll({ include: 'user' });
  const csv = toCsv(orders);
  res.attachment('orders.csv').send(csv);
});

router.use(requireAdmin);`,
      vuln: [1, 2, 3, 4, 5],
      fixSummary: "Apply `requireAdmin` before any admin route is registered, or attach it per-route.",
      fixCode: `router.use(requireAdmin);

router.get('/orders/export', async (req, res) => {
  const orders = await Order.findAll({ include: 'user' });
  const csv = toCsv(orders);
  res.attachment('orders.csv').send(csv);
});`,
      added: [0], effort: "~15 min"
    }),
    F({
      sev: "high", name: "Password reset token is predictable", file: "src/routes/auth.js", start: 88, lines: [90, 91],
      category: "Authentication", cwe: "CWE-330", owasp: "A07:2021", model: "Groq Llama 3.3",
      summary: "Reset tokens are generated from `Date.now()` and `Math.random()`, both predictable. An attacker who knows roughly when a reset was requested can brute-force the token space and take over accounts.",
      code: `router.post('/forgot-password', async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  const token = Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
  await ResetToken.create({ userId: user.id, token });
  await email.sendReset(user.email, token);
  res.json({ ok: true });
});`,
      vuln: [2, 3],
      fixSummary: "Use `crypto.randomBytes` for a 256-bit token, store only its hash, and add an expiry.",
      fixCode: `const crypto = require('crypto');

router.post('/forgot-password', async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await ResetToken.create({ userId: user.id, hash,
    expiresAt: Date.now() + 15 * 60 * 1000 });
  await email.sendReset(user.email, token);
  res.json({ ok: true });
});`,
      added: [0, 4, 5, 6, 7], effort: "~45 min"
    }),
    F({
      sev: "high", name: "IDOR: order lookup trusts client-supplied user ID", file: "src/routes/orders.js", start: 18, lines: [20, 22],
      category: "Access Control", cwe: "CWE-639", owasp: "A01:2021", model: "Gemini 2.0 Flash", verified: true,
      summary: "The order detail endpoint fetches by the `:orderId` param without checking the order belongs to the authenticated user. Sequential integer IDs make enumeration of every customer's orders trivial.",
      code: `router.get('/:orderId', requireAuth, async (req, res) => {
  const order = await Order.findByPk(req.params.orderId, {
    include: ['items', 'shippingAddress', 'payment'],
  });
  if (!order) return res.status(404).end();
  res.json(order);
});`,
      vuln: [1, 2, 3],
      fixSummary: "Scope the query to the authenticated user and return 404 for non-owned orders to avoid leaking existence.",
      fixCode: `router.get('/:orderId', requireAuth, async (req, res) => {
  const order = await Order.findOne({
    where: { id: req.params.orderId, userId: req.user.id },
    include: ['items', 'shippingAddress', 'payment'],
  });
  if (!order) return res.status(404).end();
  res.json(order);
});`,
      added: [1, 2], effort: "~20 min"
    }),
    F({
      sev: "high", name: "Unrestricted file upload (type & size)", file: "src/services/uploadService.js", start: 9, lines: [11, 15],
      category: "File Handling", cwe: "CWE-434", owasp: "A04:2021", model: "OpenRouter / Claude Haiku",
      summary: "Avatar uploads accept any MIME type and any size, and files are written inside the web root with their original extension. Uploading an `.svg` with embedded script enables stored XSS; a `.js` or `.php` file may enable RCE depending on deployment.",
      code: `const upload = multer({ dest: 'public/uploads/' });

router.post('/avatar', upload.single('file'), (req, res) => {
  const ext = path.extname(req.file.originalname);
  const dest = \`public/uploads/\${req.user.id}\${ext}\`;
  fs.renameSync(req.file.path, dest);
  res.json({ url: '/' + dest });
});`,
      vuln: [0, 2, 3, 4],
      fixSummary: "Validate MIME type against an allow-list, cap size at 2 MB, strip the original name, and store outside the web root.",
      fixCode: `const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, ['image/png', 'image/jpeg', 'image/webp']
      .includes(file.mimetype)),
});`,
      added: [1, 2, 3, 4, 5], effort: "~1.5 hr"
    }),
    F({
      sev: "high", name: "CORS reflects arbitrary origin with credentials", file: "src/index.js", start: 14, lines: [16, 19],
      category: "Configuration", cwe: "CWE-942", owasp: "A05:2021", model: "Gemini 2.0 Flash",
      summary: "The CORS middleware reflects whatever Origin header arrives and sets `credentials: true`. Any website can make authenticated requests on behalf of a logged-in user and read the responses — effectively disabling the same-origin policy for this API.",
      code: `app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));`,
      vuln: [1, 2],
      fixSummary: "Allow-list known frontend origins explicitly.",
      fixCode: `const ALLOWED = ['https://shop.example.com',
  'https://staging.shop.example.com'];
app.use(cors({
  origin: (origin, cb) =>
    cb(null, !origin || ALLOWED.includes(origin)),
  credentials: true,
}));`,
      added: [0, 1, 3, 4], effort: "~20 min"
    }),
    F({
      sev: "high", name: "bcrypt cost factor of 4 is far too low", file: "src/utils/crypto.js", start: 5, lines: [7, 7],
      category: "Cryptography", cwe: "CWE-916", owasp: "A02:2021", model: "Groq Mixtral 8x7B",
      summary: "Password hashing uses bcrypt with a cost of 4 (~1 ms per hash). Modern GPUs can attempt hundreds of millions of guesses per day at this cost, making leaked hashes practical to crack.",
      code: `const bcrypt = require('bcrypt');

const SALT_ROUNDS = 4; // fast for tests
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}`,
      vuln: [2],
      fixSummary: "Use cost 12+ in production (env-configurable so tests stay fast).",
      fixCode: `const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}`,
      added: [0], effort: "~10 min + rehash on next login"
    }),
    F({
      sev: "high", name: "XML external entity (XXE) expansion enabled", file: "src/services/searchService.js", start: 31, lines: [33, 35],
      category: "Injection", cwe: "CWE-611", owasp: "A05:2021", model: "Gemini 2.0 Flash",
      summary: "Product feed imports parse partner XML with external entity resolution enabled, allowing file disclosure (`file:///etc/passwd`) and SSRF via crafted DOCTYPE declarations.",
      code: `const parser = new libxml.SaxParser();
function importFeed(xml) {
  const doc = libxml.parseXml(xml, {
    noent: true,
    dtdload: true,
  });
  return doc.find('//product').map(parseProduct);
}`,
      vuln: [3, 4],
      fixSummary: "Disable entity substitution and DTD loading when parsing untrusted XML.",
      fixCode: `function importFeed(xml) {
  const doc = libxml.parseXml(xml, {
    noent: false,
    dtdload: false,
    nonet: true,
  });
  return doc.find('//product').map(parseProduct);
}`,
      added: [2, 3, 4], effort: "~30 min"
    }),
    F({
      sev: "high", name: "Server-side request forgery in image proxy", file: "src/routes/products.js", start: 102, lines: [104, 106],
      category: "SSRF", cwe: "CWE-918", owasp: "A10:2021", model: "OpenRouter / Claude Haiku", verified: true,
      summary: "The image proxy fetches any URL passed in `?src=`. Attackers can reach internal services (cloud metadata endpoint, Redis, internal admin panels) through the server.",
      code: `router.get('/image-proxy', async (req, res) => {
  const { src } = req.query;
  const upstream = await fetch(src);
  const buf = await upstream.arrayBuffer();
  res.type('image/jpeg').send(Buffer.from(buf));
});`,
      vuln: [2, 3],
      fixSummary: "Allow-list upstream hosts, resolve DNS first and reject private IP ranges, and enforce https.",
      fixCode: `const HOSTS = ['cdn.example.com', 'images.example.com'];
router.get('/image-proxy', async (req, res) => {
  const url = new URL(req.query.src);
  if (url.protocol !== 'https:' || !HOSTS.includes(url.hostname))
    return res.status(400).json({ error: 'Origin not allowed' });
  const upstream = await fetch(url);
  res.type('image/jpeg').send(Buffer.from(await upstream.arrayBuffer()));
});`,
      added: [0, 2, 3, 4], effort: "~1 hr"
    }),
    F({
      sev: "high", name: "Session cookie missing Secure & HttpOnly flags", file: "src/index.js", start: 28, lines: [30, 34],
      category: "Session Management", cwe: "CWE-1004", owasp: "A05:2021", model: "Groq Llama 3.3",
      summary: "Session cookies are issued without `httpOnly`, `secure`, or `sameSite`, exposing them to theft via XSS and transmission over plain HTTP.",
      code: `app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {},
}));`,
      vuln: [3, 4],
      fixSummary: "Set httpOnly, secure, and sameSite=lax; disable saveUninitialized.",
      fixCode: `app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 },
}));`,
      added: [3, 4, 5], effort: "~15 min"
    }),

    // ================= MEDIUM =================
    F({
      sev: "medium", name: "Stack traces returned to clients in production", file: "src/middleware/errorHandler.js", start: 4, lines: [6, 9],
      category: "Information Disclosure", cwe: "CWE-209", owasp: "A05:2021", model: "Gemini 2.0 Flash",
      summary: "The error handler serializes `err.stack` into the JSON response regardless of environment, leaking file paths, dependency versions, and query fragments to attackers.",
      code: `app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({
    error: err.message,
    stack: err.stack,
  });
});`,
      vuln: [3, 4],
      fixSummary: "Return a generic message in production; keep details in server logs only.",
      fixCode: `app.use((err, req, res, next) => {
  logger.error(err);
  const dev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: dev ? err.message : 'Internal server error',
    ...(dev && { stack: err.stack }),
  });
});`,
      added: [2, 4, 5], effort: "~15 min"
    }),
    F({
      sev: "medium", name: "No rate limiting on login endpoint", file: "src/routes/auth.js", start: 30, lines: [32, 32],
      category: "Authentication", cwe: "CWE-307", owasp: "A07:2021", model: "Groq Llama 3.3",
      summary: "`POST /auth/login` has no rate limiting or lockout, permitting credential-stuffing at full network speed. The rateLimit middleware exists in the codebase but is only applied to /api/search.",
      code: `// login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.hash)))
    return res.status(401).json({ error: 'Bad credentials' });`,
      vuln: [1],
      fixSummary: "Apply the existing limiter with tight bounds keyed on IP + email.",
      fixCode: `const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  keyGenerator: (req) => req.ip + ':' + (req.body.email || ''),
});
router.post('/login', loginLimiter, async (req, res) => {`,
      added: [0, 1, 2, 3], effort: "~30 min"
    }),
    F({
      sev: "medium", name: "Reflected XSS in 404 handler", file: "src/index.js", start: 61, lines: [63, 63],
      category: "Cross-Site Scripting", cwe: "CWE-79", owasp: "A03:2021", model: "Gemini 2.0 Flash",
      summary: "The catch-all 404 handler embeds the raw request path into an HTML response. A crafted link executes script in the victim's browser in the API's origin.",
      code: `app.use((req, res) => {
  res.status(404)
    .send(\`<h1>Not found: \${req.originalUrl}</h1>\`);
});`,
      vuln: [2],
      fixSummary: "Return JSON (this is an API), or HTML-encode the path.",
      fixCode: `app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});`,
      added: [1], effort: "~10 min"
    }),
    F({
      sev: "medium", name: "Mass assignment on user update", file: "src/routes/users.js", start: 44, lines: [46, 47],
      category: "Access Control", cwe: "CWE-915", owasp: "A08:2021", model: "OpenRouter / Claude Haiku",
      summary: "`PATCH /users/me` spreads the whole request body into the update, so a client can set `role`, `emailVerified`, or `credits` directly.",
      code: `router.patch('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  await user.update({ ...req.body });
  res.json(user);
});`,
      vuln: [2],
      fixSummary: "Pick an explicit allow-list of updatable fields.",
      fixCode: `const ALLOWED = ['displayName', 'bio', 'avatarUrl', 'locale'];
router.patch('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  await user.update(_.pick(req.body, ALLOWED));
  res.json(user);
});`,
      added: [0, 3], effort: "~20 min"
    }),
    F({
      sev: "medium", name: "Open redirect after login", file: "src/routes/auth.js", start: 52, lines: [54, 54],
      category: "Validation", cwe: "CWE-601", owasp: "A01:2021", model: "Groq Mixtral 8x7B",
      summary: "The post-login redirect uses the `next` query parameter unvalidated, enabling phishing flows that bounce through the trusted domain.",
      code: `// after successful login
const next = req.query.next || '/dashboard';
res.redirect(next);`,
      vuln: [1, 2],
      fixSummary: "Only allow relative paths within the app.",
      fixCode: `const next = req.query.next || '/dashboard';
const safe = next.startsWith('/') && !next.startsWith('//')
  ? next : '/dashboard';
res.redirect(safe);`,
      added: [1, 2], effort: "~15 min"
    }),
    F({
      sev: "medium", name: "Missing CSRF protection on state-changing routes", file: "src/index.js", start: 40, lines: [40, 44],
      category: "CSRF", cwe: "CWE-352", owasp: "A01:2021", model: "Gemini 2.0 Flash",
      summary: "Cookie-session authentication is used but no CSRF token middleware is mounted. Cross-origin forms can trigger order placement and profile changes for logged-in users.",
      code: `app.use(express.json());
app.use(session(sessionConfig));
// routes
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);`,
      vuln: [0, 1, 2, 3, 4],
      fixSummary: "Add CSRF token validation (double-submit cookie) for non-GET routes, or move to same-site strict cookies + custom header checks.",
      fixCode: `app.use(express.json());
app.use(session(sessionConfig));
app.use(csurf({ cookie: { sameSite: 'strict' } }));
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);`,
      added: [2], effort: "~2 hr"
    }),
    F({
      sev: "medium", name: "Verbose user enumeration on signup", file: "src/routes/auth.js", start: 12, lines: [15, 16],
      category: "Information Disclosure", cwe: "CWE-204", owasp: "A07:2021", model: "Groq Llama 3.3",
      summary: "Signup returns 'Email already registered' vs generic errors, letting attackers enumerate which emails have accounts. Combined with the unthrottled login, this enables targeted credential stuffing.",
      code: `const existing = await User.findByEmail(email);
if (existing) {
  return res.status(409)
    .json({ error: 'Email already registered' });
}`,
      vuln: [2, 3],
      fixSummary: "Return a uniform response and send a 'you already have an account' email instead.",
      fixCode: `if (existing) {
  await email.sendExistingAccountNotice(email);
  return res.status(202).json({ ok: true }); // same as success
}`,
      added: [1, 2], effort: "~45 min"
    }),
    F({
      sev: "medium", name: "Unsigned webhook payloads accepted", file: "src/routes/webhooks.js", start: 8, lines: [10, 12],
      category: "Authentication", cwe: "CWE-345", owasp: "A08:2021", model: "Gemini 2.0 Flash",
      summary: "Stripe webhooks are processed without signature verification, so anyone who discovers the URL can mark orders as paid.",
      code: `router.post('/stripe', async (req, res) => {
  const event = req.body;
  if (event.type === 'payment_intent.succeeded') {
    await Order.markPaid(event.data.object.metadata.orderId);
  }
  res.sendStatus(200);
});`,
      vuln: [1, 2],
      fixSummary: "Verify the `stripe-signature` header against the webhook secret using the raw body.",
      fixCode: `router.post('/stripe', express.raw({ type: 'application/json' }),
  async (req, res) => {
    const event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET);`,
      added: [0, 2, 3, 4], effort: "~45 min"
    }),
    F({
      sev: "medium", name: "Directory traversal in invoice download", file: "src/routes/orders.js", start: 71, lines: [73, 74],
      category: "File Handling", cwe: "CWE-22", owasp: "A01:2021", model: "OpenRouter / Claude Haiku",
      summary: "Invoice filenames come from the URL and are joined to the invoices directory without normalization — `../../.env` escapes the directory.",
      code: `router.get('/invoice/:name', requireAuth, (req, res) => {
  const file = path.join(INVOICE_DIR, req.params.name);
  res.sendFile(file);
});`,
      vuln: [1, 2],
      fixSummary: "Resolve and verify the path stays within the invoices directory; better, look invoices up by ID.",
      fixCode: `router.get('/invoice/:name', requireAuth, (req, res) => {
  const file = path.resolve(INVOICE_DIR, req.params.name);
  if (!file.startsWith(path.resolve(INVOICE_DIR) + path.sep))
    return res.status(400).end();
  res.sendFile(file);
});`,
      added: [1, 2, 3], effort: "~30 min"
    }),
    F({
      sev: "medium", name: "Sensitive data logged in plaintext", file: "src/utils/logger.js", start: 18, lines: [20, 22],
      category: "Information Disclosure", cwe: "CWE-532", owasp: "A09:2021", model: "Groq Llama 3.3",
      summary: "The request logger serializes full request bodies — including passwords on /auth/login and card fields on /payments — into application logs.",
      code: `app.use((req, res, next) => {
  logger.info({
    path: req.path,
    body: req.body,
    headers: req.headers,
  });
  next();
});`,
      vuln: [2, 3, 4],
      fixSummary: "Redact known-sensitive fields and drop auth headers before logging.",
      fixCode: `const REDACT = ['password', 'card', 'cvv', 'token'];
app.use((req, res, next) => {
  logger.info({
    path: req.path,
    body: redact(req.body, REDACT),
  });
  next();
});`,
      added: [0, 4], effort: "~45 min"
    }),
    F({
      sev: "medium", name: "TLS certificate validation disabled for email service", file: "src/services/emailService.js", start: 6, lines: [10, 10],
      category: "Cryptography", cwe: "CWE-295", owasp: "A02:2021", model: "Gemini 2.0 Flash",
      summary: "`rejectUnauthorized: false` disables certificate validation on the SMTP connection, enabling man-in-the-middle interception of all outbound mail including password reset links.",
      code: `const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  tls: { rejectUnauthorized: false },
  auth: { user: smtpUser, pass: smtpPass },
});`,
      vuln: [4],
      fixSummary: "Remove the override; fix the underlying cert problem on the SMTP host instead.",
      fixCode: `const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user: smtpUser, pass: smtpPass },
});`,
      added: [4], effort: "~20 min"
    }),

    // ================= LOW =================
    F({
      sev: "low", name: "Missing security headers (helmet not configured)", file: "src/index.js", start: 10, lines: [10, 12],
      category: "Configuration", cwe: "CWE-693", owasp: "A05:2021", model: "Groq Llama 3.3",
      summary: "No X-Content-Type-Options, X-Frame-Options, or Content-Security-Policy headers are set. helmet is in package.json but never mounted.",
      code: `const express = require('express');
const app = express();
// const helmet = require('helmet');`,
      vuln: [2],
      fixSummary: "Mount helmet with sane defaults.",
      fixCode: `const helmet = require('helmet');
app.use(helmet());`,
      added: [0, 1], effort: "~10 min"
    }),
    F({
      sev: "low", name: "JWT lifetime of 30 days with no refresh rotation", file: "src/routes/auth.js", start: 40, lines: [42, 42],
      category: "Session Management", cwe: "CWE-613", owasp: "A07:2021", model: "Gemini 2.0 Flash",
      summary: "Access tokens are valid for 30 days and there is no revocation list, so a stolen token grants a month of access.",
      code: `const token = jwt.sign({ sub: user.id, role: user.role },
  SECRET, { expiresIn: '30d' });`,
      vuln: [1],
      fixSummary: "Short-lived access tokens (15 min) + rotating refresh tokens.",
      fixCode: `const token = jwt.sign({ sub: user.id, role: user.role },
  SECRET, { expiresIn: '15m' });
const refresh = await issueRefreshToken(user.id); // rotated on use`,
      added: [1, 2], effort: "~3 hr"
    }),
    F({
      sev: "low", name: "API version disclosure via X-Powered-By", file: "src/index.js", start: 8, lines: [8, 8],
      category: "Information Disclosure", cwe: "CWE-200", owasp: "A05:2021", model: "Groq Mixtral 8x7B",
      summary: "Express advertises itself via the X-Powered-By header, simplifying fingerprinting.",
      code: `const app = express();`,
      vuln: [0],
      fixSummary: "Disable the header.",
      fixCode: `const app = express();
app.disable('x-powered-by');`,
      added: [1], effort: "~5 min"
    }),
    F({
      sev: "low", name: "Debug endpoint exposed in production", file: "src/routes/admin.js", start: 12, lines: [14, 17],
      category: "Configuration", cwe: "CWE-489", owasp: "A05:2021", model: "OpenRouter / Claude Haiku",
      summary: "`GET /admin/debug/config` dumps the merged runtime config. It redacts nothing and is gated only by a comment.",
      code: `// debug only — remove before launch!
router.get('/debug/config', (req, res) => {
  res.json(config.getAll());
});`,
      vuln: [1, 2, 3],
      fixSummary: "Remove the route, or gate behind NODE_ENV !== 'production' and admin auth.",
      fixCode: `if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/config', requireAdmin, (req, res) => {
    res.json(config.getAll());
  });
}`,
      added: [0, 1, 3], effort: "~10 min"
    }),
    F({
      sev: "low", name: "Math.random() used for coupon codes", file: "src/utils/helpers.js", start: 24, lines: [25, 26],
      category: "Cryptography", cwe: "CWE-338", owasp: "A02:2021", model: "Groq Llama 3.3",
      summary: "Promotional coupon codes are generated with Math.random(), which is predictable. Low direct impact, but enables coupon farming.",
      code: `function generateCoupon() {
  return 'SAVE-' + Math.random()
    .toString(36).slice(2, 10).toUpperCase();
}`,
      vuln: [1, 2],
      fixSummary: "Use crypto.randomBytes for unguessable codes.",
      fixCode: `function generateCoupon() {
  return 'SAVE-' + crypto.randomBytes(5)
    .toString('hex').toUpperCase();
}`,
      added: [1, 2], effort: "~10 min"
    }),

    // ================= INFO =================
    F({
      sev: "info", name: "TODO/FIXME markers referencing security work", file: "src/middleware/rateLimit.js", start: 1, lines: [2, 2],
      category: "Code Hygiene", cwe: "—", owasp: "—", model: "Gemini 2.0 Flash", confidence: "High",
      summary: "7 TODO comments across the codebase reference unfinished security work ('TODO: add rate limit', 'FIXME: validate input'). These mark known-incomplete protections.",
      code: `// TODO: apply this to auth routes too (see #142)
const rateLimit = require('express-rate-limit');`,
      vuln: [0],
      fixSummary: "Track these in the issue tracker and remove stale markers.",
      fixCode: `const rateLimit = require('express-rate-limit');`,
      added: [], effort: "~30 min"
    }),
    F({
      sev: "info", name: ".env.example contains a real-looking API key", file: ".env.example", start: 5, lines: [7, 7],
      category: "Secrets & Credentials", cwe: "CWE-540", owasp: "—", model: "Groq Llama 3.3", confidence: "Medium",
      summary: "The example env file ships a Groq key with a realistic prefix. If it is a real key it must be rotated; if not, use an obvious placeholder to avoid false alarms.",
      code: `DATABASE_URL=postgres://localhost/shop
JWT_SECRET=change-me
GROQ_API_KEY=gsk_x7PbqT2VfLm9aRw3KdYe`,
      vuln: [2],
      fixSummary: "Use clearly fake placeholders.",
      fixCode: `GROQ_API_KEY=your-groq-key-here`,
      added: [0], effort: "~5 min"
    }),
    F({
      sev: "info", name: "Docker container runs as root", file: "docker-compose.yml", start: 1, lines: [6, 6],
      category: "Configuration", cwe: "CWE-250", owasp: "—", model: "OpenRouter / Claude Haiku",
      summary: "The api service has no `user:` directive, so the Node process runs as root inside the container, amplifying any RCE.",
      code: `services:
  api:
    build: .
    ports:
      - "3000:3000"
    # runs as root`,
      vuln: [5],
      fixSummary: "Add a non-root user in the Dockerfile and reference it here.",
      fixCode: `services:
  api:
    build: .
    user: "node"
    ports:
      - "3000:3000"`,
      added: [3], effort: "~20 min"
    }),

    // ================= OPTIMIZATION =================
    F({
      type: "opt", sev: "opt", name: "N+1 query loading order items", file: "src/routes/orders.js", start: 35, lines: [37, 41],
      category: "Performance", cwe: "—", owasp: "—", model: "Gemini 2.0 Flash", impact: "High",
      summary: "The order list endpoint loads items with one query per order — a page of 50 orders issues 51 queries. Measured equivalent patterns typically cut p95 latency 60–80% when batched.",
      code: `const orders = await Order.findAll({ where: { userId } });
for (const order of orders) {
  order.items = await OrderItem.findAll({
    where: { orderId: order.id },
  });
}`,
      vuln: [1, 2, 3, 4],
      fixSummary: "Use an eager include so the ORM batches with a single JOIN.",
      fixCode: `const orders = await Order.findAll({
  where: { userId },
  include: [{ model: OrderItem, as: 'items' }],
});`,
      added: [1, 2], effort: "~30 min"
    }),
    F({
      type: "opt", sev: "opt", name: "Missing index on orders.user_id", file: "src/models/order.js", start: 4, lines: [6, 10],
      category: "Performance", model: "Groq Llama 3.3", impact: "High",
      summary: "Every per-user order query performs a sequential scan — the orders table has no index on user_id. At 1M+ rows this is the slowest query in the app.",
      code: `const Order = sequelize.define('Order', {
  userId: DataTypes.INTEGER,
  status: DataTypes.STRING,
  totalCents: DataTypes.INTEGER,
}, { tableName: 'orders' });`,
      vuln: [1],
      fixSummary: "Add a composite index on (user_id, created_at) to cover the list query and its sort.",
      fixCode: `}, {
  tableName: 'orders',
  indexes: [{ fields: ['userId', 'createdAt'] }],
});`,
      added: [2], effort: "~20 min + migration"
    }),
    F({
      type: "opt", sev: "opt", name: "Synchronous bcrypt blocks the event loop", file: "src/routes/auth.js", start: 64, lines: [66, 66],
      category: "Performance", model: "Gemini 2.0 Flash", impact: "Medium",
      summary: "`bcrypt.compareSync` blocks the event loop ~100 ms per login. Under concurrent logins every request in the process stalls.",
      code: `const ok = bcrypt.compareSync(password, user.hash);`,
      vuln: [0],
      fixSummary: "Use the async API.",
      fixCode: `const ok = await bcrypt.compare(password, user.hash);`,
      added: [0], effort: "~10 min"
    }),
    F({
      type: "opt", sev: "opt", name: "Product catalog refetched on every request (no cache)", file: "src/routes/products.js", start: 12, lines: [13, 16],
      category: "Scalability", model: "OpenRouter / Claude Haiku", impact: "High",
      summary: "The category tree (changes ~daily) is rebuilt from the DB on every request to /products. A 60-second in-memory cache removes ~95% of these queries.",
      code: `router.get('/', async (req, res) => {
  const categories = await buildCategoryTree();
  const products = await Product.findAll({ limit: 50 });
  res.json({ categories, products });
});`,
      vuln: [1],
      fixSummary: "Memoize with a short TTL; invalidate on category writes.",
      fixCode: `const cached = ttlCache(buildCategoryTree, 60_000);
router.get('/', async (req, res) => {
  const categories = await cached();
  const products = await Product.findAll({ limit: 50 });
  res.json({ categories, products });
});`,
      added: [0, 2], effort: "~45 min"
    }),
    F({
      type: "opt", sev: "opt", name: "Unbounded JSON body size", file: "src/index.js", start: 12, lines: [12, 12],
      category: "Scalability", model: "Groq Mixtral 8x7B", impact: "Medium",
      summary: "express.json() has no size limit (default 100kb was overridden to '50mb' for the import endpoint, globally). A single request can allocate 50 MB; a handful can OOM the process.",
      code: `app.use(express.json({ limit: '50mb' }));`,
      vuln: [0],
      fixSummary: "Default to 100kb globally; raise the limit only on the import route.",
      fixCode: `app.use(express.json({ limit: '100kb' }));
app.use('/import', express.json({ limit: '50mb' }));`,
      added: [0, 1], effort: "~15 min"
    }),
    F({
      type: "opt", sev: "opt", name: "Full table scan for dashboard stats", file: "src/routes/admin.js", start: 30, lines: [31, 35],
      category: "Performance", model: "Gemini 2.0 Flash", impact: "Medium",
      summary: "Admin dashboard counts rows by loading entire tables into memory and measuring `.length`. COUNT(*) queries reduce this from seconds to milliseconds.",
      code: `const stats = {
  users: (await User.findAll()).length,
  orders: (await Order.findAll()).length,
  revenue: (await Order.findAll())
    .reduce((s, o) => s + o.totalCents, 0),
};`,
      vuln: [1, 2, 3, 4],
      fixSummary: "Push aggregation to the database.",
      fixCode: `const stats = {
  users: await User.count(),
  orders: await Order.count(),
  revenue: await Order.sum('totalCents'),
};`,
      added: [1, 2, 3], effort: "~20 min"
    }),
    F({
      type: "opt", sev: "opt", name: "Duplicate validation logic across 6 routes", file: "src/utils/validator.js", start: 1, lines: [1, 1],
      category: "Code Quality", model: "Groq Llama 3.3", impact: "Low",
      summary: "Email/phone validation is re-implemented (with 3 different regexes) in auth.js, users.js, orders.js, and 3 more files. One of the regexes rejects valid + addresses.",
      code: `// validator.js exists but routes roll their own:
// auth.js:    /^\\S+@\\S+$/
// users.js:   /^[a-z0-9.]+@[a-z]+\\.[a-z]{2,}$/
// orders.js:  /\\w+@\\w+/`,
      vuln: [1, 2, 3],
      fixSummary: "Centralize in validator.js with a well-tested library (zod/validator.js) and import everywhere.",
      fixCode: `const { z } = require('zod');
exports.email = z.string().email();
exports.phone = z.string().regexp(/^\\+?[0-9 ()-]{7,15}$/);`,
      added: [0, 1, 2], effort: "~2 hr"
    }),
    F({
      type: "opt", sev: "opt", name: "Cleanup job loads all rows before filtering", file: "src/jobs/cleanup.js", start: 8, lines: [9, 12],
      category: "Performance", model: "OpenRouter / Claude Haiku", impact: "Medium",
      summary: "The nightly cleanup fetches every session row then filters in JS. Push the WHERE clause to SQL and delete in one statement.",
      code: `const sessions = await Session.findAll();
const stale = sessions.filter(
  (s) => s.updatedAt < Date.now() - 30 * DAY);
for (const s of stale) await s.destroy();`,
      vuln: [0, 1, 2, 3],
      fixSummary: "Single bulk delete.",
      fixCode: `await Session.destroy({
  where: { updatedAt: { [Op.lt]: new Date(Date.now() - 30 * DAY) } },
});`,
      added: [0, 1], effort: "~15 min"
    }),
    F({
      type: "opt", sev: "opt", name: "lodash imported wholesale for one function", file: "src/utils/helpers.js", start: 1, lines: [1, 1],
      category: "Dependencies", model: "Groq Mixtral 8x7B", impact: "Low",
      summary: "`require('lodash')` pulls 72 KB for a single `pick` call. Cold-start time on the serverless deployment pays for it on every boot.",
      code: `const _ = require('lodash');`,
      vuln: [0],
      fixSummary: "Import the single method or use a native rest/destructure.",
      fixCode: `const pick = require('lodash.pick');`,
      added: [0], effort: "~10 min"
    }),
    F({
      type: "opt", sev: "opt", name: "No connection pooling configured", file: "src/config/database.js", start: 3, lines: [5, 8],
      category: "Scalability", model: "Gemini 2.0 Flash", impact: "High",
      summary: "Sequelize is using default pool settings (max 5). Under load the API queues on connections while Postgres sits idle. Right-sizing the pool roughly triples sustained throughput in comparable setups.",
      code: `const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
});`,
      vuln: [1, 2],
      fixSummary: "Configure pool bounds and disable per-query console logging in production.",
      fixCode: `const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: { max: 20, min: 2, acquire: 30000, idle: 10000 },
});`,
      added: [2, 3], effort: "~30 min"
    }),
    F({
      type: "opt", sev: "opt", name: "Images served uncompressed from origin", file: "src/index.js", start: 20, lines: [21, 21],
      category: "Performance", model: "Groq Llama 3.3", impact: "Medium",
      summary: "Static product images are served by Express with no compression, caching headers, or CDN. 4.1 MB average page weight on the catalog.",
      code: `app.use('/static', express.static('public'));`,
      vuln: [0],
      fixSummary: "Add cache headers + compression middleware; front with a CDN for images.",
      fixCode: `app.use(compression());
app.use('/static', express.static('public', {
  maxAge: '30d', immutable: true,
}));`,
      added: [0, 2], effort: "~1 hr"
    }),
    F({
      type: "opt", sev: "opt", name: "Callback-style code mixed with async/await", file: "src/services/cartService.js", start: 14, lines: [15, 22],
      category: "Code Quality", model: "OpenRouter / Claude Haiku", impact: "Low",
      summary: "cartService mixes callbacks, raw promises, and async/await in one flow — two code paths swallow errors entirely (no rejection handler).",
      code: `function addToCart(userId, sku, cb) {
  Cart.findOne({ where: { userId } }).then((cart) => {
    Product.findBySku(sku, (err, product) => {
      if (product) {
        cart.add(product);
        cart.save().then(() => cb(null, cart));
      }
    });
  });
}`,
      vuln: [1, 2, 5],
      fixSummary: "Standardize on async/await with try/catch; errors propagate to the route handler.",
      fixCode: `async function addToCart(userId, sku) {
  const cart = await Cart.findOne({ where: { userId } });
  const product = await Product.findBySku(sku);
  if (!product) throw new NotFoundError(sku);
  cart.add(product);
  await cart.save();
  return cart;
}`,
      added: [0, 1, 2, 3, 4, 5, 6], effort: "~1.5 hr"
    }),
    F({
      type: "opt", sev: "opt", name: "Sequential awaits for independent queries", file: "src/routes/users.js", start: 12, lines: [13, 15],
      category: "Performance", model: "Gemini 2.0 Flash", impact: "Low",
      summary: "Profile endpoint awaits three independent queries sequentially (~120 ms serial vs ~45 ms parallel).",
      code: `const user = await User.findByPk(id);
const orders = await Order.recent(id);
const reviews = await Review.byUser(id);`,
      vuln: [0, 1, 2],
      fixSummary: "Run them concurrently with Promise.all.",
      fixCode: `const [user, orders, reviews] = await Promise.all([
  User.findByPk(id), Order.recent(id), Review.byUser(id),
]);`,
      added: [0, 1], effort: "~10 min"
    }),

    // ================= STUBS & PLACEHOLDERS =================
    S({
      sev: "critical", stubCategory: "Incomplete", name: "Empty RBAC permission guard",
      file: "src/middleware/rbac.js", start: 6, lines: [8, 11], model: "Gemini 2.0 Flash",
      risk: "Every authenticated user gets admin-level access — the role check is a no-op, so any logged-in account can hit admin-only routes.",
      summary: "The permission guard declares a required-role check but the body only calls next() with no authorization logic. It exists to satisfy the route signature and does nothing.",
      code: `function requireRole(role) {
  return (req, res, next) => {
    // TODO: implement auth
    next();
  };
}`,
      vuln: [2, 3],
      fixSummary: "Look up the caller's role and 403 when it doesn't include the required permission before calling next().",
      fixCode: `function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}`,
      added: [2, 3, 4, 5], effort: "~45 min"
    }),
    S({
      sev: "high", stubCategory: "Placeholder", name: "Email service returns dummy success",
      file: "src/services/emailService.js", start: 12, lines: [14, 16], model: "Groq Llama 3.3",
      risk: "No emails are ever sent — password resets and receipts silently fail while the code reports success.",
      summary: "The transactional email sender returns a hardcoded { ok: true } sample response instead of dispatching to a provider. The function name implies delivery but no provider is wired.",
      code: `async function sendEmail(to, template, vars) {
  // return await provider.send(...)
  return { ok: true, id: 'msg_12345', to: 'test@test.com' };
}`,
      vuln: [1, 2],
      fixSummary: "Wire the function to the real email provider SDK and return its delivery result.",
      fixCode: `async function sendEmail(to, template, vars) {
  const rendered = renderTemplate(template, vars);
  const res = await provider.send({ to, subject: rendered.subject, html: rendered.html });
  return { ok: res.status === 'queued', id: res.id, to };
}`,
      added: [1, 2, 3], effort: "~1.5 hr"
    }),
    S({
      sev: "medium", stubCategory: "AI-Generated", name: "Scaffolded order handler left hollow",
      file: "src/routes/orders.js", start: 28, lines: [31, 34], model: "OpenRouter / Claude Haiku",
      risk: "The create-order endpoint accepts requests and returns 200 without persisting anything — orders silently vanish.",
      summary: "Handler body is the AI scaffolding comment '// Add your logic here' followed by a generic 200 response. Classic copy-paste-from-AI boilerplate left uncustomized.",
      code: `router.post('/orders', async (req, res) => {
  // Add your logic here
  res.status(200).json({ success: true });
});`,
      vuln: [1, 2],
      fixSummary: "Validate the payload, persist the order, and return the created resource with a 201.",
      fixCode: `router.post('/orders', async (req, res) => {
  const data = orderSchema.parse(req.body);
  const order = await Order.create({ ...data, userId: req.user.id });
  res.status(201).json(order);
});`,
      added: [1, 2, 3], effort: "~1 hr"
    }),
    S({
      sev: "low", stubCategory: "Stub", name: "TODO: cache eviction never implemented",
      file: "src/utils/cache.js", start: 3, lines: [5, 5], model: "Gemini 2.0 Flash",
      risk: "Memory grows unbounded under sustained load, eventually OOM-ing the process.",
      summary: "An unbounded in-memory Map is used as a cache with a lingering '// TODO: add cache eviction' marker. No size cap or TTL was ever added.",
      code: `const cache = new Map();
function set(key, val) {
  // TODO: add cache eviction
  cache.set(key, val);
}`,
      vuln: [2],
      fixSummary: "Add an LRU eviction policy or TTL so the cache can't grow without bound.",
      fixCode: `const cache = new LRUCache({ max: 5000, ttl: 1000 * 60 * 5 });
function set(key, val) {
  cache.set(key, val);
}`,
      added: [0], effort: "~20 min"
    }),
  ];

  window.VS_FINDINGS = FINDINGS;
})();
