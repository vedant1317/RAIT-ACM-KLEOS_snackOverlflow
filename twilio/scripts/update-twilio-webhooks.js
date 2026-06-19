/*
 * Run after every `ngrok http <port>` restart (ngrok free tier gives a new
 * URL each time). Fetches the current tunnel URL from ngrok's local API and
 * writes it into .env as NGROK_URL.
 *
 * IMPORTANT: Twilio's WhatsApp *Sandbox* inbound webhook has no public REST
 * API — it can only be set via Console (Messaging -> Try it out -> Sandbox
 * Settings). This script cannot push it there for you; it prints the exact
 * URL to paste in instead. If you later move off the sandbox to a purchased
 * WhatsApp-enabled number, that number's webhook IS settable via the
 * IncomingPhoneNumbers API and this script could be extended to do it.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const ENV_PATH = path.join(__dirname, "..", ".env");

function fetchNgrokUrl() {
  return new Promise((resolve, reject) => {
    http
      .get("http://127.0.0.1:4040/api/tunnels", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const httpsTunnel = parsed.tunnels.find((t) => t.proto === "https");
            if (!httpsTunnel) return reject(new Error("No https ngrok tunnel found"));
            resolve(httpsTunnel.public_url);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function updateEnvFile(ngrokUrl) {
  let content = fs.readFileSync(ENV_PATH, "utf8");
  if (content.includes("NGROK_URL=")) {
    content = content.replace(/NGROK_URL=.*/g, `NGROK_URL=${ngrokUrl}`);
  } else {
    content += `\nNGROK_URL=${ngrokUrl}\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

async function main() {
  const argUrl = process.argv[2];
  const ngrokUrl = argUrl || (await fetchNgrokUrl());

  updateEnvFile(ngrokUrl);

  const webhookUrl = `${ngrokUrl}/sms`;
  console.log(`\n[update-twilio-webhooks] NGROK_URL updated in .env: ${ngrokUrl}`);
  console.log(`\nNow paste this into Twilio Console -> Messaging -> Try it out -> Sandbox Settings`);
  console.log(`-> "WHEN A MESSAGE COMES IN" (method: HTTP POST):\n`);
  console.log(`  ${webhookUrl}\n`);

  try {
    const { execSync } = require("child_process");
    execSync(`printf '%s' "${webhookUrl}" | pbcopy`);
    console.log("(copied to clipboard)\n");
  } catch {
    // pbcopy not available — not fatal, the printed URL above is enough.
  }
}

main().catch((err) => {
  console.error("[update-twilio-webhooks] failed:", err.message);
  console.error("Is ngrok running? Start it with: ngrok http " + (process.env.PORT || 3002));
  process.exit(1);
});
