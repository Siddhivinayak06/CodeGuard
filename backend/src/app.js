const express = require("express");
const cors = require("cors");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const pool = require("./utils/db");

const executeRoute = require("./routes/execute");
const exportPdfRoute = require("./routes/exportPdf");
const authRoute = require("./routes/auth");

const app = express();

// Middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    store: new pgSession({ pool }),
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  })
);

// Routes
app.use("/execute", executeRoute);
app.use("/export-pdf", exportPdfRoute);
app.use("/auth", authRoute);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
