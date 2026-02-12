const http = require("http");
const url = require("url");
const { Pool } = require("pg");

const PORT = process.env.PORT;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Juice Trace Server Running");
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
