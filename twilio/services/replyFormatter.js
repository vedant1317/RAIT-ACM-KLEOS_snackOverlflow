const STRINGS = {
  hi: {
    menu:
      "🙏 Namaste! Main Munshi hoon, aapka GST sahayak.\n\n" +
      "📄 Bill ki photo ya PDF bhejiye\n" +
      "📊 GSTR-2B file (CSV/Excel) bhejiye\n" +
      "🎙️ Voice note bhi bhej sakte hain\n" +
      "✅ Sab bill bhejne ke baad 'check' boliye/likhiye\n" +
      "🌐 English ke liye 'english', Marathi ke liye 'marathi' likhiye",
    processing: "⏳ Aapka bill padh raha hoon, ek minute...",
    processingBaseline: "⏳ Aapki GSTR-2B file check kar raha hoon...",
    processingVoice: "🎙️ Aapka voice note sun raha hoon...",
    voiceFailed: "😟 Voice note samajh nahi paya. Kripya dobara bolkar bhejiye ya text mein likhiye.",
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
  mr: {
    menu:
      "🙏 Namaskar! Mi Munshi, tumcha GST madatnis.\n\n" +
      "📄 Bill cha photo kiwa PDF pathva\n" +
      "📊 GSTR-2B file (CSV/Excel) pathva\n" +
      "🎙️ Voice note suddha pathavu shakta\n" +
      "✅ Sagli bill pathavlyavar 'check' bola/liha\n" +
      "🌐 Hindi sathi 'hindi', English sathi 'english' liha",
    processing: "⏳ Tumcha bill vachat aahe, ek minute...",
    processingBaseline: "⏳ Tumchi GSTR-2B file tapasat aahe...",
    processingVoice: "🎙️ Tumcha voice note aikat aahe...",
    voiceFailed: "😟 Voice note samajla nahi. Kripya punha bola kiwa text madhye liha.",
    extractionFailed: "😟 Bill vachata ala nahi. Kripya clear photo pathva kiwa punha try kara.",
    confirmInvoice: (inv) =>
      `📄 Bill milala:\n` +
      `Vendor: ${inv.vendor_name}\n` +
      `GSTIN: ${inv.vendor_gstin}\n` +
      `Bill No: ${inv.invoice_number}\n` +
      `Date: ${inv.invoice_date}\n` +
      `Taxable Value: ₹${inv.taxable_value}\n` +
      `GST Rate: ${inv.gst_rate}%\n` +
      `GST Amount: ₹${inv.gst_amount}\n` +
      `HSN Code: ${inv.hsn_code}\n\n` +
      `Barobar aahe ka? 'OK' liha kiwa kay chuk aahe te sanga.`,
    invoiceConfirmed: (count) =>
      `✅ Bill save zala. Ataparyant ${count} bill milale aahet.\n` +
      `Ajun bill pathva, GSTR-2B file pathva, kiwa 'check' liha.`,
    correctionApplied: "✏️ Update kela. Punha check kara:",
    baselineUploaded: (rows) => `✅ GSTR-2B file milali (${rows} entries). Ata 'check' lihun reconciliation suru kara.`,
    baselineFailed: "😟 GSTR-2B file vachata ali nahi. Sahi CSV/Excel file pathva.",
    needInvoicesBeforeCheck: "⚠️ Adhi kamit kami ek bill pathva.",
    needBaselineBeforeCheck: "⚠️ Adhi tumchi GSTR-2B file pathva.",
    reconciling: "🔍 Tumchi bills tapasat aahe...",
    languageSwitched: "🌐 Theek aahe, ata Marathi madhye bolu.",
    unknown: "🤔 Samajla nahi. Bill cha photo pathva, GSTR-2B file pathva, kiwa 'check' liha.",
  },
  en: {
    menu:
      "🙏 Hi! I'm Munshi, your GST assistant.\n\n" +
      "📄 Send a photo or PDF of an invoice\n" +
      "📊 Send your GSTR-2B file (CSV/Excel)\n" +
      "🎙️ You can also send a voice note\n" +
      "✅ Once you've sent all bills, type or say 'check'\n" +
      "🌐 Type 'hindi' for Hindi or 'marathi' for Marathi",
    processing: "⏳ Reading your invoice, one moment...",
    processingBaseline: "⏳ Checking your GSTR-2B file...",
    processingVoice: "🎙️ Listening to your voice note...",
    voiceFailed: "😟 I couldn't understand that voice note. Please try again or type it out.",
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
  mr: {
    missing_from_2b: "❌ GSTR-2B madhye nahi",
    hsn_mismatch: "⚠️ HSN code chukicha",
    amount_diff: "⚠️ Amount match hot nahi",
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
    const clean = {
      en: "✅ No issues found — all invoices match!",
      hi: "✅ Koi gadbad nahi mili — sab bill sahi hain!",
      mr: "✅ Kahi gadbad nahi milali — sagli bill barobar aahet!",
    };
    lines.push(clean[language] || clean.hi);
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
