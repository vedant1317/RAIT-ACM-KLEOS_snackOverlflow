const twilio = require("twilio");

function client() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const MISMATCH_EMOJI = {
  missing_from_2b: "❌",
  hsn_mismatch: "⚠️",
  amount_diff: "⚠️",
  duplicate: "♻️",
};

const LIST_BUTTON_LABEL = { hi: "Bill dekhiye", en: "View bills" };

// Twilio's WhatsApp list-picker tops out at 10 rows.
const MAX_ITEMS = 10;

/**
 * Creates a one-off Content API "list-picker" template for this
 * reconciliation result and returns its SID, ready to send via
 * messages.create({ contentSid }). Tapping a row sends the row's `id`
 * (the invoice number) back as the next inbound message body, which the
 * webhook uses to look up and reply with that mismatch's full detail.
 */
async function createMismatchListContent(headline, explanations, language) {
  const items = explanations.slice(0, MAX_ITEMS).map((exp) => ({
    id: exp.invoice_number,
    item: `${MISMATCH_EMOJI[exp.type] || ""} ${exp.invoice_number}`.trim(),
    description: `Rs.${exp.rupee_impact} - ${exp.vendor_name}`,
  }));

  const content = await client().content.v1.contents.create({
    friendlyName: `munshi_reconcile_${Date.now()}`,
    language: language === "en" ? "en" : "hi",
    types: {
      "twilio/list-picker": {
        body: headline,
        button: LIST_BUTTON_LABEL[language] || LIST_BUTTON_LABEL.hi,
        items,
      },
    },
  });
  return content.sid;
}

module.exports = { createMismatchListContent };
