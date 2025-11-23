const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const executeRoute = require("./routes/execute");

const app = express();

// Security Headers
app.use(helmet());

// Compression
app.use(compression());

// Rate Limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use("/execute", executeRoute);
app.use("/ai", require("./routes/ai"));

app.get("/health", (req, res) => res.json({ status: "ok" }));

module.exports = app;
