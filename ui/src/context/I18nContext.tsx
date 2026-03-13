import { createContext, useState, useCallback, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n, LOCALE_STORAGE_KEY, supportedLocales, type SupportedLocale } from "../i18n";

export interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  supportedLocales: readonly SupportedLocale[];
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    i18n.language as SupportedLocale
  );

  const setLocale = useCallback((next: SupportedLocale) => {
    i18n.changeLanguage(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
    document.documentElement.lang = next;
    setLocaleState(next);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, supportedLocales }}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </I18nContext.Provider>
  );
}
