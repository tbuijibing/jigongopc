import { useContext } from "react";
import { I18nContext, type I18nContextValue } from "../context/I18nContext";

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx;
}
