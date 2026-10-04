import * as fs from "node:fs";
import * as path from "node:path";
import * as common from "oci-common";
import type { AuthProviderResult } from "./types.js";

export function getAuthProvider(): AuthProviderResult {
	const localConfigPath = path.resolve(process.cwd(), "oci_config");
	const defaultOciConfig = path.resolve(
		process.env.USERPROFILE || process.env.HOME || "",
		".oci",
		"config",
	);

	if (fs.existsSync(localConfigPath)) {
		const provider = new common.ConfigFileAuthenticationDetailsProvider(
			localConfigPath,
			"DEFAULT",
		);
		const compartmentId =
			process.env.OCI_COMPARTMENT_OCID ||
			provider.getTenantId() ||
			process.env.OCI_TENANCY_OCID ||
			"";
		return {
			provider,
			compartmentId,
			region: provider.getRegion().regionId,
		};
	}

	if (
		fs.existsSync(defaultOciConfig) &&
		!process.env.OCI_USER_OCID &&
		!process.env.OCI_PRIVATE_KEY_PATH
	) {
		const provider = new common.ConfigFileAuthenticationDetailsProvider(
			defaultOciConfig,
			"DEFAULT",
		);
		const compartmentId =
			process.env.OCI_COMPARTMENT_OCID ||
			provider.getTenantId() ||
			process.env.OCI_TENANCY_OCID ||
			"";
		return {
			provider,
			compartmentId,
			region: provider.getRegion().regionId,
		};
	}

	const tenancyId = process.env.OCI_TENANCY_OCID?.trim();
	const userId = process.env.OCI_USER_OCID?.trim();
	const fingerprint = process.env.OCI_FINGERPRINT?.trim();
	const regionStr = process.env.OCI_REGION?.trim() || "ap-singapore-1";
	const keyPath = process.env.OCI_PRIVATE_KEY_PATH?.trim();

	if (!tenancyId || !userId || !fingerprint || !keyPath) {
		console.error("Missing required environment variables in .env:");
		if (!tenancyId) console.error("  - OCI_TENANCY_OCID");
		if (!userId) console.error("  - OCI_USER_OCID");
		if (!fingerprint) console.error("  - OCI_FINGERPRINT");
		if (!keyPath) console.error("  - OCI_PRIVATE_KEY_PATH");
		console.error(
			"\nPlease copy .env.example to .env and fill in your OCI credentials.",
		);
		process.exit(1);
	}

	const resolvedKeyPath = path.isAbsolute(keyPath)
		? keyPath
		: path.resolve(process.cwd(), keyPath);

	if (!fs.existsSync(resolvedKeyPath)) {
		console.error(`Private key file not found at: ${resolvedKeyPath}`);
		process.exit(1);
	}

	const privateKey = fs.readFileSync(resolvedKeyPath, "utf8");
	const region = common.Region.fromRegionId(regionStr);
	const compartmentId = process.env.OCI_COMPARTMENT_OCID?.trim() || tenancyId;

	const provider = new common.SimpleAuthenticationDetailsProvider(
		tenancyId,
		userId,
		fingerprint,
		privateKey,
		process.env.OCI_PASSPHRASE || null,
		region,
	);

	return { provider, compartmentId, region: regionStr };
}

export function getSshKey(): string {
	let key = process.env.OCI_SSH_PUBLIC_KEY?.trim() || "";
	if (!key && process.env.OCI_SSH_PUBLIC_KEY_PATH) {
		const resolved = path.isAbsolute(process.env.OCI_SSH_PUBLIC_KEY_PATH)
			? process.env.OCI_SSH_PUBLIC_KEY_PATH
			: path.resolve(process.cwd(), process.env.OCI_SSH_PUBLIC_KEY_PATH);
		if (fs.existsSync(resolved)) {
			key = fs.readFileSync(resolved, "utf8").trim();
		}
	}

	if (!key) {
		console.error(
			"No SSH Public Key provided in OCI_SSH_PUBLIC_KEY or OCI_SSH_PUBLIC_KEY_PATH.",
		);
		console.error("Please add your SSH public key so you can access your VM.");
		process.exit(1);
	}
	return key;
}
