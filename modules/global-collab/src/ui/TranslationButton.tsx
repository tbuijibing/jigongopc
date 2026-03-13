/**
 * TranslationButton — embeddable translation button component.
 * Calls module translation API on click, shows translation result and stale indicator.
 *
 * Requirements: 16.5
 */
import { useState } from "react";
import { i18nInstance } from "./index.js";

const API = "/api/modules/global-collab";

interface TranslationButtonProps {
  /** Entity type (e.g. "issue", "issue_comment") */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** Field name to translate (e.g. "title", "body") */
  fieldName: string;
  /** Source text to translate */
  sourceText: string;
  /** Target locale (e.g. "zh-CN") */
  targetLocale: string;
}

interface TranslationResult {
  translatedText: string;
  sourceLocale: string;
  targetLocale: string;
  stale: boolean;
  cached: boolean;
}

export function TranslationButton({
  entityType,
  entityId,
  fieldName,
  sourceText,
  targetLocale,
}: TranslationButtonProps) {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = i18nInstance.t.bind(i18nInstance);

  const translate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/translate/entity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, fieldName, sourceText, targetLocale }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: TranslationResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? t("translation.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={translate}
        disabled={loading}
        style={{
          padding: "3px 8px",
          border: "1px solid #d1d5db",
          borderRadius: 4,
          background: "#fff",
          cursor: loading ? "wait" : "pointer",
          fontSize: 12,
          color: "#3b82f6",
        }}
      >
        {loading ? t("translation.translating") : t("translation.translate")}
      </button>
      {result && (
        <span style={{ fontSize: 13 }}>
          {result.translatedText}
          {result.stale && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 11,
                color: "#f59e0b",
                fontStyle: "italic",
              }}
              title={t("translation.stale")}
            >
              ⚠ {t("translation.stale")}
            </span>
          )}
        </span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: "#ef4444" }}>
          {error}{" "}
          <button
            onClick={translate}
            style={{
              border: "none",
              background: "none",
              color: "#3b82f6",
              cursor: "pointer",
              fontSize: 12,
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {t("translation.retry")}
          </button>
        </span>
      )}
    </span>
  );
}

export default TranslationButton;
