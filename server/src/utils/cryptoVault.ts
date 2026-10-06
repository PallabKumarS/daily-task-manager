import crypto from "node:crypto";
import config from "../config/index.js";

const SALT = "daypulse-salt-vault-tokens";

function getDerivedKey(): Buffer {
	return crypto.pbkdf2Sync(config.vault.secret, SALT, config.vault.rounds, 32, "sha256");
}

export function encryptToken(plainText: string): string {
	if (!plainText) return "";

	const key = getDerivedKey();
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(config.vault.algorithm, key, iv);

	let encrypted = cipher.update(plainText, "utf8", "hex");
	encrypted += cipher.final("hex");

	const authTag =
		(cipher as unknown as { getAuthTag?: () => Buffer }).getAuthTag?.() || Buffer.alloc(0);

	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(cipherPackage: string): string {
	if (!cipherPackage) return "";

	const parts = cipherPackage.split(":");
	if (parts.length < 3) {
		return cipherPackage;
	}

	const [ivHex, authTagHex, encryptedHex] = parts;
	const key = getDerivedKey();
	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");

	const decipher = crypto.createDecipheriv(config.vault.algorithm, key, iv);

	if (
		authTag.length > 0 &&
		typeof (decipher as unknown as { setAuthTag?: (tag: Buffer) => void }).setAuthTag === "function"
	) {
		(decipher as unknown as { setAuthTag: (tag: Buffer) => void }).setAuthTag(authTag);
	}

	let decrypted = decipher.update(encryptedHex, "hex", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}
