/**
 * Countries offered in the phone-number country picker.
 * `dial` is the E.164 country calling code without the leading "+".
 */
export interface Country {
  code: string;
  dial: string;
  name: string;
  flag: string;
}

/** Arab League countries — the app's primary audience. */
export const ARAB_COUNTRIES: Country[] = [
  { code: "SA", dial: "966", name: "السعودية", flag: "🇸🇦" },
  { code: "AE", dial: "971", name: "الإمارات", flag: "🇦🇪" },
  { code: "KW", dial: "965", name: "الكويت", flag: "🇰🇼" },
  { code: "QA", dial: "974", name: "قطر", flag: "🇶🇦" },
  { code: "BH", dial: "973", name: "البحرين", flag: "🇧🇭" },
  { code: "OM", dial: "968", name: "عُمان", flag: "🇴🇲" },
  { code: "IQ", dial: "964", name: "العراق", flag: "🇮🇶" },
  { code: "JO", dial: "962", name: "الأردن", flag: "🇯🇴" },
  { code: "PS", dial: "970", name: "فلسطين", flag: "🇵🇸" },
  { code: "LB", dial: "961", name: "لبنان", flag: "🇱🇧" },
  { code: "SY", dial: "963", name: "سوريا", flag: "🇸🇾" },
  { code: "EG", dial: "20", name: "مصر", flag: "🇪🇬" },
  { code: "YE", dial: "967", name: "اليمن", flag: "🇾🇪" },
  { code: "SD", dial: "249", name: "السودان", flag: "🇸🇩" },
  { code: "LY", dial: "218", name: "ليبيا", flag: "🇱🇾" },
  { code: "TN", dial: "216", name: "تونس", flag: "🇹🇳" },
  { code: "DZ", dial: "213", name: "الجزائر", flag: "🇩🇿" },
  { code: "MA", dial: "212", name: "المغرب", flag: "🇲🇦" },
  { code: "MR", dial: "222", name: "موريتانيا", flag: "🇲🇷" },
  { code: "SO", dial: "252", name: "الصومال", flag: "🇸🇴" },
  { code: "DJ", dial: "253", name: "جيبوتي", flag: "🇩🇯" },
  { code: "KM", dial: "269", name: "جزر القمر", flag: "🇰🇲" },
];

/** Other countries commonly represented on school staff. */
export const OTHER_COUNTRIES: Country[] = [
  { code: "TR", dial: "90", name: "تركيا", flag: "🇹🇷" },
  { code: "IR", dial: "98", name: "إيران", flag: "🇮🇷" },
  { code: "IN", dial: "91", name: "الهند", flag: "🇮🇳" },
  { code: "PK", dial: "92", name: "باكستان", flag: "🇵🇰" },
  { code: "BD", dial: "880", name: "بنغلاديش", flag: "🇧🇩" },
  { code: "LK", dial: "94", name: "سريلانكا", flag: "🇱🇰" },
  { code: "NP", dial: "977", name: "نيبال", flag: "🇳🇵" },
  { code: "PH", dial: "63", name: "الفلبين", flag: "🇵🇭" },
  { code: "ID", dial: "62", name: "إندونيسيا", flag: "🇮🇩" },
  { code: "MY", dial: "60", name: "ماليزيا", flag: "🇲🇾" },
  { code: "SG", dial: "65", name: "سنغافورة", flag: "🇸🇬" },
  { code: "TH", dial: "66", name: "تايلاند", flag: "🇹🇭" },
  { code: "VN", dial: "84", name: "فيتنام", flag: "🇻🇳" },
  { code: "CN", dial: "86", name: "الصين", flag: "🇨🇳" },
  { code: "JP", dial: "81", name: "اليابان", flag: "🇯🇵" },
  { code: "KR", dial: "82", name: "كوريا الجنوبية", flag: "🇰🇷" },
  { code: "GB", dial: "44", name: "المملكة المتحدة", flag: "🇬🇧" },
  { code: "IE", dial: "353", name: "أيرلندا", flag: "🇮🇪" },
  { code: "DE", dial: "49", name: "ألمانيا", flag: "🇩🇪" },
  { code: "FR", dial: "33", name: "فرنسا", flag: "🇫🇷" },
  { code: "IT", dial: "39", name: "إيطاليا", flag: "🇮🇹" },
  { code: "ES", dial: "34", name: "إسبانيا", flag: "🇪🇸" },
  { code: "PT", dial: "351", name: "البرتغال", flag: "🇵🇹" },
  { code: "NL", dial: "31", name: "هولندا", flag: "🇳🇱" },
  { code: "BE", dial: "32", name: "بلجيكا", flag: "🇧🇪" },
  { code: "CH", dial: "41", name: "سويسرا", flag: "🇨🇭" },
  { code: "AT", dial: "43", name: "النمسا", flag: "🇦🇹" },
  { code: "SE", dial: "46", name: "السويد", flag: "🇸🇪" },
  { code: "NO", dial: "47", name: "النرويج", flag: "🇳🇴" },
  { code: "DK", dial: "45", name: "الدنمارك", flag: "🇩🇰" },
  { code: "FI", dial: "358", name: "فنلندا", flag: "🇫🇮" },
  { code: "PL", dial: "48", name: "بولندا", flag: "🇵🇱" },
  { code: "CZ", dial: "420", name: "تشيكيا", flag: "🇨🇿" },
  { code: "RO", dial: "40", name: "رومانيا", flag: "🇷🇴" },
  { code: "GR", dial: "30", name: "اليونان", flag: "🇬🇷" },
  { code: "RU", dial: "7", name: "روسيا", flag: "🇷🇺" },
  { code: "UA", dial: "380", name: "أوكرانيا", flag: "🇺🇦" },
  { code: "US", dial: "1", name: "الولايات المتحدة", flag: "🇺🇸" },
  { code: "CA", dial: "1", name: "كندا", flag: "🇨🇦" },
  { code: "MX", dial: "52", name: "المكسيك", flag: "🇲🇽" },
  { code: "BR", dial: "55", name: "البرازيل", flag: "🇧🇷" },
  { code: "AR", dial: "54", name: "الأرجنتين", flag: "🇦🇷" },
  { code: "ET", dial: "251", name: "إثيوبيا", flag: "🇪🇹" },
  { code: "KE", dial: "254", name: "كينيا", flag: "🇰🇪" },
  { code: "NG", dial: "234", name: "نيجيريا", flag: "🇳🇬" },
  { code: "GH", dial: "233", name: "غانا", flag: "🇬🇭" },
  { code: "ZA", dial: "27", name: "جنوب أفريقيا", flag: "🇿🇦" },
  { code: "AU", dial: "61", name: "أستراليا", flag: "🇦🇺" },
  { code: "NZ", dial: "64", name: "نيوزيلندا", flag: "🇳🇿" },
];

export const COUNTRIES: Country[] = [...ARAB_COUNTRIES, ...OTHER_COUNTRIES];

/**
 * Historic default of the app: normalizePhone's fallback and the format of
 * pre-existing records (local numbers like 07701234567).
 */
export const DEFAULT_COUNTRY_DIAL = "964";
