const STRINGS = {
  hi: {
    menu:
      "🙏 Namaste! Main Munshi hoon, aapka GST sahayak.\n\n" +
      "📄 Bill ki photo ya PDF bhejiye\n" +
      "📊 GSTR-2B file (CSV/Excel) bhejiye\n" +
      "✅ Sab bill bhejne ke baad 'check' likhiye\n" +
      "🌐 Angrezi ke liye 'english' likhiye",
    processing: "⏳ Aapka bill padh raha hoon, ek minute...",
    processingBaseline: "⏳ Aapki GSTR-2B file check kar raha hoon...",
    extractionFailed: "😟 Bill padhne mein gadbad ho gayi. Kripya saaf photo bhejiye ya phir try karein.",
    confirmInvoice: (inv) =>
      `📄 Bill mil gaya:\n` +
      `Vendor: ${inv.vendor_name}\n` +
      `GSTIN: ${inv.vendor_gstin}\n` +
      `Bill No: ${inv.invoice_number}\n` +
      `Date: ${inv.invoice_date}\n` +
      `Taxable Value: ₹${inv.taxable_value}\n` +
      `GST Rate: ${inv.gst_rate}%\n` +
      `GST Amount: ₹${inv.gst_amount}\n` +
      `HSN Code: ${inv.hsn_code}\n\n` +
      `Sahi hai? 'OK' likhiye ya jo galat hai woh batayein.`,
    invoiceConfirmed: (count) =>
      `✅ Bill save ho gaya. Ab tak ${count} bill mil gaye hain.\n` +
      `Aur bill bhejiye, ya GSTR-2B file bhejiye, ya 'check' likhiye.`,
    correctionApplied: "✏️ Theek kar diya. Dobara dekh lijiye:",
    baselineUploaded: (rows) => `✅ GSTR-2B file mil gayi (${rows} entries). Ab 'check' likhkar reconciliation shuru karein.`,
    baselineFailed: "😟 GSTR-2B file padhne mein gadbad ho gayi. Sahi CSV/Excel file bhejiye.",
    needInvoicesBeforeCheck: "⚠️ Pehle kam se kam ek bill bhejiye.",
    needBaselineBeforeCheck: "⚠️ Pehle apni GSTR-2B file bhejiye.",
    reconciling: "🔍 Aapke bills check kar raha hoon...",
    languageSwitched: "🌐 Theek hai, ab Hindi mein baat karenge.",
    unknown: "🤔 Samajh nahi paya. Bill ki photo bhejiye, GSTR-2B file bhejiye, ya 'check' likhiye.",
  },
  en: {
    menu:
      "🙏 Hi! I'm Munshi, your GST assistant.\n\n" +
      "📄 Send a photo or PDF of an invoice\n" +
      "📊 Send your GSTR-2B file (CSV/Excel)\n" +
      "✅ Once you've sent all bills, type 'check'\n" +
      "🌐 Type 'hindi' for Hindi",
    processing: "⏳ Reading your invoice, one moment...",
    processingBaseline: "⏳ Checking your GSTR-2B file...",
    extractionFailed: "😟 Couldn't read that invoice. Please send a clearer photo or try again.",
    confirmInvoice: (inv) =>
      `📄 Invoice processed:\n` +
      `Vendor: ${inv.vendor_name}\n` +
      `GSTIN: ${inv.vendor_gstin}\n` +
      `Invoice No: ${inv.invoice_number}\n` +
      `Date: ${inv.invoice_date}\n` +
      `Taxable Value: ₹${inv.taxable_value}\n` +
      `GST Rate: ${inv.gst_rate}%\n` +
      `GST Amount: ₹${inv.gst_amount}\n` +
      `HSN Code: ${inv.hsn_code}\n\n` +
      `Is this correct? Reply 'OK' or tell me what's wrong.`,
    invoiceConfirmed: (count) =>
      `✅ Saved. You've sent ${count} invoice(s) so far.\n` +
      `Send more invoices, your GSTR-2B file, or type 'check'.`,
    correctionApplied: "✏️ Updated. Please review again:",
    baselineUploaded: (rows) => `✅ GSTR-2B file received (${rows} entries). Type 'check' to run reconciliation.`,
    baselineFailed: "😟 Couldn't read that GSTR-2B file. Please send a valid CSV/Excel file.",
    needInvoicesBeforeCheck: "⚠️ Please send at least one invoice first.",
    needBaselineBeforeCheck: "⚠️ Please send your GSTR-2B file first.",
    reconciling: "🔍 Checking your invoices...",
    languageSwitched: "🌐 Okay, switching to English.",
    unknown: "🤔 I didn't get that. Send an invoice photo, your GSTR-2B file, or type 'check'.",
  },
};

const MISMATCH_LABEL = {
  hi: {
    missing_from_2b: "❌ GSTR-2B mein nahi hai",
    hsn_mismatch: "⚠️ HSN code galat hai",
    amount_diff: "⚠️ Amount match nahi karta",
    duplicate: "♻️ Duplicate bill",
  },
  en: {
    missing_from_2b: "❌ Missing from GSTR-2B",
    hsn_mismatch: "⚠️ Wrong HSN code",
    amount_diff: "⚠️ Amount mismatch",
    duplicate: "♻️ Duplicate invoice",
  },
};

function t(language) {
  return STRINGS[language] || STRINGS.hi;
}

function formatReconciliationResult(result, language) {
  const label = MISMATCH_LABEL[language] || MISMATCH_LABEL.hi;
  const lines = [`💰 ${result.headline}`, ""];

  if (result.explanations.length === 0) {
    lines.push(language === "en" ? "✅ No issues found — all invoices match!" : "✅ Koi gadbad nahi mili — sab bill sahi hain!");
  } else {
    for (const exp of result.explanations) {
      lines.push(`${label[exp.type] || exp.type} — ${exp.invoice_number} (${exp.vendor_name})`);
      lines.push(exp.text);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

function formatMismatchDetail(mismatch, language) {
  const label = (MISMATCH_LABEL[language] || MISMATCH_LABEL.hi)[mismatch.type] || mismatch.type;
  return `${label} — ${mismatch.invoice_number} (${mismatch.vendor_name})\n\n💰 Rs.${mismatch.rupee_impact}\n\n${mismatch.text}`;
}

module.exports = { t, formatReconciliationResult, formatMismatchDetail };
