const STRINGS = {
  hi: {
    menu:
      "🙏 Namaste! Main Munshi hoon, aapka GST sahayak.\n\n" +
      "📄 Bill ki photo ya PDF bhejiye\n" +
      "📊 GSTR-2B file (CSV/Excel/PDF) bhejiye\n" +
      "🎙️ Voice note bhi bhej sakte hain\n" +
      "✅ Sab bill bhejne ke baad 'check' boliye/likhiye\n" +
      "📊 'status' likhiye summary dekhne ke liye\n" +
      "🌐 English ke liye 'english', Marathi ke liye 'marathi' likhiye",
    processing: "⏳ Aapka bill padh raha hoon, ek minute...",
    processingBaseline: "⏳ Aapki GSTR-2B file check kar raha hoon...",
    processingVoice: "🎙️ Aapka voice note sun raha hoon...",
    voiceFailed: "😟 Voice note samajh nahi paya. Kripya dobara bolkar bhejiye ya text mein likhiye.",
    extractionFailed:
      "😟 Bill padhne mein gadbad ho gayi. Roshni mein, seedha, aur poora bill frame mein rakh kar dobara photo bhejiye.",
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
    needsReviewIntro: (reasons) =>
      `🔎 Yeh fields thoda check kar lijiye (photo unclear ho sakti hai):\n` +
      reasons.map((r) => `• ${r}`).join("\n") +
      `\n`,
    invoiceConfirmed: (count) =>
      `✅ Bill save ho gaya. Ab tak ${count} bill mil gaye hain.\n` +
      `Aur bill bhejiye, ya GSTR-2B file bhejiye, ya 'check' likhiye.`,
    invoiceAutoSaved: (count) => `✅ Bill achhi quality ka tha, seedha save kar diya. Ab tak ${count} bill.`,
    correctionApplied: "✏️ Theek kar diya. Dobara dekh lijiye:",
    baselineUploaded: (rows) =>
      `✅ GSTR-2B file mil gayi (${rows} entries). Ab 'check' likhkar reconciliation shuru karein.`,
    baselineFailed: "😟 GSTR-2B file padhne mein gadbad ho gayi. Sahi CSV/Excel/PDF file bhejiye.",
    needInvoicesBeforeCheck: "⚠️ Pehle kam se kam ek bill bhejiye.",
    needBaselineBeforeCheck: "⚠️ Pehle apni GSTR-2B file bhejiye.",
    reconciling: "🔍 Aapke bills check kar raha hoon...",
    languageSwitched: "🌐 Theek hai, ab Hindi mein baat karenge.",
    unknown: "🤔 Samajh nahi paya. Bill ki photo bhejiye, GSTR-2B file bhejiye, ya 'check' likhiye.",
    mediaTypeQuestion:
      "📄 Yeh PDF bill hai ya aapki GSTR-2B file? 'bill' ya '1' likhiye bill ke liye, 'gstr2b' ya '2' likhiye GSTR-2B ke liye.",
    mediaTypeUnclear: "🤔 'bill' ya 'gstr2b' likhiye — pata nahi chala yeh kya file hai.",
    batchSummary: (saved, needReview) =>
      needReview > 0
        ? `✅ ${saved} bill save ho gaye, ${needReview} ko review chahiye. Pehla bill dekhiye:`
        : `✅ Sabhi ${saved} bill save ho gaye — sab achhi quality ke the!`,
    batchComplete: (saved) => `🎉 Sab review ho gaya. Is batch mein total ${saved} bill save hue.`,
    queueAdded: (remaining) => `📥 Yeh bill bhi review queue mein daal diya. Abhi ${remaining} bill review baaki hain.`,
    statusCard: (s) =>
      `📊 Aapka Status:\n` +
      `📄 Bill uploaded: ${s.invoices_uploaded}\n` +
      `📊 GSTR-2B: ${s.has_2b ? "✅ Mil gayi" : "❌ Abhi nahi bheji"}\n` +
      `💰 ITC at risk: ₹${s.itc_at_risk}\n` +
      `⚠️ Open issues: ${s.issues_open}\n` +
      (s.top_supplier ? `🏷️ Sabse zyada gadbad: ${s.top_supplier}\n` : "") +
      `👉 Next step: ${s.next_action}`,
    remindUsage: "✍️ Kaunse bill ke liye? 'remind INV-123' jaise likhiye.",
    remindNotFound: (inv) => `😟 Mujhe bill ${inv} nahi mila aapke last check mein. Pehle 'check' likhiye.`,
    remindIntro: "📨 Yeh message supplier ko forward kar sakte hain:\n\n",
    qnaNoData: "🤔 Abhi mere paas koi data nahi hai. Pehle bill aur GSTR-2B bhejiye, ya 'check' likhiye.",
  },
  mr: {
    menu:
      "🙏 Namaskar! Mi Munshi, tumcha GST madatnis.\n\n" +
      "📄 Bill cha photo kiwa PDF pathva\n" +
      "📊 GSTR-2B file (CSV/Excel/PDF) pathva\n" +
      "🎙️ Voice note suddha pathavu shakta\n" +
      "✅ Sagli bill pathavlyavar 'check' bola/liha\n" +
      "📊 'status' liha summary baghnyasathi\n" +
      "🌐 Hindi sathi 'hindi', English sathi 'english' liha",
    processing: "⏳ Tumcha bill vachat aahe, ek minute...",
    processingBaseline: "⏳ Tumchi GSTR-2B file tapasat aahe...",
    processingVoice: "🎙️ Tumcha voice note aikat aahe...",
    voiceFailed: "😟 Voice note samajla nahi. Kripya punha bola kiwa text madhye liha.",
    extractionFailed:
      "😟 Bill vachata ala nahi. Changlya prakashat, saral dharun, ani pura bill dakhun punha photo pathva.",
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
    needsReviewIntro: (reasons) =>
      `🔎 He fields thode check kara (photo unclear asu shakte):\n` + reasons.map((r) => `• ${r}`).join("\n") + `\n`,
    invoiceConfirmed: (count) =>
      `✅ Bill save zala. Ataparyant ${count} bill milale aahet.\n` +
      `Ajun bill pathva, GSTR-2B file pathva, kiwa 'check' liha.`,
    invoiceAutoSaved: (count) => `✅ Bill changla clear hota, lagech save kela. Ataparyant ${count} bill.`,
    correctionApplied: "✏️ Update kela. Punha check kara:",
    baselineUploaded: (rows) => `✅ GSTR-2B file milali (${rows} entries). Ata 'check' lihun reconciliation suru kara.`,
    baselineFailed: "😟 GSTR-2B file vachata ali nahi. Sahi CSV/Excel/PDF file pathva.",
    needInvoicesBeforeCheck: "⚠️ Adhi kamit kami ek bill pathva.",
    needBaselineBeforeCheck: "⚠️ Adhi tumchi GSTR-2B file pathva.",
    reconciling: "🔍 Tumchi bills tapasat aahe...",
    languageSwitched: "🌐 Theek aahe, ata Marathi madhye bolu.",
    unknown: "🤔 Samajla nahi. Bill cha photo pathva, GSTR-2B file pathva, kiwa 'check' liha.",
    mediaTypeQuestion:
      "📄 He PDF bill aahe ki tumchi GSTR-2B file? 'bill' kiwa '1' liha bill sathi, 'gstr2b' kiwa '2' liha GSTR-2B sathi.",
    mediaTypeUnclear: "🤔 'bill' kiwa 'gstr2b' liha — he kontli file aahe samajla nahi.",
    batchSummary: (saved, needReview) =>
      needReview > 0
        ? `✅ ${saved} bill save zale, ${needReview} review karaycha aahe. Pahila bill baga:`
        : `✅ Sagle ${saved} bill save zale — sagle changle hote!`,
    batchComplete: (saved) => `🎉 Sagla review zala. Ya batch madhe total ${saved} bill save zale.`,
    queueAdded: (remaining) => `📥 He bill suddha review queue madhe takla. Atta ${remaining} bill review baaki aahet.`,
    statusCard: (s) =>
      `📊 Tumcha Status:\n` +
      `📄 Bill uploaded: ${s.invoices_uploaded}\n` +
      `📊 GSTR-2B: ${s.has_2b ? "✅ Milali" : "❌ Ajun pathavli nahi"}\n` +
      `💰 ITC at risk: ₹${s.itc_at_risk}\n` +
      `⚠️ Open issues: ${s.issues_open}\n` +
      (s.top_supplier ? `🏷️ Sarvadhik gadbad: ${s.top_supplier}\n` : "") +
      `👉 Next step: ${s.next_action}`,
    remindUsage: "✍️ Konatya bill sathi? 'remind INV-123' asa liha.",
    remindNotFound: (inv) => `😟 Mala bill ${inv} sapadla nahi tumchya last check madhe. Adhi 'check' liha.`,
    remindIntro: "📨 Ha message supplier la forward karu shakta:\n\n",
    qnaNoData: "🤔 Atta majhyakade kahi data nahi. Adhi bill ani GSTR-2B pathva, kiwa 'check' liha.",
  },
  en: {
    menu:
      "🙏 Hi! I'm Munshi, your GST assistant.\n\n" +
      "📄 Send a photo or PDF of an invoice\n" +
      "📊 Send your GSTR-2B file (CSV/Excel/PDF)\n" +
      "🎙️ You can also send a voice note\n" +
      "✅ Once you've sent all bills, type or say 'check'\n" +
      "📊 Type 'status' for a quick summary\n" +
      "🌐 Type 'hindi' for Hindi or 'marathi' for Marathi",
    processing: "⏳ Reading your invoice, one moment...",
    processingBaseline: "⏳ Checking your GSTR-2B file...",
    processingVoice: "🎙️ Listening to your voice note...",
    voiceFailed: "😟 I couldn't understand that voice note. Please try again or type it out.",
    extractionFailed:
      "😟 Couldn't read that invoice. Please retake the photo in good light, straight-on, with the whole bill in frame.",
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
    needsReviewIntro: (reasons) =>
      `🔎 Please double-check these (the photo may have been unclear):\n` +
      reasons.map((r) => `• ${r}`).join("\n") +
      `\n`,
    invoiceConfirmed: (count) =>
      `✅ Saved. You've sent ${count} invoice(s) so far.\n` +
      `Send more invoices, your GSTR-2B file, or type 'check'.`,
    invoiceAutoSaved: (count) => `✅ That one was high-confidence, saved automatically. ${count} invoice(s) so far.`,
    correctionApplied: "✏️ Updated. Please review again:",
    baselineUploaded: (rows) => `✅ GSTR-2B file received (${rows} entries). Type 'check' to run reconciliation.`,
    baselineFailed: "😟 Couldn't read that GSTR-2B file. Please send a valid CSV/Excel/PDF file.",
    needInvoicesBeforeCheck: "⚠️ Please send at least one invoice first.",
    needBaselineBeforeCheck: "⚠️ Please send your GSTR-2B file first.",
    reconciling: "🔍 Checking your invoices...",
    languageSwitched: "🌐 Okay, switching to English.",
    unknown: "🤔 I didn't get that. Send an invoice photo, your GSTR-2B file, or type 'check'.",
    mediaTypeQuestion:
      "📄 Is this PDF a bill, or your GSTR-2B file? Reply 'bill' or '1' for a bill, 'gstr2b' or '2' for GSTR-2B.",
    mediaTypeUnclear: "🤔 Reply 'bill' or 'gstr2b' — I'm not sure which kind of file this is.",
    batchSummary: (saved, needReview) =>
      needReview > 0
        ? `✅ ${saved} bill(s) saved, ${needReview} need review. Here's the first one:`
        : `✅ All ${saved} bill(s) saved — they all looked good!`,
    batchComplete: (saved) => `🎉 All reviewed. ${saved} bill(s) saved in this batch.`,
    queueAdded: (remaining) => `📥 Added that one to your review queue too. ${remaining} bill(s) left to review.`,
    statusCard: (s) =>
      `📊 Your Status:\n` +
      `📄 Invoices uploaded: ${s.invoices_uploaded}\n` +
      `📊 GSTR-2B: ${s.has_2b ? "✅ Received" : "❌ Not sent yet"}\n` +
      `💰 ITC at risk: ₹${s.itc_at_risk}\n` +
      `⚠️ Open issues: ${s.issues_open}\n` +
      (s.top_supplier ? `🏷️ Top problem supplier: ${s.top_supplier}\n` : "") +
      `👉 Next step: ${s.next_action}`,
    remindUsage: "✍️ Which invoice? Type something like 'remind INV-123'.",
    remindNotFound: (inv) => `😟 I couldn't find invoice ${inv} in your last check. Type 'check' first.`,
    remindIntro: "📨 You can forward this message to your supplier:\n\n",
    qnaNoData: "🤔 I don't have any data yet. Please send your bills and GSTR-2B file, or type 'check'.",
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

function formatConfirmPrompt(invoice, language) {
  const strings = t(language);
  const base = strings.confirmInvoice(invoice);
  if (invoice.needs_review && invoice.review_reasons && invoice.review_reasons.length > 0) {
    return `${strings.needsReviewIntro(invoice.review_reasons)}\n${base}`;
  }
  return base;
}

function formatStatusCard(summary, language) {
  return t(language).statusCard(summary);
}

function formatRemindDraft(draft, language) {
  return `${t(language).remindIntro}${draft}`;
}

module.exports = {
  t,
  formatReconciliationResult,
  formatMismatchDetail,
  formatConfirmPrompt,
  formatStatusCard,
  formatRemindDraft,
};
