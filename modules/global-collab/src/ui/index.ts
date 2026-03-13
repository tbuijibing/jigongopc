/**
 * Module UI entry point.
 * Exports page and widget components for lazy-loading by the core module system.
 * Configures i18next instance for module-scoped internationalization.
 *
 * Requirements: 16.1, 16.5
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../i18n/en.json" with { type: "json" };
import zhCN from "../i18n/zh-CN.json" with { type: "json" };
import ja from "../i18n/ja.json" with { type: "json" };

// Initialize i18next for the module with bundled translations
const i18nInstance = i18n.createInstance();
i18nInstance.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    ja: { translation: ja },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export { i18nInstance };

// Page export — sidebar entry
export { CollaborationPage } from "./CollaborationPage.js";
export { default } from "./CollaborationPage.js";

// Widget exports — dashboard widgets
export { PresenceWidget } from "./PresenceWidget.js";
export { UnreadNotificationsWidget } from "./NotificationPanel.js";
