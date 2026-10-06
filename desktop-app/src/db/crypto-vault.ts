import crypto from "node:crypto";

const SALT = "daypulse-salt-vault-tokens";
const VAULT_SECRET =
	process.env.TOKEN_ENCRYPTION_SECRET ||
	"daypulse-aes-gcm-secret-key-32-bytes-secure";
const VAULT_ALGORITHM = process.env.TOKEN_ENCRYPTION_ALGORITHM || "aes-256-gcm";
const VAULT_ROUNDS = Number(process.env.TOKEN_ENCRYPTION_ROUNDS) || 10000;

function getDerivedKey(): Buffer {
	return crypto.pbkdf2Sync(VAULT_SECRET, SALT, VAULT_ROUNDS, 32, "sha256");
}

export function encryptToken(plainText: string): string {
	if (!plainText) return "";

	const key = getDerivedKey();
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(
		VAULT_ALGORITHM,
		key,
		iv,
	) as unknown as crypto.CipherGCM;

	let encrypted = cipher.update(plainText, "utf8", "hex");
	encrypted += cipher.final("hex");

	const authTag =
		typeof cipher.getAuthTag === "function"
			? cipher.getAuthTag()
			: Buffer.alloc(0);
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

	const decipher = crypto.createDecipheriv(
		VAULT_ALGORITHM,
		key,
		iv,
	) as unknown as crypto.DecipherGCM;
	if (authTag.length > 0 && typeof decipher.setAuthTag === "function") {
		decipher.setAuthTag(authTag);
	}

	let decrypted = decipher.update(encryptedHex, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}
