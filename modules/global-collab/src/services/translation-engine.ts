// modules/global-collab/src/services/translation-engine.ts
// Pluggable translation engine interface supporting openai, deepl, google backends.
// Req 7.1: configSchema.translationProvider selects backend
// Req 7.2: 503 + Retry-After on API failure
// Req 7.3: configSchema.translationApiKey with $ENV_VAR support

export interface TranslationEngine {
  translate(text: string, sourceLang: string, targetLang: string): Promise<string>;
}

export class TranslationError extends Error {
  status: number;
  retryAfter?: number;
  constructor(message: string, status = 503, retryAfter?: number) {
    super(message);
    this.name = "TranslationError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Resolve $ENV_VAR references in config values */
export function resolveEnvVar(value: string): string {
  if (value.startsWith("$")) {
    const envName = value.slice(1);
    return process.env[envName] ?? "";
  }
  return value;
}

/** Detect the language of a text string using character-range heuristics. */
export async function detectLanguage(text: string): Promise<string> {
  // Japanese-specific characters (hiragana/katakana) — check before CJK
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  // Korean characters
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
  // CJK unified ideographs → zh-CN as default
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  // Default to English
  return "en";
}

/** Create a translation engine based on module config */
export function createTranslationEngine(config: Record<string, unknown>): TranslationEngine {
  const provider = (config.translationProvider as string) || "openai";
  const apiKey = resolveEnvVar((config.translationApiKey as string) || "");

  switch (provider) {
    case "openai":
      return new OpenAITranslationEngine(apiKey);
    case "deepl":
      return new DeepLTranslationEngine(apiKey);
    case "google":
      return new GoogleTranslationEngine(apiKey);
    default:
      throw new Error(`Unknown translation provider: ${provider}`);
  }
}


// ─── OpenAI Engine ──────────────────────────────────────────────────────────

class OpenAITranslationEngine implements TranslationEngine {
  constructor(private apiKey: string) {}

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!this.apiKey) {
      throw new TranslationError("OpenAI API key not configured", 503, 60);
    }
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a translator. Translate the following text from ${sourceLang} to ${targetLang}. Return only the translated text, nothing else.`,
            },
            { role: "user", content: text },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new TranslationError(
          `OpenAI API error: ${response.status}`,
          503,
          parseInt(response.headers.get("retry-after") ?? "30", 10),
        );
      }

      const data = (await response.json()) as any;
      return data.choices?.[0]?.message?.content?.trim() ?? text;
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      throw new TranslationError(`OpenAI translation failed: ${(err as Error).message}`, 503, 30);
    }
  }
}

// ─── DeepL Engine ───────────────────────────────────────────────────────────

class DeepLTranslationEngine implements TranslationEngine {
  constructor(private apiKey: string) {}

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!this.apiKey) {
      throw new TranslationError("DeepL API key not configured", 503, 60);
    }
    try {
      const response = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        },
        body: JSON.stringify({
          text: [text],
          source_lang: sourceLang.toUpperCase().split("-")[0],
          target_lang: targetLang.toUpperCase().replace("-", "_"),
        }),
      });

      if (!response.ok) {
        throw new TranslationError(
          `DeepL API error: ${response.status}`,
          503,
          parseInt(response.headers.get("retry-after") ?? "30", 10),
        );
      }

      const data = (await response.json()) as any;
      return data.translations?.[0]?.text ?? text;
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      throw new TranslationError(`DeepL translation failed: ${(err as Error).message}`, 503, 30);
    }
  }
}

// ─── Google Engine ──────────────────────────────────────────────────────────

class GoogleTranslationEngine implements TranslationEngine {
  constructor(private apiKey: string) {}

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!this.apiKey) {
      throw new TranslationError("Google Translate API key not configured", 503, 60);
    }
    try {
      const url = new URL("https://translation.googleapis.com/language/translate/v2");
      url.searchParams.set("key", this.apiKey);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: sourceLang.split("-")[0],
          target: targetLang.split("-")[0],
          format: "text",
        }),
      });

      if (!response.ok) {
        throw new TranslationError(
          `Google Translate API error: ${response.status}`,
          503,
          parseInt(response.headers.get("retry-after") ?? "30", 10),
        );
      }

      const data = (await response.json()) as any;
      return data.data?.translations?.[0]?.translatedText ?? text;
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      throw new TranslationError(`Google translation failed: ${(err as Error).message}`, 503, 30);
    }
  }
}
