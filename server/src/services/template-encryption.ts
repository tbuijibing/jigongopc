import crypto from "crypto";
import zlib from "zlib";

// ============================================
// Template Encryption Service
// AES-256-GCM with digital signatures
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SIGN_ALGORITHM = "sha256";

// Layer interfaces for core/customization separation
export interface Layer {
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface EncryptedPackage {
  iv: string;
  encryptedData: string;
  authTag: string;
  algorithm: string;
}

export interface TemplatePackage {
  version: string;
  format: "template-package";
  coreLayer: Layer;
  customizationLayer: Layer;
  metadata: {
    createdAt: string;
    checksum: string;
    compressed: boolean;
  };
}

export interface PackagedTemplate {
  version: string;
  signature?: string;
  core: EncryptedPackage;
  customization: string; // JSON string (plaintext)
  manifest: {
    name: string;
    version: string;
    encrypted: boolean;
    compressed: boolean;
  };
}

// ============================================
// AES-256-GCM Encryption/Decryption
// ============================================

/**
 * Encrypt template content using AES-256-GCM
 * @param content - The plaintext content to encrypt
 * @param key - The encryption key (32 bytes for AES-256)
 * @returns EncryptedPackage with IV, encrypted data, and auth tag
 * @throws Error if key is invalid or encryption fails
 */
export function encryptTemplate(content: string, key: Buffer): EncryptedPackage {
  // Validate key length
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }

  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt content
    let encrypted = cipher.update(content, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString("hex"),
      encryptedData: encrypted,
      authTag: authTag.toString("hex"),
      algorithm: ALGORITHM,
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt template content using AES-256-GCM
 * @param encryptedPackage - The encrypted package containing IV, data, and auth tag
 * @param key - The decryption key (32 bytes for AES-256)
 * @returns The decrypted plaintext content
 * @throws Error if key is invalid, auth tag verification fails, or decryption fails
 */
export function decryptTemplate(encryptedPackage: EncryptedPackage, key: Buffer): string {
  // Validate key length
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }

  // Validate package
  if (!encryptedPackage.iv || typeof encryptedPackage.iv !== "string" ||
      typeof encryptedPackage.encryptedData !== "string" ||
      !encryptedPackage.authTag || typeof encryptedPackage.authTag !== "string") {
    throw new Error("Invalid encrypted package: missing required fields");
  }

  try {
    const iv = Buffer.from(encryptedPackage.iv, "hex");
    const authTag = Buffer.from(encryptedPackage.authTag, "hex");

    // Validate buffer lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt content
    let decrypted = decipher.update(encryptedPackage.encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unsupported state")) {
      throw new Error("Decryption failed: authentication tag verification failed");
    }
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// Digital Signatures (RSA and ECDSA)
// ============================================

/**
 * Generate RSA key pair for digital signatures
 * @param keySize - Key size in bits (default: 2048)
 * @returns Object containing PEM-encoded public and private keys
 */
export function generateRSAKeyPair(keySize: number = 2048): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: keySize,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { publicKey, privateKey };
}

/**
 * Generate ECDSA key pair for digital signatures
 * Uses P-256 curve (secp256r1)
 * @returns Object containing PEM-encoded public and private keys
 */
export function generateECDSAKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1", // P-256
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { publicKey, privateKey };
}

/**
 * Sign template content with private key using RSA-SHA256
 * @param content - The content to sign
 * @param privateKey - PEM-encoded private key
 * @returns Hex-encoded signature string
 * @throws Error if signing fails
 */
export function signTemplate(content: string, privateKey: string): string {
  try {
    const signer = crypto.createSign(SIGN_ALGORITHM);
    signer.update(content, "utf8");
    signer.end();

    return signer.sign(privateKey, "hex");
  } catch (error) {
    throw new Error(`Signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sign template content with private key using ECDSA
 * @param content - The content to sign
 * @param privateKey - PEM-encoded ECDSA private key
 * @returns Hex-encoded signature string
 * @throws Error if signing fails
 */
export function signTemplateECDSA(content: string, privateKey: string): string {
  try {
    const signer = crypto.createSign("sha256");
    signer.update(content, "utf8");
    signer.end();

    return signer.sign(privateKey, "hex");
  } catch (error) {
    throw new Error(`ECDSA signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify template content signature with public key (RSA or ECDSA)
 * @param content - The content that was signed
 * @param signature - Hex-encoded signature string
 * @param publicKey - PEM-encoded public key
 * @returns True if signature is valid, false otherwise
 * @throws Error if verification fails due to invalid inputs
 */
export function verifyTemplate(content: string, signature: string, publicKey: string): boolean {
  try {
    const verifier = crypto.createVerify(SIGN_ALGORITHM);
    verifier.update(content, "utf8");
    verifier.end();

    return verifier.verify(publicKey, signature, "hex");
  } catch (error) {
    throw new Error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify template content signature with ECDSA public key
 * @param content - The content that was signed
 * @param signature - Hex-encoded signature string
 * @param publicKey - PEM-encoded ECDSA public key
 * @returns True if signature is valid, false otherwise
 * @throws Error if verification fails due to invalid inputs
 */
export function verifyTemplateECDSA(content: string, signature: string, publicKey: string): boolean {
  try {
    const verifier = crypto.createVerify("sha256");
    verifier.update(content, "utf8");
    verifier.end();

    return verifier.verify(publicKey, signature, "hex");
  } catch (error) {
    throw new Error(`ECDSA verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// Template Package Packing/Unpacking
// ============================================

/**
 * Compress content using zlib deflate
 * @param content - String content to compress
 * @returns Compressed content as base64 string
 */
function compressContent(content: string): string {
  const compressed = zlib.deflateSync(Buffer.from(content, "utf8"));
  return compressed.toString("base64");
}

/**
 * Decompress content using zlib inflate
 * @param compressed - Base64 compressed content
 * @returns Decompressed string
 */
function decompressContent(compressed: string): string {
  const decompressed = zlib.inflateSync(Buffer.from(compressed, "base64"));
  return decompressed.toString("utf8");
}

/**
 * Calculate SHA-256 checksum of content
 * @param content - String content to hash
 * @returns Hex-encoded hash
 */
function calculateChecksum(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Pack template layers into a template package
 * Core layer and customization layer are combined into a structured format
 * Content is compressed before packing for efficiency
 * @param coreLayer - The core template layer (encrypted or plaintext)
 * @param customizationLayer - The customization layer (user-specific settings)
 * @returns TemplatePackage containing both layers and metadata
 */
export function packTemplate(coreLayer: Layer, customizationLayer: Layer): TemplatePackage {
  // Compress layers for efficiency
  const compressedCore = {
    ...coreLayer,
    content: compressContent(coreLayer.content),
  };
  const compressedCustomization = {
    ...customizationLayer,
    content: compressContent(customizationLayer.content),
  };

  // Create package structure
  const packageData: TemplatePackage = {
    version: "1.0",
    format: "template-package",
    coreLayer: compressedCore,
    customizationLayer: compressedCustomization,
    metadata: {
      createdAt: new Date().toISOString(),
      checksum: "", // Will be set after serialization
      compressed: true,
    },
  };

  // Calculate checksum of the package content
  const serialized = JSON.stringify({
    core: compressedCore,
    customization: compressedCustomization,
    version: packageData.version,
    format: packageData.format,
  });
  packageData.metadata.checksum = calculateChecksum(serialized);

  return packageData;
}

/**
 * Unpack a template package into core and customization layers
 * Handles decompression and integrity verification
 * @param pkg - The template package to unpack
 * @returns Object containing coreLayer and customizationLayer
 * @throws Error if package is invalid or checksum verification fails
 */
export function unpackTemplate(pkg: TemplatePackage): { coreLayer: Layer; customizationLayer: Layer } {
  // Validate package structure
  if (!pkg || typeof pkg !== "object") {
    throw new Error("Invalid package: expected an object");
  }
  if (pkg.format !== "template-package") {
    throw new Error(`Invalid package format: expected "template-package", got "${pkg.format}"`);
  }
  if (!pkg.coreLayer) {
    throw new Error("Invalid package: missing coreLayer");
  }
  if (!pkg.customizationLayer) {
    throw new Error("Invalid package: missing customizationLayer");
  }
  if (!pkg.metadata) {
    throw new Error("Invalid package: missing metadata");
  }

  try {
    // Verify checksum
    const serialized = JSON.stringify({
      core: pkg.coreLayer,
      customization: pkg.customizationLayer,
      version: pkg.version,
      format: pkg.format,
    });
    const calculatedChecksum = calculateChecksum(serialized);

    if (calculatedChecksum !== pkg.metadata.checksum) {
      throw new Error(`Checksum mismatch: expected ${pkg.metadata.checksum}, got ${calculatedChecksum}`);
    }

    // Decompress layers if compressed
    const coreLayer: Layer = {
      ...pkg.coreLayer,
      content: pkg.metadata.compressed ? decompressContent(pkg.coreLayer.content) : pkg.coreLayer.content,
    };

    const customizationLayer: Layer = {
      ...pkg.customizationLayer,
      content: pkg.metadata.compressed ? decompressContent(pkg.customizationLayer.content) : pkg.customizationLayer.content,
    };

    return { coreLayer, customizationLayer };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Checksum mismatch")) {
      throw error;
    }
    throw new Error(`Unpacking failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a secure random encryption key
 * @returns 32-byte encryption key as hex string
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a secure random encryption key as Buffer
 * @returns 32-byte Buffer containing the key
 */
export function generateEncryptionKeyBuffer(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Validate that a Buffer is exactly 32 bytes (for AES-256)
 * @param key - The key to validate
 * @throws Error if key is invalid
 */
export function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key)) {
    throw new Error("Key must be a Buffer");
  }
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be exactly ${KEY_LENGTH} bytes, got ${key.length}`);
  }
}

/**
 * Create a layer from string content
 * @param name - Layer name identifier
 * @param content - String content
 * @param metadata - Optional metadata
 * @returns Layer object
 */
export function createLayer(name: string, content: string, metadata?: Record<string, unknown>): Layer {
  return {
    name,
    content,
    metadata,
  };
}

// ============================================
// Service Factory for Dependency Injection
// ============================================

export interface TemplateEncryptionService {
  encryptTemplate: typeof encryptTemplate;
  decryptTemplate: typeof decryptTemplate;
  signTemplate: typeof signTemplate;
  verifyTemplate: typeof verifyTemplate;
  packTemplate: typeof packTemplate;
  unpackTemplate: typeof unpackTemplate;
  generateRSAKeyPair: typeof generateRSAKeyPair;
  generateECDSAKeyPair: typeof generateECDSAKeyPair;
  signTemplateECDSA: typeof signTemplateECDSA;
  verifyTemplateECDSA: typeof verifyTemplateECDSA;
  generateEncryptionKey: typeof generateEncryptionKey;
  generateEncryptionKeyBuffer: typeof generateEncryptionKeyBuffer;
  validateKey: typeof validateKey;
  createLayer: typeof createLayer;
}

/**
 * Service factory for dependency injection
 * @returns TemplateEncryptionService instance
 */
export function createTemplateEncryptionService(): TemplateEncryptionService {
  return {
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
    generateEncryptionKey,
    generateEncryptionKeyBuffer,
    validateKey,
    createLayer,
  };
}

// Default export for convenience
export default createTemplateEncryptionService;
