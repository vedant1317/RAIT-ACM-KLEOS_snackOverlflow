const mongoose = require("mongoose");

async function connectDb() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/munshi_whatsapp";
  await mongoose.connect(uri);
  console.log(`[db] connected to ${uri}`);
}

module.exports = { connectDb };
