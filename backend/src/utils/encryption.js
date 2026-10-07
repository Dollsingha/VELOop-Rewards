import crypto from "crypto";
import { httpError } from "./httpError.js";

export function assertPayoutEncryptionKey() {
  encryptionKey();
}

function encryptionKey() {
  const configured = process.env.PAYOUT_DETAILS_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(configured)) {
    throw new Error("PAYOUT_DETAILS_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  }
  return Buffer.from(configured, "hex");
}

export function encryptPayoutDetails(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("hex")}.${tag.toString("hex")}.${ciphertext.toString("base64url")}`;
}

export function decryptPayoutDetails(encrypted) {
  if (typeof encrypted !== "string") throw httpError("Payout details are unavailable.", 500);
  const [version, ivHex, tagHex, ciphertext] = encrypted.split(".");
  if (version !== "v1" || !ivHex || !tagHex || !ciphertext) {
    throw httpError("Payout details are unavailable.", 500);
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()
    ]).toString("utf8");
    return JSON.parse(plaintext);
  } catch {
    throw new Error("Payout details could not be decrypted. Check PAYOUT_DETAILS_ENCRYPTION_KEY.");
  }
}

