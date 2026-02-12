const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  IMPORTANT:
  Railway assigns the correct runtime port.
  We MUST listen only on process.env.PORT.
*/
const PORT = process.env.PORT;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ------------------ HEALTH CHECK ------------------ */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/* ------------------ ROOT ------------------ */
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).send("Database connected. Time: " + result.rows[0].now);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database connection failed");
  }
});

/* ------------------ TRACE ------------------ */
app.get("/trace", async (req, res) => {
  const { product, date } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT 
        s.name AS product,
        tb.production_date,
        tb.line,
        tb.tank_number,
        ti.ingredient,
        ti.supplier_name,
        ti.supplier_lot,
        ti.grove_location
      FROM sku s
      JOIN tank_batch tb ON tb.sku_id = s.id
      JOIN tank_input ti ON ti.tank_batch_id = tb.id
      WHERE s.name = $1
      AND tb.production_date = $2
      `,
      [product, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Trace failed");
  }
});

/* ------------------ START SERVER ------------------ */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
