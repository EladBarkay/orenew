/** i18next setup. Initializes English + Hebrew, restores the saved language from
 *  localStorage, and keeps the document's `lang`/`dir` in sync so Hebrew renders
 *  right-to-left (Tailwind logical utilities then flip automatically). */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import he from "./locales/he";

export type LangCode = "en" | "he";

export const LANGS: { code: LangCode; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
];

const STORAGE_KEY = "magnet.lang";

export function dirFor(lng: string): "ltr" | "rtl" {
  return LANGS.find((l) => l.code === lng)?.dir ?? "ltr";
}

function applyDir(lng: string) {
  document.documentElement.lang = lng;
  document.documentElement.dir = dirFor(lng);
}

function initialLang(): LangCode {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return LANGS.some((l) => l.code === stored) ? (stored as LangCode) : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: initialLang(),
  fallbackLng: "en",
  supportedLngs: LANGS.map((l) => l.code),
  interpolation: { escapeValue: false }, // React already escapes
});

// Keep <html lang/dir> aligned with the active language, now and on every switch.
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

/** Switch language and persist the choice. */
export function setLanguage(lng: LangCode) {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore persistence failures (e.g. private mode) */
  }
  i18n.changeLanguage(lng);
}

export default i18n;
