const express = require("express");
const { Pool } = require("pg");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", async (req, res) => {
  try {
    // Simple test query
    const result = await pool.query("SELECT NOW()");
    res.send("Database connected. Time: " + result.rows[0].now);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database connection failed");
  }
});
app.get("/setup", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sku (
        id SERIAL PRIMARY KEY,
        name TEXT,
        size TEXT,
        shelf_life_days INTEGER
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tank_batch (
        id SERIAL PRIMARY KEY,
        sku_id INTEGER REFERENCES sku(id),
        production_date DATE,
        line INTEGER,
        tank_number INTEGER
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tank_input (
        id SERIAL PRIMARY KEY,
        tank_batch_id INTEGER REFERENCES tank_batch(id),
        supplier_name TEXT,
        supplier_lot TEXT,
        ingredient TEXT,
        grove_location TEXT
      );
    `);

    res.send("Tables created");
  } catch (err) {
    console.error(err);
    res.status(500).send("Setup failed");
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
