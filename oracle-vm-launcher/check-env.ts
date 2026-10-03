import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import * as common from "oci-common";
import * as core from "oci-core";
import * as identity from "oci-identity";

// Load .env from current directory or parent directory
const localEnvPath = path.resolve(process.cwd(), ".env");
const parentEnvPath = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(localEnvPath)) {
	dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(parentEnvPath)) {
	dotenv.config({ path: parentEnvPath });
} else {
	dotenv.config();
}

console.log("\n=======================================================");
console.log("   Oracle Cloud (OCI) Environment & Credential Check   ");
console.log("=======================================================\n");

function getAuthProvider(): {
	provider: common.AuthenticationDetailsProvider;
	compartmentId: string;
	region: string;
} {
	// 1. Check for standard ~/.oci/config or ./oci_config
	const localConfigPath = path.resolve(process.cwd(), "oci_config");
	const defaultOciConfig = path.resolve(
		process.env.USERPROFILE || process.env.HOME || "",
		".oci",
		"config",
	);

	if (fs.existsSync(localConfigPath)) {
		console.log(`[AUTH] Found local OCI config file at: ${localConfigPath}`);
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
		console.log(`[AUTH] Found default OCI config at: ${defaultOciConfig}`);
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

	// 2. Simple provider from environment variables
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
		console.error(
			"Please place your downloaded OCI private key (.pem) there or update OCI_PRIVATE_KEY_PATH.",
		);
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

async function main() {
	const { provider, compartmentId, region } = getAuthProvider();

	console.log(`[OCI] Region: ${region}`);
	console.log(`[OCI] Tenancy / Compartment: ${compartmentId.slice(0, 30)}...`);

	const identityClient = new identity.IdentityClient({
		authenticationDetailsProvider: provider,
	});
	const computeClient = new core.ComputeClient({
		authenticationDetailsProvider: provider,
	});
	const networkClient = new core.VirtualNetworkClient({
		authenticationDetailsProvider: provider,
	});

	// 1. Verify Connectivity & Availability Domains
	console.log("\n[1/4] Checking Availability Domains...");
	try {
		const adResp = await identityClient.listAvailabilityDomains({
			compartmentId,
		});
		const ads = adResp.items || [];
		if (ads.length === 0) {
			console.warn("  No Availability Domains returned.");
		} else {
			for (const ad of ads) {
				console.log(`  Found AD: ${ad.name}`);
			}
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`  Failed to list Availability Domains: ${msg}`);
		console.error(
			"  Check that your User OCID, Fingerprint, Tenancy OCID, and Private Key match OCI console.",
		);
		process.exit(1);
	}

	// 2. Check Virtual Cloud Networks (VCNs) & Subnets
	console.log("\n[2/4] Checking Virtual Cloud Networks (VCNs) & Subnets...");
	try {
		const vcnResp = await networkClient.listVcns({ compartmentId });
		const vcns = vcnResp.items || [];
		console.log(`  Found ${vcns.length} VCN(s):`);
		for (const vcn of vcns) {
			console.log(
				`  - VCN "${vcn.displayName}" (${vcn.id}) [CIDR: ${vcn.cidrBlock}]`,
			);
		}

		const subnetResp = await networkClient.listSubnets({ compartmentId });
		const subnets = subnetResp.items || [];
		console.log(`  Found ${subnets.length} Subnet(s):`);
		for (const subnet of subnets) {
			console.log(
				`  - Subnet "${subnet.displayName}" (${subnet.id}) [CIDR: ${subnet.cidrBlock}]`,
			);
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`  Failed to list network resources: ${msg}`);
	}

	// 3. Check Images for Canonical Ubuntu 24.04 ARM
	console.log("\n[3/4] Searching for Canonical Ubuntu 24.04 ARM images...");
	try {
		const imgResp = await computeClient.listImages({
			compartmentId,
			shape: "VM.Standard.A1.Flex",
			operatingSystem: "Canonical Ubuntu",
		});
		const images = imgResp.items || [];
		const exactMinimal = images.find(
			(img) =>
				img.displayName?.includes("24.04") &&
				img.displayName?.includes("Minimal") &&
				img.displayName?.includes("aarch64"),
		);

		if (exactMinimal) {
			console.log(
				`  Found exact match from your screenshot:\n    "${exactMinimal.displayName}"\n    (OCID: ${exactMinimal.id})`,
			);
		} else {
			const matching = images.filter(
				(img) =>
					img.displayName?.includes("Ubuntu") &&
					img.displayName?.includes("24.04") &&
					img.displayName?.includes("aarch64"),
			);
			for (const img of matching.slice(0, 3)) {
				console.log(`  - "${img.displayName}" (OCID: ${img.id})`);
			}
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`  Failed to query images: ${msg}`);
	}

	// 4. Verify SSH Key
	console.log("\n[4/4] Verifying SSH Key...");
	const sshKey =
		process.env.OCI_SSH_PUBLIC_KEY?.trim() ||
		(process.env.OCI_SSH_PUBLIC_KEY_PATH &&
		fs.existsSync(process.env.OCI_SSH_PUBLIC_KEY_PATH)
			? fs.readFileSync(process.env.OCI_SSH_PUBLIC_KEY_PATH, "utf8").trim()
			: "");

	if (!sshKey) {
		console.warn(
			"  No SSH public key found in OCI_SSH_PUBLIC_KEY or OCI_SSH_PUBLIC_KEY_PATH.",
		);
		console.warn(
			"  You will not be able to SSH into the created VM without an authorized key!",
		);
	} else if (
		sshKey.startsWith("ssh-rsa") ||
		sshKey.startsWith("ssh-ed25519") ||
		sshKey.startsWith("ecdsa-")
	) {
		console.log(`  Valid SSH public key detected: ${sshKey.slice(0, 35)}...`);
	} else {
		console.warn(
			`  SSH key format not standard (starts with "${sshKey.slice(0, 15)}..."). Please check.`,
		);
	}

	// 5. Existing Instances
	console.log("\n[5/5] Checking Existing Compute Instances...");
	try {
		const instances = await computeClient.listInstances({ compartmentId });
		const active = instances.items.filter(
			(i) =>
				i.lifecycleState !== core.models.Instance.LifecycleState.Terminated &&
				i.lifecycleState !== core.models.Instance.LifecycleState.Terminating,
		);
		if (active.length === 0) {
			console.log("  No active compute instances currently running.");
		} else {
			console.log(`  Found ${active.length} active instance(s):`);
			for (const inst of active) {
				console.log(
					`  - "${inst.displayName}" (${inst.shape}) - State: ${inst.lifecycleState}`,
				);
			}
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`  Unable to list instances: ${msg}`);
	}

	console.log("\n=======================================================");
	console.log("   Everything looks good! You can run: npm start       ");
	console.log("=======================================================\n");
}

main().catch((err) => {
	console.error("\nUnexpected error during environment check:", err);
	process.exit(1);
});
