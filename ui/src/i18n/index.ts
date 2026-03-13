import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import ja from "./locales/ja.json";

const LOCALE_STORAGE_KEY = "Jigong.locale";

const supportedLocales = ["en", "zh-CN", "ja"] as const;
type SupportedLocale = (typeof supportedLocales)[number];

function detectLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && supportedLocales.includes(stored as SupportedLocale)) {
      return stored as SupportedLocale;
    }
  } catch {
    // localStorage unavailable (private mode, quota exceeded, etc.)
  }
  const browserLang = navigator.language;
  if (browserLang.startsWith("zh")) return "zh-CN";
  if (browserLang.startsWith("ja")) return "ja";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    ja: { translation: ja },
  },
  lng: detectLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export { i18n, LOCALE_STORAGE_KEY, supportedLocales, detectLocale };
export type { SupportedLocale };
