const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_DIR = process.env.STORAGE_DIR || "vault";

// ensure storage exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
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

app.get("/", (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Media Vault</title>
        <style>
          body {
            background: #0f0f0f;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            height: 100vh;
            justify-content: center;
            align-items: center;
            flex-direction: column;
          }
          h1 {
            font-size: 48px;
            margin: 0;
          }
          p {
            opacity: 0.6;
          }
        </style>
      </head>
      <body>
        <h1>MEDIA VAULT</h1>
        <p>Storage API is running</p>
      </body>
    </html>
  `);
});

app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head>
        <title>404</title>
        <style>
          body {
            background: black;
            color: red;
            font-family: monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            flex-direction: column;
          }
          h1 {
            font-size: 80px;
            margin: 0;
          }
          p {
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <h1>404</h1>
        <p>Route not found</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Media Vault running on port ${PORT}`);
});
