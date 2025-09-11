const app = require("./app");
const initDb = require("./utils/initDb");

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initDb();
  console.log(`Backend server running on http://localhost:${PORT}`);
});
