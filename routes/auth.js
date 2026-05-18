const express  = require("express");
const crypto   = require("crypto");
const bcrypt   = require("bcrypt");
const { pool } = require("../db");

const router = express.Router();
const SALT_ROUNDS = 12;

// ── GET /register ─────────────────────────────────────────────────────────────
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("register", { error: null, values: {} });
});

// ── POST /register ────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { email, display_name, password, confirm } = req.body;
  const values = { email, display_name };

  if (!email || !display_name || !password)
    return res.render("register", { error: "All fields are required.", values });

  if (password !== confirm)
    return res.render("register", { error: "Passwords do not match.", values });

  if (password.length < 8)
    return res.render("register", { error: "Password must be at least 8 characters.", values });

  const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length)
    return res.render("register", { error: "An account with that email already exists.", values });

  const id   = crypto.randomUUID();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.query(
    "INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)",
    [id, email.toLowerCase().trim(), display_name.trim(), hash]
  );

  req.session.user = { id, email, displayName: display_name.trim(), isAdmin: false };
  res.redirect("/dashboard");
});

// ── GET /login ────────────────────────────────────────────────────────────────
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null });
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.render("login", { error: "Email and password are required." });

  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (!rows.length)
    return res.render("login", { error: "Invalid email or password." });

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match)
    return res.render("login", { error: "Invalid email or password." });

  req.session.user = {
    id:          user.id,
    email:       user.email,
    displayName: user.display_name,
    isAdmin:     !!user.is_admin,
  };
  res.redirect("/dashboard");
});

// ── GET /logout ───────────────────────────────────────────────────────────────
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

module.exports = router;
