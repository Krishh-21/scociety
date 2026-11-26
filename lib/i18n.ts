export type Lang = "en" | "hi";

/**
 * Small dictionary for the strings a resident meets most. Anything missing falls
 * back to English rather than showing a key — a half-translated screen is better
 * than a broken one, and the gaps are visible in one place.
 */
const HI: Record<string, string> = {
  "nav.home": "होम",
  "nav.explore": "सेवाएँ",
  "nav.bookings": "बुकिंग",
  "nav.society": "सोसायटी",
  "nav.profile": "प्रोफ़ाइल",
  "nav.visitors": "आगंतुक",
  "nav.notifications": "सूचनाएँ",
  "nav.community": "नोटिस और सुविधाएँ",
  "nav.dues": "शुल्क और रसीदें",
  "nav.helpdesk": "सहायता केंद्र",
  "nav.allModules": "सभी सुविधाएँ",
  "nav.services": "सेवाएँ",
  "nav.groupServices": "समूह सेवाएँ",
  "nav.account": "खाता",
  "nav.help": "मदद",
  "nav.group.today": "आज",
  "nav.group.you": "आपका खाता",

  "home.flat": "फ़्लैट",
  "home.today": "आज की जानकारी",
  "home.shortcuts": "सोसायटी के शॉर्टकट",
  "home.notices": "नोटिस",
  "home.dues": "शुल्क",
  "home.amenities": "सुविधाएँ",
  "home.yourDues": "रखरखाव शुल्क",
  "home.helpdeskQueue": "शिकायतों की सूची",
  "home.noticeBoard": "सूचना पट्ट",
  "home.updates": "आपके लिए सूचनाएँ",
  "home.alsoInSociety": "आपकी सोसायटी में और भी",
  "home.comingUp": "आगामी कार्यक्रम",
  "home.committeeDesk": "समिति डेस्क",
  "home.services": "घरेलू सेवाएँ",
  "home.browseServices": "समूह सेवाएँ देखें",
  "home.verifyTitle": "आपके फ़्लैट का सत्यापन बाकी है",

  "feed.goodMorning": "सुप्रभात",
  "feed.goodAfternoon": "नमस्कार",
  "feed.goodEvening": "शुभ संध्या",
  "feed.filling": "अभी भर रहे हैं",
  "feed.confirmed": "कन्फ़र्म",
  "feed.earlier": "पहले के",
  "feed.announcement": "सोसायटी सूचना",
  "feed.suggested": "आपकी सोसायटी के लिए",
  "feed.savedSoFar": "अब तक की बचत",
  "feed.savedCaption": "फ्लैट-दर-फ्लैट बुक करने के बजाय साथ बुक करके।",
  "feed.startGroup": "ग्रुप शुरू करें",
  "feed.awaitingApproval": "कमेटी की मंज़ूरी बाक़ी",

  "deal.join": "ग्रुप जॉइन करें",
  "deal.youreIn": "आप शामिल हैं",
  "deal.leave": "हटें",
  "deal.priceLadder": "प्राइस लैडर",
  "deal.whatYouGet": "इसमें क्या है",
  "deal.neighbours": "इस ग्रुप के पड़ोसी",
  "deal.comments": "कमेंट",
  "deal.share": "व्हाट्सऐप पर शेयर करें",
  "deal.nothingNow": "अभी ₹0 — अंतिम ग्रुप कीमत ही लगेगी",
  "deal.closesIn": "बंद होने में",

  "join.howMany": "कितने",
  "join.pickSlot": "समय चुनें",
  "join.howPay": "भुगतान कैसे करेंगे",
  "join.confirm": "कन्फ़र्म करें और जॉइन करें",
  "join.continue": "आगे बढ़ें",
  "join.back": "पीछे",
  "join.cancel": "रद्द करें",

  "bookings.title": "मेरी बुकिंग",
  "bookings.upcoming": "आने वाली",
  "bookings.none": "अभी कोई बुकिंग नहीं",
  "bookings.notCharged": "भरा नहीं — कोई शुल्क नहीं लिया गया",
  "bookings.raiseIssue": "शिकायत दर्ज करें",

  "common.flats": "फ्लैट",
  "common.joined": "जुड़े",
  "common.save": "बचत",
  "common.perUnit": "प्रति",
  "common.signOut": "साइन आउट",
  "common.back": "वापस",
};

const DICTS: Record<Lang, Record<string, string>> = { en: {}, hi: HI };

/** English is written at the call site, so `t` only has to override it. */
export function translator(lang: Lang) {
  const dict = DICTS[lang] ?? {};
  return (key: string, english: string) => dict[key] ?? english;
}

export type T = ReturnType<typeof translator>;

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "hi";
}
