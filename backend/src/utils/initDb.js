// src/utils/initDb.js
const pool = require("./db");

async function initDb() {
  try {
    // Create users table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Database initialized (users table ready)");
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    process.exit(1);
  }
}

module.exports = initDb;
