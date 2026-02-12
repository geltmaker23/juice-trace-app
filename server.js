const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  Railway assigns the runtime port automatically.
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

/* ------------------ ROOT (DB TEST) ------------------ */
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).send("Database connected. Time: " + result.rows[0].now);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database connection failed");
  }
});

/* ------------------ TRACE ENGINE ------------------ */
app.get("/trace", async (req, res) => {
  const { product, code } = req.query;

  if (!product || !code) {
    return res.status(400).send("Missing product or code");
  }

  try {
    // Expected format: L1T5 2/26/26
    const parts = code.trim().split(" ");
    if (parts.length !== 2) {
      return res.status(400).send("Invalid code format. Use L1T5 2/26/26");
    }

    const ltPart = parts[0]; // L1T5
    const datePart = parts[1]; // 2/26/26

    // Extract line and tank
    if (!ltPart.startsWith("L") || !ltPart.includes("T")) {
      return res.status(400).send("Invalid L/T format");
    }

    const line = parseInt(ltPart.split("T")[0].replace("L", ""));
    const tank = parseInt(ltPart.split("T")[1]);

    if (isNaN(line) || isNaN(tank)) {
      return res.status(400).send("Invalid line or tank number");
    }

    // Convert MM/DD/YY to ISO date
    const [month, day, yearShort] = datePart.split("/");
    const year = "20" + yearShort;
    const expirationDate = new Date(`${year}-${month}-${day}`);

    if (isNaN(expirationDate.getTime())) {
      return res.status(400).send("Invalid date format");
    }

    // Get SKU info
    const skuResult = await pool.query(
      "SELECT id, shelf_life_days FROM sku WHERE name = $1",
      [product]
    );

    if (skuResult.rows.length === 0) {
      return res.status(404).send("Product not found");
    }

    const skuId = skuResult.rows[0].id;
    const shelfLife = skuResult.rows[0].shelf_life_days;

    // Calculate production date
    const productionDate = new Date(expirationDate);
    productionDate.setDate(productionDate.getDate() - shelfLife);

    const productionDateString = productionDate
      .toISOString()
      .split("T")[0];

    // Query matching tank batch + fruit
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
      WHERE s.id = $1
      AND tb.production_date = $2
      AND tb.line = $3
      AND tb.tank_number = $4
      `,
      [skuId, productionDateString, line, tank]
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
