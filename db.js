const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  port:               process.env.DB_PORT      || 3306,
  user:               process.env.DB_USER      || "root",
  password:           process.env.DB_PASSWORD  || "",
  database:           process.env.DB_NAME      || "media_vault",
  waitForConnections: true,
  connectionLimit:    10,
  timezone:           "Z",
});

async function migrate() {
  const c = await pool.getConnection();
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            VARCHAR(36)  NOT NULL PRIMARY KEY,
        email         VARCHAR(255) NOT NULL UNIQUE,
        display_name  VARCHAR(120) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await c.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        label      VARCHAR(120) NOT NULL,
        token      VARCHAR(80)  NOT NULL UNIQUE,
        secret     VARCHAR(100) NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used  DATETIME     NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await c.query(`
      CREATE TABLE IF NOT EXISTS files (
        id          VARCHAR(36)  NOT NULL PRIMARY KEY,
        user_id     VARCHAR(36)  NOT NULL,
        token_id    VARCHAR(36)  NOT NULL,
        filename    VARCHAR(255) NOT NULL,
        original    VARCHAR(255) NOT NULL,
        size        INT UNSIGNED NOT NULL,
        mime        VARCHAR(100) NOT NULL,
        uploaded_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
        FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✔ Database tables ready");
  } finally {
    c.release();
  }
}

module.exports = { pool, migrate };
