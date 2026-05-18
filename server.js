const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const compression = require("compression");

require("dotenv").config();

const { migrate } = require("./db");
const authRouter = require("./routes/auth");
const dashboardRouter = require("./routes/dashboard");
const apiRouter = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_DIR = process.env.STORAGE_DIR || "vault";

// ── Ensure storage exists ────────────────────────────────────────────────────
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());

// ── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ── Trust proxy (important behind nginx/cloudflare) ─────────────────────────
app.set("trust proxy", 1);

// ── View engine ──────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Debug logger ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Static ───────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Sessions ─────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/", apiRouter);

// ── Home ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.redirect(req.session.user ? "/dashboard" : "/login");
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render("404");
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error",
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  await migrate();

  app.listen(PORT, () => {
    console.log(`✔ Media Vault running on http://localhost:${PORT}`);
  });
})();
