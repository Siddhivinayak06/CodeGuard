// src/utils/db.js
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "codeguard",
  password: process.env.DB_PASS || "password",
  port: process.env.DB_PORT || 5432,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

module.exports = pool;
