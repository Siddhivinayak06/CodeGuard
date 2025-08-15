const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const executeRoute = require("./routes/execute");
const exportPdfRoute = require("./routes/exportPdf");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

app.use("/execute", executeRoute);
app.use("/export-pdf", exportPdfRoute);

module.exports = app;
