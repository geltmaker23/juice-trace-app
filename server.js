const http = require("http");
const url = require("url");
const { Pool } = require("pg");

const PORT = process.env.PORT;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  /* ------------------ HEALTH ------------------ */
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  /* ------------------ ROOT ------------------ */
  if (pathname === "/") {
    try {
      const result = await pool.query("SELECT NOW()");
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("Database connected. Time: " + result.rows[0].now);
    } catch (err) {
      res.writeHead(500);
      return res.end("Database connection failed");
    }
  }

  /* ------------------ TRACE ------------------ */
  if (pathname === "/trace") {
    const { product, code } = query;

    if (!product || !code) {
      res.writeHead(400);
      return res.end("Missing product or code");
    }

    try {
      // Expect format: L1T5 2/26/26
      const parts = code.trim().split(" ");
      if (parts.length !== 2) {
        res.writeHead(400);
        return res.end("Invalid code format");
      }

      const ltPart = parts[0];
      const datePart = parts[1];

      const line = parseInt(ltPart.split("T")[0].replace("L", ""));
      const tank = parseInt(ltPart.split("T")[1]);

      const [month, day, yearShort] = datePart.split("/");
      const year = "20" + yearShort;
      const expirationDate = new Date(`${year}-${month}-${day}`);

      // Get SKU shelf life
      const skuResult = await pool.query(
        "SELECT id, shelf_life_days FROM sku WHERE name = $1",
        [product]
      );

      if (skuResult.rows.length === 0) {
        res.writeHead(404);
        return res.end("Product not found");
      }

      const skuId = skuResult.rows[0].id;
      const shelfLife = skuResult.rows[0].shelf_life_days;

      // Calculate production date
      const productionDate = new Date(expirationDate);
      productionDate.setDate(productionDate.getDate() - shelfLife);
      const productionDateString = productionDate.toISOString().split("T")[0];

      // Query tank + fruit
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

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result.rows));

    } catch (err) {
      console.error(err);
      res.writeHead(500);
      return res.end("Trace failed");
    }
  }

  /* ------------------ DEFAULT ------------------ */
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
