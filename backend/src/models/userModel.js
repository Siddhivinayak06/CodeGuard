// src/models/userModel.js
const pool = require("../utils/db");
const bcrypt = require("bcryptjs");

async function createUser(name, email, password) {
  const hashed = await bcrypt.hash(password, 10);
  const query = `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, name, email
  `;
  const values = [name, email, hashed];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function findUserByEmail(email) {
  const query = `SELECT * FROM users WHERE email = $1`;
  const result = await pool.query(query, [email]);
  return result.rows[0]; // includes id, name, email, password
}

module.exports = { createUser, findUserByEmail };