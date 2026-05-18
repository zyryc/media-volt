const { pool } = require("../db");

// ── API token auth — resolves token → user, scopes to that user ───────────────
async function apiAuth(req, res, next) {
  const token = req.headers["x-token"];
  if (!token) return res.status(403).json({ error: "Unauthorized" });

  const [rows] = await pool.query(
    `SELECT t.*, u.id AS owner_id, u.email, u.display_name
     FROM tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = ?`,
    [token]
  );

  if (!rows.length) return res.status(403).json({ error: "Unauthorized" });

  pool.query("UPDATE tokens SET last_used = NOW() WHERE id = ?", [rows[0].id]);

  req.token = rows[0];          // full token row
  req.authUser = {              // owning user (scoped context)
    id:          rows[0].owner_id,
    email:       rows[0].email,
    displayName: rows[0].display_name,
  };
  next();
}

// ── Session auth — regular logged-in user ─────────────────────────────────────
function userAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect("/login");
}

// ── Session auth — admin only ─────────────────────────────────────────────────
function adminAuth(req, res, next) {
  if (req.session && req.session.user && req.session.user.isAdmin) return next();
  res.status(403).render("403", { user: req.session.user || null });
}

module.exports = { apiAuth, userAuth, adminAuth };
