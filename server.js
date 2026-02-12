const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.get("/", (req, res) => {
  res.send("Juice Trace API Running");
});

app.get("/trace", async (req, res) => {
  const { product, code } = req.query;

  try {
    const result = await pool.query(
      `SELECT supplier_name, supplier_lot, grove_location
       FROM production
       WHERE product = $1 AND code_date = $2`,
      [product, code]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

