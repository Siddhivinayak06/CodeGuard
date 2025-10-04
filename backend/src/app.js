// app.js
const express = require("express");
const cors = require("cors");
const executeRoute = require("./routes/execute");
const exportPdfRoute = require("./routes/exportPdf");

const app = express();

// ✅ Enable CORS for all routes
app.use(cors({
  origin: "http://localhost:3000",   // frontend origin
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true,
}));

// ✅ Parse JSON
app.use(express.json({ limit: "5mb" }));

// Routes
app.use("/execute", executeRoute);
app.use("/export-pdf", exportPdfRoute);

// Health check
app.get("/health", (req,res)=>res.json({ status:"ok" }));

module.exports = app;
