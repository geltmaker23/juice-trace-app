const express = require("express");

const app = express();

// Basic health check route
app.get("/", (req, res) => {
  res.status(200).send("Juice Trace API Running");
});

// Railway requires listening on process.env.PORT
const PORT = process.env.PORT || 3000;

// IMPORTANT: Do not bind to 127.0.0.1
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

