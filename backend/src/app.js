const express = require("express");
const cors = require("cors");
const executeRoute = require("./routes/execute");

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use("/execute", executeRoute);

app.get("/health", (req,res)=>res.json({ status:"ok" }));

module.exports = app;
