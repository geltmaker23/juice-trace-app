const http = require("http");
const { Pool } = require("pg");

const PORT = process.env.PORT;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const server = http.createServer(async (req, res) => {

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  if (req.url === "/") {
    try {
      const result = await pool.query("SELECT NOW()");
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("Database connected. Time: " + result.rows[0].now);
    } catch (err) {
      res.writeHead(500);
      return res.end("Database connection failed");
    }
  }

  res.writeHead(200);
  res.end("Server running");
});

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
