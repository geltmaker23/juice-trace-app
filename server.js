const http = require("http");
const url = require("url");
const { Pool } = require("pg");

const PORT = process.env.PORT;

const server = http.createServer(async (req, res) => {

  // CORS HEADERS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // HEALTH
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  // ROOT
  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Juice Trace Server Running");
  }

  // PRODUCTS LIST
  if (pathname === "/products") {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const result = await pool.query("SELECT name FROM sku ORDER BY name");

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result.rows));

    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify([]));
    }
  }
  
  // TRACE
  if (pathname === "/trace") {
    const { product, code } = query;

    if (!product || !code) {
      res.writeHead(400);
      return res.end(JSON.stringify([]));
    }

    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const parts = code.trim().split(" ");
      const ltPart = parts[0];
      const datePart = parts[1];

      const line = parseInt(ltPart.split("T")[0].replace("L", ""));
      const tank = parseInt(ltPart.split("T")[1]);

      const [month, day, yearShort] = datePart.split("/");
      const year = "20" + yearShort;
      const expirationDate = new Date(`${year}-${month}-${day}`);

      const skuResult = await pool.query(
        "SELECT id, shelf_life_days FROM sku WHERE name = $1",
        [product]
      );

      if (skuResult.rows.length === 0) {
        res.writeHead(404);
        return res.end(JSON.stringify([]));
      }

      const skuId = skuResult.rows[0].id;
      const shelfLife = skuResult.rows[0].shelf_life_days;

      const productionDate = new Date(expirationDate);
      productionDate.setDate(productionDate.getDate() - shelfLife);
      const productionDateString = productionDate.toISOString().split("T")[0];

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
      return res.end(JSON.stringify([]));
    }
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
