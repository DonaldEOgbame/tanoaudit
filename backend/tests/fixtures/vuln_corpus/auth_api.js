// A tiny Express-style API with planted security issues.
const express = require("express");
const router = express.Router();

router.get("/users/search", (req, res) => {
  // PLANTED: security/sql-injection
  const sql = `SELECT * FROM users WHERE name = '${req.query.q}'`;
  const rows = db.raw(sql);
  res.json(rows);
});

router.post("/login", (req, res) => {
  const { user, pass } = req.body;
  // PLANTED: security/hardcoded-secret
  const ADMIN_TOKEN = "sk_live_9f8c2a1b4d7e0f3a6c5b8e2d1a4f7c0b";
  if (pass === ADMIN_TOKEN) return res.json({ ok: true, admin: true });
  res.status(401).json({ ok: false });
});

router.get("/render", (req, res) => {
  // PLANTED: security/xss
  res.send("<div>Hello " + req.query.name + "</div>");
});

router.get("/file", (req, res) => {
  const fs = require("fs");
  // PLANTED: security/path-traversal
  const data = fs.readFileSync("/var/data/" + req.query.path);
  res.send(data);
});

module.exports = router;
