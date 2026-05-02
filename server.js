const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const STORAGE_DIR = process.env.STORAGE_DIR || "vault";

// ensure storage exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR);
}

// simple auth
function auth(req, res, next) {
  const token = req.headers["x-token"];
  if (token !== process.env.API_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

// storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// upload file
app.post("/upload", auth, upload.single("file"), (req, res) => {
  const fileUrl = `/files/${req.file.filename}`;

  res.json({
    id: req.file.filename,
    url: fileUrl,
  });
});

// serve files
app.use("/files", express.static(STORAGE_DIR));

// check file
app.head("/files/:id", (req, res) => {
  const filePath = path.join(STORAGE_DIR, req.params.id);
  if (fs.existsSync(filePath)) return res.sendStatus(200);
  return res.sendStatus(404);
});

// delete file
app.delete("/files/:id", auth, (req, res) => {
  const filePath = path.join(STORAGE_DIR, req.params.id);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Not found" });
  }

  fs.unlinkSync(filePath);
  res.json({ deleted: true });
});

app.listen(3000, () => {
  console.log("Media Vault running on port 3000");
});
