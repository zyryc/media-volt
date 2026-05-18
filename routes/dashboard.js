const express  = require("express");
const crypto   = require("crypto");
const { pool } = require("../db");
const { userAuth } = require("../middleware/auth");

const router = express.Router();

function formatBytes(b) {
  if (b < 1024)       return b + " B";
  if (b < 1048576)    return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
}

// ── GET /dashboard ────────────────────────────────────────────────────────────
router.get("/", userAuth, async (req, res) => {
  const userId = req.session.user.id;

  const [tokens] = await pool.query(
    "SELECT * FROM tokens WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  const [stats] = await pool.query(
    `SELECT COUNT(*) AS fileCount, COALESCE(SUM(size), 0) AS totalSize
     FROM files WHERE user_id = ?`,
    [userId]
  );

  res.render("dashboard", {
    user:      req.session.user,
    tokens,
    fileCount: stats[0].fileCount,
    vaultSize: formatBytes(Number(stats[0].totalSize)),
  });
});

// ── POST /dashboard/tokens — create a new token ───────────────────────────────
router.post("/tokens", userAuth, async (req, res) => {
  const label = (req.body.label || "").trim();
  if (!label) return res.status(400).json({ error: "Label is required" });

  const id     = crypto.randomUUID();
  const token  = "mvt_" + crypto.randomBytes(24).toString("hex");
  const secret = "mvs_" + crypto.randomBytes(32).toString("hex");

  await pool.query(
    "INSERT INTO tokens (id, user_id, label, token, secret) VALUES (?, ?, ?, ?, ?)",
    [id, req.session.user.id, label, token, secret]
  );

  // return full creds once only
  res.json({ id, label, token, secret });
});

// ── DELETE /dashboard/tokens/:id — revoke a token ─────────────────────────────
router.delete("/tokens/:id", userAuth, async (req, res) => {
  // ensure token belongs to this user
  const [rows] = await pool.query(
    "SELECT id FROM tokens WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  await pool.query("DELETE FROM tokens WHERE id = ?", [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
