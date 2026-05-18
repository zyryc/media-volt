const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { apiAuth } = require("../middleware/auth");

const router = express.Router();
const STORAGE_DIR = process.env.STORAGE_DIR || "vault";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /upload ──────────────────────────────────────────────────────────────
router.post("/upload", apiAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  const fileId = path.parse(req.file.filename).name;

  await pool.query(
    `INSERT INTO files (id, user_id, token_id, filename, original, size, mime)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fileId,
      req.authUser.id,
      req.token.id,
      req.file.filename,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
    ],
  );

  res.json({
    id: req.file.filename,
    url: `/files/${req.file.filename}`,
    size: req.file.size,
    uploader: req.authUser.displayName,
  });
});

// ── GET /files/:filename ─────────────────────────────────────────────────────
router.get("/files/:filename", async (req, res) => {
  const filePath = path.join(STORAGE_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Not found" });
  }

  res.sendFile(path.resolve(filePath));
});

// ── HEAD /files/:filename ────────────────────────────────────────────────────
router.head("/files/:filename", async (req, res) => {
  const filePath = path.join(STORAGE_DIR, req.params.filename);

  fs.existsSync(filePath) ? res.sendStatus(200) : res.sendStatus(404);
});

// ── DELETE /files/:filename ───────────────────────────────────────────────────
router.delete("/files/:filename", apiAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT filename FROM files WHERE filename = ? AND user_id = ?",
    [req.params.filename, req.authUser.id],
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const filePath = path.join(STORAGE_DIR, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await pool.query("DELETE FROM files WHERE filename = ?", [
    req.params.filename,
  ]);
  res.json({ deleted: true });
});

// At the end of routes/api.js
console.log("API Routes registered:");
router.stack.forEach((layer) => {
  if (layer.route) {
    console.log(`${Object.keys(layer.route.methods)} ${layer.route.path}`);
  }
});

module.exports = router;
