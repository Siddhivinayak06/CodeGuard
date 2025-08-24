// src/utils/db.js
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "db.slnvvhlbhzmmqbuwqokg.supabase.co",
  database: process.env.DB_NAME || "postgres",
  password: process.env.DB_PASS || "Codegaurd@123",
  port: process.env.DB_PORT || 5432,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

module.exports = pool;
