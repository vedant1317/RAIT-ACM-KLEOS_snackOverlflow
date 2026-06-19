require("dotenv").config();

const express = require("express");
const { connectDb } = require("./config/db");
const smsRouter = require("./routes/sms");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/", smsRouter);

const PORT = process.env.PORT || 3002;

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] Munshi WhatsApp bot listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
