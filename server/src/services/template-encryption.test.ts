import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import {
  encryptTemplate,
  decryptTemplate,
  signTemplate,
  verifyTemplate,
  packTemplate,
  unpackTemplate,
  generateRSAKeyPair,
  generateECDSAKeyPair,
  signTemplateECDSA,
  verifyTemplateECDSA,
  generateEncryptionKeyBuffer,
  createLayer,
  validateKey,
  type Layer,
  type EncryptedPackage,
  type TemplatePackage,
} from "./template-encryption";

describe("Template Encryption Service", () => {
  describe("AES-256-GCM Encryption/Decryption", () => {
    let testKey: Buffer;
    let testContent: string;

    beforeEach(() => {
      testKey = generateEncryptionKeyBuffer();
      testContent = JSON.stringify({
        workflows: [{ id: "wf1", name: "Test Workflow" }],
        globalRules: { maxRetries: 3 },
        checks: [{ id: "check1", type: "integrity" }],
      });
    });

    describe("encryptTemplate", () => {
      it("should encrypt content and return valid EncryptedPackage", () => {
        const encrypted = encryptTemplate(testContent, testKey);

        expect(encrypted).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.encryptedData).toBeDefined();
        expect(encrypted.authTag).toBeDefined();
        expect(encrypted.algorithm).toBe("aes-256-gcm");

        // Verify IV is 32 hex chars (16 bytes)
        expect(encrypted.iv).toHaveLength(32);
        // Auth tag should be 32 hex chars (16 bytes)
        expect(encrypted.authTag).toHaveLength(32);
      });

      it("should throw error for invalid key length", () => {
        const shortKey = Buffer.from("short");
        expect(() => encryptTemplate(testContent, shortKey)).toThrow("Invalid key");
      });

      it("should throw error for non-Buffer key", () => {
        expect(() => encryptTemplate(testContent, "not-a-buffer" as unknown as Buffer)).toThrow("Invalid key");
      });

      it("should produce different IVs for same content", () => {
        const encrypted1 = encryptTemplate(testContent, testKey);
        const encrypted2 = encryptTemplate(testContent, testKey);

        expect(encrypted1.iv).not.toBe(encrypted2.iv);
        expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      });

      it("should handle empty string content", () => {
        const encrypted = encryptTemplate("", testKey);
        expect(encrypted).toBeDefined();
        expect(encrypted.encryptedData).toBeDefined();
      });

      it("should handle large content", () => {
        const largeContent = "x".repeat(1000000);
        const encrypted = encryptTemplate(largeContent, testKey);
        expect(encrypted).toBeDefined();
      });
    });

    describe("decryptTemplate", () => {
      it("should decrypt encrypted content correctly", () => {
        const encrypted = encryptTemplate(testContent, testKey);
        const decrypted = decryptTemplate(encrypted, testKey);

        expect(decrypted).toBe(testContent);
      });

      it("should throw error for invalid key length", () => {
        const encrypted = encryptTemplate(testContent, testKey);
        const shortKey = Buffer.from("short");
        expect(() => decryptTemplate(encrypted, shortKey)).toThrow("Invalid key");
      });

      it("should throw error for missing required fields", () => {
        const invalidPackage: EncryptedPackage = {
          iv: "",
          encryptedData: "",
          authTag: "",
          algorithm: "aes-256-gcm",
        };
        expect(() => decryptTemplate(invalidPackage, testKey)).toThrow("Invalid encrypted package");
      });

      it("should throw error for tampered auth tag", () => {
        const encrypted = encryptTemplate(testContent, testKey);
        encrypted.authTag = encrypted.authTag.slice(0, -2) + "00";

        expect(() => decryptTemplate(encrypted, testKey)).toThrow("authentication tag verification failed");
      });

      it("should throw error for tampered encrypted data", () => {
        const encrypted = encryptTemplate(testContent, testKey);
        encrypted.encryptedData = encrypted.encryptedData.slice(0, -2) + "ff";

        expect(() => decryptTemplate(encrypted, testKey)).toThrow("authentication tag verification failed");
      });

      it("should throw error for wrong key", () => {
        const encrypted = encryptTemplate(testContent, testKey);
        const wrongKey = generateEncryptionKeyBuffer();

        expect(() => decryptTemplate(encrypted, wrongKey)).toThrow("authentication tag verification failed");
      });

      it("should throw error for invalid IV length", () => {
        const encrypted: EncryptedPackage = {
          iv: "00ff",
          encryptedData: crypto.randomBytes(32).toString("hex"),
          authTag: crypto.randomBytes(16).toString("hex"),
          algorithm: "aes-256-gcm",
        };
        expect(() => decryptTemplate(encrypted, testKey)).toThrow("Invalid IV length");
      });

      it("should throw error for invalid auth tag length", () => {
        const encrypted: EncryptedPackage = {
          iv: crypto.randomBytes(16).toString("hex"),
          encryptedData: crypto.randomBytes(32).toString("hex"),
          authTag: "00ff",
          algorithm: "aes-256-gcm",
        };
        expect(() => decryptTemplate(encrypted, testKey)).toThrow("Invalid auth tag length");
      });

      it("should handle empty string encryption/decryption roundtrip", () => {
        const emptyContent = "";
        const encrypted = encryptTemplate(emptyContent, testKey);
        const decrypted = decryptTemplate(encrypted, testKey);
        expect(decrypted).toBe(emptyContent);
      });
    });

    describe("Encryption/Decryption Roundtrip", () => {
      it("should successfully roundtrip complex JSON content", () => {
        const complexContent = JSON.stringify({
          nested: {
            arrays: [1, 2, 3],
            objects: { a: 1, b: 2 },
            strings: "test",
            numbers: 42.5,
            booleans: true,
            nulls: null,
          },
          unicode: "Hello, 世界! 🌍",
          special: "<script>alert('xss')</script>",
        });

        const encrypted = encryptTemplate(complexContent, testKey);
        const decrypted = decryptTemplate(encrypted, testKey);
        expect(decrypted).toBe(complexContent);
      });

      it("should successfully roundtrip with multiple different keys", () => {
        const content = "Test content";
        const key1 = generateEncryptionKeyBuffer();
        const key2 = generateEncryptionKeyBuffer();

        const encrypted1 = encryptTemplate(content, key1);
        const encrypted2 = encryptTemplate(content, key2);

        expect(decryptTemplate(encrypted1, key1)).toBe(content);
        expect(decryptTemplate(encrypted2, key2)).toBe(content);
        expect(() => decryptTemplate(encrypted1, key2)).toThrow();
        expect(() => decryptTemplate(encrypted2, key1)).toThrow();
      });
    });
  });

  describe("RSA Digital Signatures", () => {
    let keyPair: { publicKey: string; privateKey: string };
    let testContent: string;

    beforeEach(() => {
      keyPair = generateRSAKeyPair();
      testContent = JSON.stringify({
        manifest: { name: "Test Template", version: "1.0.0" },
        core: { workflows: [] },
      });
    });

    describe("generateRSAKeyPair", () => {
      it("should generate valid RSA key pair", () => {
        expect(keyPair.publicKey).toContain("BEGIN PUBLIC KEY");
        expect(keyPair.privateKey).toContain("BEGIN PRIVATE KEY");
      });

      it("should generate different key pairs on each call", () => {
        const keyPair2 = generateRSAKeyPair();
        expect(keyPair.publicKey).not.toBe(keyPair2.publicKey);
        expect(keyPair.privateKey).not.toBe(keyPair2.privateKey);
      });

      it("should support custom key sizes", () => {
        const largeKeyPair = generateRSAKeyPair(4096);
        expect(largeKeyPair.publicKey).toContain("BEGIN PUBLIC KEY");
      });
    });

    describe("signTemplate", () => {
      it("should generate a hex-encoded signature", () => {
        const signature = signTemplate(testContent, keyPair.privateKey);
        expect(signature).toBeDefined();
        expect(typeof signature).toBe("string");
        // Should be valid hex
        expect(signature).toMatch(/^[0-9a-f]+$/);
      });

      it("should throw error for invalid private key", () => {
        expect(() => signTemplate(testContent, "invalid-key")).toThrow("Signing failed");
      });

      it("should generate different signatures for different content", () => {
        const sig1 = signTemplate("content1", keyPair.privateKey);
        const sig2 = signTemplate("content2", keyPair.privateKey);
        expect(sig1).not.toBe(sig2);
      });
    });

    describe("verifyTemplate", () => {
      it("should return true for valid signature", () => {
        const signature = signTemplate(testContent, keyPair.privateKey);
        const isValid = verifyTemplate(testContent, signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it("should return false for tampered content", () => {
        const signature = signTemplate(testContent, keyPair.privateKey);
        const isValid = verifyTemplate("tampered-content", signature, keyPair.publicKey);
        expect(isValid).toBe(false);
      });

      it("should return false for tampered signature", () => {
        const signature = signTemplate(testContent, keyPair.privateKey);
        const tamperedSig = signature.slice(0, -4) + "abcd";
        const isValid = verifyTemplate(testContent, tamperedSig, keyPair.publicKey);
        expect(isValid).toBe(false);
      });

      it("should return false for wrong public key", () => {
        const otherKeyPair = generateRSAKeyPair();
        const signature = signTemplate(testContent, keyPair.privateKey);
        const isValid = verifyTemplate(testContent, signature, otherKeyPair.publicKey);
        expect(isValid).toBe(false);
      });

      it("should throw error for invalid public key", () => {
        const signature = signTemplate(testContent, keyPair.privateKey);
        expect(() => verifyTemplate(testContent, signature, "invalid-key")).toThrow("Verification failed");
      });
    });
  });

  describe("ECDSA Digital Signatures", () => {
    let keyPair: { publicKey: string; privateKey: string };
    let testContent: string;

    beforeEach(() => {
      keyPair = generateECDSAKeyPair();
      testContent = "Test content for ECDSA";
    });

    describe("generateECDSAKeyPair", () => {
      it("should generate valid ECDSA key pair", () => {
        expect(keyPair.publicKey).toContain("BEGIN PUBLIC KEY");
        expect(keyPair.privateKey).toContain("BEGIN PRIVATE KEY");
      });

      it("should generate different key pairs on each call", () => {
        const keyPair2 = generateECDSAKeyPair();
        expect(keyPair.publicKey).not.toBe(keyPair2.publicKey);
      });
    });

    describe("signTemplateECDSA and verifyTemplateECDSA", () => {
      it("should sign and verify content with ECDSA", () => {
        const signature = signTemplateECDSA(testContent, keyPair.privateKey);
        const isValid = verifyTemplateECDSA(testContent, signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it("should return false for tampered content", () => {
        const signature = signTemplateECDSA(testContent, keyPair.privateKey);
        const isValid = verifyTemplateECDSA("tampered", signature, keyPair.publicKey);
        expect(isValid).toBe(false);
      });

      it("should return false for wrong public key", () => {
        const otherKeyPair = generateECDSAKeyPair();
        const signature = signTemplateECDSA(testContent, keyPair.privateKey);
        const isValid = verifyTemplateECDSA(testContent, signature, otherKeyPair.publicKey);
        expect(isValid).toBe(false);
      });
    });
  });

  describe("Template Package Packing/Unpacking", () => {
    let coreLayer: Layer;
    let customizationLayer: Layer;

    beforeEach(() => {
      coreLayer = createLayer("core", JSON.stringify({
        manifest: { name: "Test Template", version: "1.0.0" },
        workflows: [
          { id: "wf1", name: "Workflow 1" },
          { id: "wf2", name: "Workflow 2" },
        ],
        globalRules: { maxRetries: 3, timeout: 30000 },
        checks: [{ id: "check1", type: "integrity" }],
      }));

      customizationLayer = createLayer("customization", JSON.stringify({
        variables: { env: "production", region: "us-east-1" },
        integrations: { slack: { webhook: "https://hooks.slack.com/..." } },
        notifications: { email: { enabled: true, recipients: ["admin@example.com"] } },
      }));
    });

    describe("packTemplate", () => {
      it("should create a valid TemplatePackage", () => {
        const pkg = packTemplate(coreLayer, customizationLayer);

        expect(pkg).toBeDefined();
        expect(pkg.version).toBe("1.0");
        expect(pkg.format).toBe("template-package");
        expect(pkg.coreLayer).toBeDefined();
        expect(pkg.customizationLayer).toBeDefined();
        expect(pkg.metadata).toBeDefined();
        expect(pkg.metadata.createdAt).toBeDefined();
        expect(pkg.metadata.checksum).toBeDefined();
        expect(pkg.metadata.compressed).toBe(true);
      });

      it("should compress layer content", () => {
        const pkg = packTemplate(coreLayer, customizationLayer);
        // Compressed content should be base64 encoded
        expect(pkg.coreLayer.content).toMatch(/^[A-Za-z0-9+/=]+$/);
        expect(pkg.customizationLayer.content).toMatch(/^[A-Za-z0-9+/=]+$/);
      });

      it("should preserve layer metadata", () => {
        coreLayer.metadata = { author: "Test Author", version: "1.0" };
        const pkg = packTemplate(coreLayer, customizationLayer);
        expect(pkg.coreLayer.metadata).toEqual({ author: "Test Author", version: "1.0" });
      });

      it("should generate unique checksums for different content", () => {
        const pkg1 = packTemplate(coreLayer, customizationLayer);
        const pkg2 = packTemplate(
          createLayer("core", JSON.stringify({ workflows: [] })),
          customizationLayer
        );
        expect(pkg1.metadata.checksum).not.toBe(pkg2.metadata.checksum);
      });
    });

    describe("unpackTemplate", () => {
      it("should unpack a package and return original layers", () => {
        const pkg = packTemplate(coreLayer, customizationLayer);
        const unpacked = unpackTemplate(pkg);

        expect(unpacked.coreLayer.name).toBe(coreLayer.name);
        expect(unpacked.coreLayer.content).toBe(coreLayer.content);
        expect(unpacked.customizationLayer.name).toBe(customizationLayer.name);
        expect(unpacked.customizationLayer.content).toBe(customizationLayer.content);
      });

      it("should verify checksum during unpacking", () => {
        const pkg = packTemplate(coreLayer, customizationLayer);
        // Tamper with the package
        pkg.metadata.checksum = "invalid-checksum";
        expect(() => unpackTemplate(pkg)).toThrow("Checksum mismatch");
      });

      it("should throw error for invalid package format", () => {
        const invalidPkg = {
          version: "1.0",
          format: "invalid-format",
          coreLayer,
          customizationLayer,
          metadata: { createdAt: new Date().toISOString(), checksum: "abc", compressed: true },
        } as TemplatePackage;
        expect(() => unpackTemplate(invalidPkg)).toThrow("Invalid package format");
      });

      it("should throw error for missing coreLayer", () => {
        const invalidPkg = {
          version: "1.0",
          format: "template-package",
          coreLayer: undefined as unknown as Layer,
          customizationLayer,
          metadata: { createdAt: new Date().toISOString(), checksum: "abc", compressed: true },
        } as TemplatePackage;
        expect(() => unpackTemplate(invalidPkg)).toThrow("Invalid package: missing coreLayer");
      });

      it("should throw error for missing customizationLayer", () => {
        const invalidPkg = {
          version: "1.0",
          format: "template-package",
          coreLayer,
          customizationLayer: undefined as unknown as Layer,
          metadata: { createdAt: new Date().toISOString(), checksum: "abc", compressed: true },
        } as TemplatePackage;
        expect(() => unpackTemplate(invalidPkg)).toThrow("Invalid package: missing customizationLayer");
      });

      it("should throw error for invalid package object", () => {
        expect(() => unpackTemplate(null as unknown as TemplatePackage)).toThrow("Invalid package");
        expect(() => unpackTemplate(undefined as unknown as TemplatePackage)).toThrow("Invalid package");
        expect(() => unpackTemplate("string" as unknown as TemplatePackage)).toThrow("Invalid package");
      });
    });

    describe("Pack/Unpack Roundtrip", () => {
      it("should successfully roundtrip complex template data", () => {
        const complexCore = createLayer("core", JSON.stringify({
          manifest: { name: "Complex Template", version: "2.0.0", author: "Test Author" },
          workflows: Array.from({ length: 100 }, (_, i) => ({
            id: `wf-${i}`,
            name: `Workflow ${i}`,
            steps: [{ action: "step1", params: { key: "value" } }],
          })),
          globalRules: { maxRetries: 5, timeout: 60000, backoff: "exponential" },
          checks: [{ id: "integrity", enabled: true }, { id: "security", enabled: true }],
        }));

        const complexCustomization = createLayer("customization", JSON.stringify({
          variables: { env: "production", region: "us-east-1", debug: false },
          integrations: {
            slack: { webhook: "https://hooks.slack.com/...", channel: "#alerts" },
            email: { smtp: "smtp.example.com", port: 587 },
          },
          notifications: {
            email: { enabled: true, recipients: ["admin@example.com", "ops@example.com"] },
            slack: { enabled: true, channel: "#notifications" },
          },
        }));

        const pkg = packTemplate(complexCore, complexCustomization);
        const unpacked = unpackTemplate(pkg);

        expect(JSON.parse(unpacked.coreLayer.content)).toEqual(JSON.parse(complexCore.content));
        expect(JSON.parse(unpacked.customizationLayer.content)).toEqual(JSON.parse(complexCustomization.content));
      });

      it("should handle layers with special characters and unicode", () => {
        const unicodeCore = createLayer("core", JSON.stringify({
          message: "Hello, 世界! 🌍 Привет мир!",
          special: "<>&\"'",
          newlines: "Line1\\nLine2\\tTab",
        }));

        const unicodeCustomization = createLayer("customization", JSON.stringify({
          emoji: "🚀🎉💯",
          arabic: "مرحبا بالعالم",
          japanese: "こんにちは世界",
        }));

        const pkg = packTemplate(unicodeCore, unicodeCustomization);
        const unpacked = unpackTemplate(pkg);

        expect(unpacked.coreLayer.content).toBe(unicodeCore.content);
        expect(unpacked.customizationLayer.content).toBe(unicodeCustomization.content);
      });
    });
  });

  describe("Utility Functions", () => {
    describe("generateEncryptionKeyBuffer", () => {
      it("should return a 32-byte Buffer", () => {
        const key = generateEncryptionKeyBuffer();
        expect(Buffer.isBuffer(key)).toBe(true);
        expect(key.length).toBe(32);
      });

      it("should generate different keys on each call", () => {
        const key1 = generateEncryptionKeyBuffer();
        const key2 = generateEncryptionKeyBuffer();
        expect(key1).not.toEqual(key2);
      });
    });

    describe("createLayer", () => {
      it("should create a layer with name and content", () => {
        const layer = createLayer("test-layer", "test content");
        expect(layer.name).toBe("test-layer");
        expect(layer.content).toBe("test content");
      });

      it("should create a layer with optional metadata", () => {
        const layer = createLayer("test-layer", "content", { version: "1.0" });
        expect(layer.metadata).toEqual({ version: "1.0" });
      });

      it("should work without metadata", () => {
        const layer = createLayer("test-layer", "content");
        expect(layer.metadata).toBeUndefined();
      });
    });

    describe("validateKey", () => {
      it("should not throw for valid 32-byte key", () => {
        const key = generateEncryptionKeyBuffer();
        expect(() => validateKey(key)).not.toThrow();
      });

      it("should throw for short key", () => {
        const shortKey = Buffer.from("too-short");
        expect(() => validateKey(shortKey)).toThrow("Key must be exactly 32 bytes");
      });

      it("should throw for long key", () => {
        const longKey = Buffer.from("this-key-is-way-too-long-for-aes-256");
        expect(() => validateKey(longKey)).toThrow("Key must be exactly 32 bytes");
      });

      it("should throw for non-Buffer key", () => {
        expect(() => validateKey("string" as unknown as Buffer)).toThrow("Key must be a Buffer");
        expect(() => validateKey(123 as unknown as Buffer)).toThrow("Key must be a Buffer");
      });
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    describe("Encryption edge cases", () => {
      it("should handle binary content", () => {
        const key = generateEncryptionKeyBuffer();
        const binaryContent = Buffer.from([0x00, 0xff, 0x42, 0x13]).toString("base64");
        const encrypted = encryptTemplate(binaryContent, key);
        const decrypted = decryptTemplate(encrypted, key);
        expect(decrypted).toBe(binaryContent);
      });

      it("should handle very large content", () => {
        const key = generateEncryptionKeyBuffer();
        const largeContent = "x".repeat(5000000); // 5MB of data
        const encrypted = encryptTemplate(largeContent, key);
        const decrypted = decryptTemplate(encrypted, key);
        expect(decrypted).toBe(largeContent);
      });

      it("should handle content with only whitespace", () => {
        const key = generateEncryptionKeyBuffer();
        const whitespaceContent = "   \n\t\r   ";
        const encrypted = encryptTemplate(whitespaceContent, key);
        const decrypted = decryptTemplate(encrypted, key);
        expect(decrypted).toBe(whitespaceContent);
      });
    });

    describe("Signature edge cases", () => {
      it("should handle empty string content", () => {
        const keyPair = generateRSAKeyPair();
        const signature = signTemplate("", keyPair.privateKey);
        const isValid = verifyTemplate("", signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it("should handle very long content", () => {
        const keyPair = generateRSAKeyPair();
        const longContent = "x".repeat(100000);
        const signature = signTemplate(longContent, keyPair.privateKey);
        const isValid = verifyTemplate(longContent, signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });

      it("should handle unicode content", () => {
        const keyPair = generateRSAKeyPair();
        const unicodeContent = "Hello, 世界! 🌍 Привет! مرحبا! שלום!";
        const signature = signTemplate(unicodeContent, keyPair.privateKey);
        const isValid = verifyTemplate(unicodeContent, signature, keyPair.publicKey);
        expect(isValid).toBe(true);
      });
    });

    describe("Package edge cases", () => {
      it("should handle layers with empty content", () => {
        const emptyCore = createLayer("core", "");
        const emptyCustomization = createLayer("customization", "");
        const pkg = packTemplate(emptyCore, emptyCustomization);
        const unpacked = unpackTemplate(pkg);
        expect(unpacked.coreLayer.content).toBe("");
        expect(unpacked.customizationLayer.content).toBe("");
      });

      it("should handle layers with only whitespace", () => {
        const wsCore = createLayer("core", "   \n\t   ");
        const wsCustomization = createLayer("customization", "   ");
        const pkg = packTemplate(wsCore, wsCustomization);
        const unpacked = unpackTemplate(pkg);
        expect(unpacked.coreLayer.content).toBe("   \n\t   ");
        expect(unpacked.customizationLayer.content).toBe("   ");
      });

      it("should handle deeply nested JSON content", () => {
        const deepContent = JSON.stringify({
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: { data: "deep" },
                },
              },
            },
          },
        });
        const deepLayer = createLayer("core", deepContent);
        const pkg = packTemplate(deepLayer, createLayer("customization", "{}"));
        const unpacked = unpackTemplate(pkg);
        expect(JSON.parse(unpacked.coreLayer.content)).toEqual(JSON.parse(deepContent));
      });
    });

    describe("Integration scenarios", () => {
      it("should handle complete encryption + signing + packing workflow", () => {
        const key = generateEncryptionKeyBuffer();
        const keyPair = generateRSAKeyPair();

        // Step 1: Create layers
        const coreContent = JSON.stringify({
          manifest: { name: "Secure Template", version: "1.0.0" },
          workflows: [{ id: "wf1", steps: [] }],
        });
        const coreLayer = createLayer("core", coreContent);
        const customizationLayer = createLayer("customization", JSON.stringify({ env: "prod" }));

        // Step 2: Encrypt core layer
        const encryptedCore = encryptTemplate(coreLayer.content, key);
        const encryptedCoreLayer = createLayer(
          "core-encrypted",
          JSON.stringify(encryptedCore)
        );

        // Step 3: Pack template
        const pkg = packTemplate(encryptedCoreLayer, customizationLayer);

        // Step 4: Sign the package (using its serialized form)
        const pkgContent = JSON.stringify(pkg);
        const signature = signTemplate(pkgContent, keyPair.privateKey);

        // Step 5: Verify signature
        const isValid = verifyTemplate(pkgContent, signature, keyPair.publicKey);
        expect(isValid).toBe(true);

        // Step 6: Unpack and decrypt
        const unpacked = unpackTemplate(pkg);
        const encryptedData: EncryptedPackage = JSON.parse(unpacked.coreLayer.content);
        const decryptedContent = decryptTemplate(encryptedData, key);

        expect(decryptedContent).toBe(coreContent);
      });

      it("should detect tampering in encrypted packed template", () => {
        const key = generateEncryptionKeyBuffer();

        const coreLayer = createLayer("core", JSON.stringify({ sensitive: "data" }));
        const customizationLayer = createLayer("customization", "{}");

        const pkg = packTemplate(coreLayer, customizationLayer);

        // Tamper with the package
        pkg.metadata.checksum = "tampered";

        expect(() => unpackTemplate(pkg)).toThrow("Checksum mismatch");
      });
    });
  });
});
