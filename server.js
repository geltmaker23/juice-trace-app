const http = require("http");
const url = require("url");
const { Pool } = require("pg");

const PORT = process.env.PORT;

const htmlPage = `
<!DOCTYPE html>
<html>
<head>
  <title>Juice Trace</title>
  <style>
    body { font-family: Arial; padding: 40px; background: #f5f5f5; }
    input, button { padding: 10px; margin: 5px 0; width: 300px; font-size: 16px; }
    #results { margin-top: 20px; padding: 20px; background: white; border-radius: 6px; }
  </style>
</head>
<body>

  <h1>Juice Trace System</h1>

  <input type="text" id="product" placeholder="Product (Example: Orange Juice)">
  <br>
  <input type="text" id="code" placeholder="Code (Example: L1T5 2/26/26)">
  <br>
  <button onclick="trace()">Trace</button>

  <div id="results"></div>

  <script>
    async function trace() {
      const product = document.getElementById("product").value;
      const code = document.getElementById("code").value;

      const response = await fetch(
        '/trace?product=' + encodeURIComponent(product) +
        '&code=' + encodeURIComponent(code)
      );

      const data = await response.json();
      const resultsDiv = document.getElementById("results");

      if (!data || data.length === 0) {
        resultsDiv.innerHTML = "<strong>No results found.</strong>";
        return;
      }

      let html = "<h3>Trace Results:</h3>";

      data.forEach(item => {
        html += `
          <p>
            <strong>Ingredient:</strong> ${item.ingredient}<br>
            <strong>Supplier:</strong> ${item.supplier_name}<br>
            <strong>Supplier Lot:</strong> ${item.supplier_lot}<br>
            <strong>Grove Location:</strong> ${item.grove_location}<br>
            <strong>Production Date:</strong> ${item.production_date}
          </p>
          <hr>
        `;
      });

      resultsDiv.innerHTML = html;
    }
  </script>

</body>
</html>
`;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // HEALTH — no DB calls
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  // ROOT — no DB calls
  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(htmlPage);
  }

  // TRACE — DB only here
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
