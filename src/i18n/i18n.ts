import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh.json";

void i18n
  .use(LanguageDetector)
  .use(ICU)
  .use(initReactI18next)
  .init({
    debug: false,
    supportedLngs: ["en", "zh"],
    fallbackLng: "en",
    defaultNS: "translation",
    ns: ["translation"],
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    returnNull: false,
    returnEmptyString: true,
    parseMissingKeyHandler: (key) => key,
  });

export { i18n };
