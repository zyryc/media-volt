const express  = require("express");
const crypto   = require("crypto");
const path     = require("path");
const fs       = require("fs");
const { pool } = require("../db");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();
const STORAGE_DIR = process.env.STORAGE_DIR || "vault";

// ── GET /admin/login ──────────────────────────────────────────────────────────
router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// ── POST /admin/login ─────────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || "admin123")) {
    return res.render("login", { error: "Invalid password. Try again." });
  }
  req.session.admin = true;
  res.redirect("/admin");
});

// ── GET /admin/logout ─────────────────────────────────────────────────────────
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");
});

// ── GET /admin — dashboard ────────────────────────────────────────────────────
router.get("/", adminAuth, async (req, res) => {
  const [clients] = await pool.query(
    "SELECT * FROM clients ORDER BY created_at DESC"
  );

  const [fileStats] = await pool.query(
    "SELECT COUNT(*) AS total, COALESCE(SUM(size),0) AS totalSize FROM files"
  );

  // count physical files as fallback
  let fileCount  = fileStats[0].total;
  let vaultBytes = Number(fileStats[0].totalSize);

  res.render("dashboard", {
    clients,
    fileCount,
    vaultSize: formatBytes(vaultBytes),
    flash: req.session.flash || null,
  });
  delete req.session.flash;
});

// ── POST /admin/clients — create ──────────────────────────────────────────────
router.post("/clients", adminAuth, async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });

  const id     = crypto.randomUUID();
  const token  = "mvt_" + crypto.randomBytes(24).toString("hex");
  const secret = "mvs_" + crypto.randomBytes(32).toString("hex");

  await pool.query(
    "INSERT INTO clients (id, name, token, secret) VALUES (?, ?, ?, ?)",
    [id, name, token, secret]
  );

  // Return full creds once — never stored in plaintext again after this
  res.json({ id, name, token, secret });
});

// ── DELETE /admin/clients/:id — revoke ────────────────────────────────────────
router.delete("/clients/:id", adminAuth, async (req, res) => {
  const [rows] = await pool.query("SELECT id FROM clients WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  await pool.query("DELETE FROM clients WHERE id = ?", [req.params.id]);
  res.json({ deleted: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)        return bytes + " B";
  if (bytes < 1048576)     return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824)  return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

module.exports = router;
