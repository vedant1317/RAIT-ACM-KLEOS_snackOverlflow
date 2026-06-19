const axios = require("axios");

async function downloadMedia(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    auth: {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN,
    },
  });
  return {
    buffer: Buffer.from(response.data),
    contentType: response.headers["content-type"] || "application/octet-stream",
  };
}

module.exports = { downloadMedia };
