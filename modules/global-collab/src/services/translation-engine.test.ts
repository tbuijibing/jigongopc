import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TranslationError,
  detectLanguage,
  createTranslationEngine,
  resolveEnvVar,
} from "./translation-engine.js";

// ─── TranslationError ───────────────────────────────────────────────────────

describe("TranslationError", () => {
  it("has correct defaults (status 503)", () => {
    const err = new TranslationError("fail");
    expect(err.name).toBe("TranslationError");
    expect(err.message).toBe("fail");
    expect(err.status).toBe(503);
    expect(err.retryAfter).toBeUndefined();
  });

  it("accepts custom status and retryAfter", () => {
    const err = new TranslationError("timeout", 503, 45);
    expect(err.status).toBe(503);
    expect(err.retryAfter).toBe(45);
  });

  it("is an instance of Error", () => {
    const err = new TranslationError("x");
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── resolveEnvVar ──────────────────────────────────────────────────────────

describe("resolveEnvVar", () => {
  const ENV_KEY = "TEST_TRANSLATION_KEY_12345";

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it("returns literal value when not prefixed with $", () => {
    expect(resolveEnvVar("sk-abc")).toBe("sk-abc");
  });

  it("resolves $ENV_VAR to process.env value", () => {
    process.env[ENV_KEY] = "secret-key";
    expect(resolveEnvVar(`$${ENV_KEY}`)).toBe("secret-key");
  });

  it("returns empty string when env var is not set", () => {
    expect(resolveEnvVar(`$${ENV_KEY}`)).toBe("");
  });
});

// ─── detectLanguage ─────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  it("detects Chinese (CJK ideographs)", async () => {
    expect(await detectLanguage("这是中文文本")).toBe("zh-CN");
  });

  it("detects Japanese (hiragana)", async () => {
    expect(await detectLanguage("これはテストです")).toBe("ja");
  });

  it("detects Japanese (katakana)", async () => {
    expect(await detectLanguage("テスト")).toBe("ja");
  });

  it("detects Korean", async () => {
    expect(await detectLanguage("한국어 텍스트")).toBe("ko");
  });

  it("defaults to English for Latin text", async () => {
    expect(await detectLanguage("Hello world")).toBe("en");
  });

  it("defaults to English for empty string", async () => {
    expect(await detectLanguage("")).toBe("en");
  });

  it("detects Japanese over Chinese when mixed with kana", async () => {
    // Text with both kanji and hiragana should be detected as Japanese
    expect(await detectLanguage("日本語のテスト")).toBe("ja");
  });
});

// ─── createTranslationEngine factory ────────────────────────────────────────

describe("createTranslationEngine", () => {
  it("creates OpenAI engine by default", () => {
    const engine = createTranslationEngine({});
    expect(engine).toBeDefined();
    expect(engine.translate).toBeTypeOf("function");
  });

  it("creates OpenAI engine when provider is 'openai'", () => {
    const engine = createTranslationEngine({ translationProvider: "openai" });
    expect(engine).toBeDefined();
  });

  it("creates DeepL engine when provider is 'deepl'", () => {
    const engine = createTranslationEngine({ translationProvider: "deepl" });
    expect(engine).toBeDefined();
  });

  it("creates Google engine when provider is 'google'", () => {
    const engine = createTranslationEngine({ translationProvider: "google" });
    expect(engine).toBeDefined();
  });

  it("throws for unknown provider", () => {
    expect(() =>
      createTranslationEngine({ translationProvider: "unknown" }),
    ).toThrow("Unknown translation provider: unknown");
  });

  it("resolves $ENV_VAR for API key", () => {
    const envKey = "TEST_ENGINE_API_KEY_99";
    process.env[envKey] = "resolved-key";
    // Should not throw — key is resolved at construction time
    const engine = createTranslationEngine({
      translationProvider: "openai",
      translationApiKey: `$${envKey}`,
    });
    expect(engine).toBeDefined();
    delete process.env[envKey];
  });

  // Engines throw TranslationError(503, retryAfter) when API key is empty
  it("openai engine throws 503 with retryAfter when key is empty", async () => {
    const engine = createTranslationEngine({ translationProvider: "openai", translationApiKey: "" });
    try {
      await engine.translate("hello", "en", "zh-CN");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TranslationError);
      expect((e as TranslationError).status).toBe(503);
      expect((e as TranslationError).retryAfter).toBe(60);
    }
  });

  it("deepl engine throws 503 with retryAfter when key is empty", async () => {
    const engine = createTranslationEngine({ translationProvider: "deepl", translationApiKey: "" });
    try {
      await engine.translate("hello", "en", "zh-CN");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TranslationError);
      expect((e as TranslationError).status).toBe(503);
      expect((e as TranslationError).retryAfter).toBe(60);
    }
  });

  it("google engine throws 503 with retryAfter when key is empty", async () => {
    const engine = createTranslationEngine({ translationProvider: "google", translationApiKey: "" });
    try {
      await engine.translate("hello", "en", "zh-CN");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TranslationError);
      expect((e as TranslationError).status).toBe(503);
      expect((e as TranslationError).retryAfter).toBe(60);
    }
  });
});
