// Encryption for sensitive memory data (EP2-Seguranca)
import crypto from "crypto";

export type SensitivityLevel = "pii" | "secret" | "confidential" | "public";

// Placeholder for KMS integration - in production would use actual KMS
const KMS_KEYS = {
  kms_key_pii: process.env.KMS_KEY_PII || "default-pii-key-32-chars-long!!",
  kms_key_secret:
    process.env.KMS_KEY_SECRET || "default-secret-key-32-chars-!!",
  kms_key_confidential:
    process.env.KMS_KEY_CONFIDENTIAL || "default-confid-key-32-chars-!!",
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(
  data: any,
  sensitivity: SensitivityLevel
): string | null {
  if (sensitivity === "public") {
    return null; // No encryption needed
  }

  try {
    const keyName = `kms_key_${sensitivity}` as keyof typeof KMS_KEYS;
    const key = KMS_KEYS[keyName];
    if (!key) return null;

    const plaintext = typeof data === "string" ? data : JSON.stringify(data);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(key, "utf-8").slice(0, 32),
      iv
    );

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (e) {
    console.error("Encryption error:", e);
    return null;
  }
}

export function decrypt(
  encryptedData: string,
  sensitivity: SensitivityLevel
): any {
  if (sensitivity === "public" || !encryptedData) {
    return encryptedData;
  }

  try {
    const keyName = `kms_key_${sensitivity}` as keyof typeof KMS_KEYS;
    const key = KMS_KEYS[keyName];
    if (!key) return encryptedData;

    const parts = encryptedData.split(":");
    if (parts.length !== 3) return encryptedData;

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(key, "utf-8").slice(0, 32),
      iv
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (e) {
    console.error("Decryption error:", e);
    return encryptedData;
  }
}

export function shouldEncrypt(sensitivity?: string): boolean {
  return (
    sensitivity !== "public" &&
    sensitivity !== undefined &&
    sensitivity !== null
  );
}
