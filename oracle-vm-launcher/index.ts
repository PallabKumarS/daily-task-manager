import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import * as common from "oci-common";
import * as core from "oci-core";
import * as identity from "oci-identity";

import { resolveAvailabilityDomain } from "./src/ad-resolver.js";
import { getAuthProvider, getSshKey } from "./src/auth-provider.js";
import { resolveImageId } from "./src/image-resolver.js";
import { createLaunchDetails } from "./src/launch-details-builder.js";
import { setupLogFilter } from "./src/logger-filter.js";
import { resolveSubnet } from "./src/network-resolver.js";
import type { InstanceRecord, LaunchConfig } from "./src/types.js";
import { fetchVnicIps } from "./src/vnic-helper.js";

// Load .env
const localEnv = path.resolve(process.cwd(), ".env");
const parentEnv = path.resolve(process.cwd(), "..", ".env");
dotenv.config({ path: fs.existsSync(localEnv) ? localEnv : parentEnv });

setupLogFilter();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const faultDomainCycle = ["FAULT-DOMAIN-1", "FAULT-DOMAIN-2", "FAULT-DOMAIN-3"];

function loadConfig(): LaunchConfig {
	const rawNames =
		process.env.OCI_INSTANCE_NAMES?.trim() ||
		process.env.OCI_INSTANCE_NAME?.trim() ||
		"backend,frontend";

	return {
		targetInstanceNames: rawNames
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		shape: process.env.OCI_SHAPE?.trim() || "VM.Standard.A1.Flex",
		ocpus: Number.parseInt(process.env.OCI_OCPUS || "1", 10),
		memoryInGBs: Number.parseInt(process.env.OCI_MEMORY_IN_GBS || "6", 10),
		bootVolumeSize: Number.parseInt(
			process.env.OCI_BOOT_VOLUME_SIZE_IN_GBS || "100",
			10,
		),
		bootVolumeVpu: Number.parseInt(process.env.OCI_BOOT_VOLUME_VPU || "10", 10),
		configuredFaultDomain: process.env.OCI_FAULT_DOMAIN?.trim(),
		assignPublicIp: process.env.OCI_ASSIGN_PUBLIC_IP !== "false",
		retryInterval: Number.parseInt(
			process.env.OCI_RETRY_INTERVAL_SECONDS || "60",
			10,
		),
	};
}

async function main() {
	console.log(
		"\n==================================================================",
	);
	console.log(
		"   Oracle Cloud (OCI) ARM VM Always Free Auto-Launcher Loop       ",
	);
	console.log(
		"==================================================================\n",
	);

	const config = loadConfig();
	const { provider, compartmentId, region } = getAuthProvider();
	const sshKey = getSshKey();

	const computeClient = new core.ComputeClient(
		{ authenticationDetailsProvider: provider },
		{ retryConfiguration: common.NoRetryConfigurationDetails },
	);
	const networkClient = new core.VirtualNetworkClient({
		authenticationDetailsProvider: provider,
	});
	const identityClient = new identity.IdentityClient({
		authenticationDetailsProvider: provider,
	});

	const availabilityDomain = await resolveAvailabilityDomain(
		identityClient,
		compartmentId,
	);
	const imageId = await resolveImageId(computeClient, compartmentId);
	const subnetId = await resolveSubnet(networkClient, compartmentId);

	console.log("\n=======================================================");
	console.log("   Target Instance Specifications (Matches image_87): ");
	console.log("=======================================================");
	console.log(`- Instance Queue:     ${config.targetInstanceNames.join(", ")}`);
	console.log(`- Total Instances:    ${config.targetInstanceNames.length}`);
	console.log(
		`- Per-VM Shape:       ${config.shape} (${config.ocpus} OCPU, ${config.memoryInGBs} GB RAM)`,
	);
	console.log(
		`- Per-VM Boot Volume: ${config.bootVolumeSize} GB (VPU: ${config.bootVolumeVpu})`,
	);
	console.log(`- Availability Domain:${availabilityDomain}`);
	console.log(
		`- Fault Domain:       ${config.configuredFaultDomain || "Auto (cycling 1, 2, 3)"}`,
	);
	console.log(`- Region:             ${region}`);
	console.log(`- Subnet ID:          ${subnetId}`);
	console.log(`- Assign Public IP:   ${config.assignPublicIp}`);
	console.log(`- Retry Interval:     ${config.retryInterval} seconds`);
	console.log("=======================================================\n");

	// Inspect existing instances in compartment
	console.log("Checking existing instances in your OCI compartment...");
	const existingListRes = await computeClient.listInstances({ compartmentId });
	const activeInstances = existingListRes.items.filter(
		(i) =>
			i.lifecycleState !== core.models.Instance.LifecycleState.Terminated &&
			i.lifecycleState !== core.models.Instance.LifecycleState.Terminating,
	);

	const records: InstanceRecord[] = [];
	const pendingTargets: string[] = [];

	for (const targetName of config.targetInstanceNames) {
		const existingMatch = activeInstances.find(
			(i) => i.displayName === targetName,
		);
		if (existingMatch) {
			console.log(
				`[EXISTS] Instance "${targetName}" is already active (OCID: ${existingMatch.id}). Skipping creation.`,
			);
			records.push({
				name: targetName,
				id: existingMatch.id,
				lifecycleState: existingMatch.lifecycleState,
			});
		} else {
			pendingTargets.push(targetName);
		}
	}

	const stateFilePath = path.resolve(process.cwd(), "created_instances.json");
	const saveState = () => {
		try {
			fs.writeFileSync(stateFilePath, JSON.stringify(records, null, 2), "utf8");
		} catch {
			// Ignore file save errors
		}
	};
	saveState();

	if (pendingTargets.length === 0) {
		console.log(
			"\nAll specified target instances are already created and active!",
		);
		console.log(`State recorded in: ${stateFilePath}`);
		return;
	}

	let attemptCount = 1;
	let currentTargetIndex = 0;
	const pendingTargetsQueue = [...pendingTargets];

	console.log(
		`Starting automated launch queue (${pendingTargetsQueue.length} VMs remaining: [${pendingTargetsQueue.join(", ")}]).`,
	);
	console.log(
		`Alternating targets every ${config.retryInterval}s across all 3 fault domains.\n`,
	);

	while (pendingTargetsQueue.length > 0) {
		const targetName =
			pendingTargetsQueue[currentTargetIndex % pendingTargetsQueue.length];
		const fdIndex = (attemptCount - 1) % faultDomainCycle.length;
		const faultDomain =
			config.configuredFaultDomain || faultDomainCycle[fdIndex];

		const timeStr = new Date().toISOString().slice(11, 19);
		process.stdout.write(
			`[#${attemptCount} | ${targetName.padEnd(8)} | ${faultDomain} | ${timeStr}] Launching... `,
		);

		const launchRequest = createLaunchDetails({
			targetName,
			faultDomain,
			compartmentId,
			availabilityDomain,
			imageId,
			subnetId,
			sshKey,
			config,
		});

		try {
			const res = await computeClient.launchInstance(launchRequest);
			const instance = res.instance;

			console.log(
				`\n\n=======================================================`,
			);
			console.log(`   SUCCESS! "${instance.displayName}" CREATED!        `);
			console.log(`=======================================================`);
			console.log(`- Instance Name:    ${instance.displayName}`);
			console.log(`- Instance OCID:    ${instance.id}`);
			console.log(`- Lifecycle State:  ${instance.lifecycleState}`);
			console.log(`- Fault Domain:     ${instance.faultDomain}`);
			console.log(`- Created At:       ${instance.timeCreated}`);
			console.log(`=======================================================`);

			process.stdout.write("\x07\x07\x07");

			console.log(
				`\nWaiting 15 seconds to fetch assigned Public IP for "${targetName}"...`,
			);
			await sleep(15000);

			const { publicIp, privateIp } = await fetchVnicIps(
				computeClient,
				networkClient,
				compartmentId,
				instance.id,
			);
			console.log(`- Public IP:   ${publicIp || "None assigned"}`);
			console.log(`- Private IP:  ${privateIp || "None assigned"}`);
			if (publicIp) {
				console.log(`\nConnect with:\n  ssh ubuntu@${publicIp}\n`);
			}

			records.push({
				name: targetName,
				id: instance.id,
				lifecycleState: instance.lifecycleState,
				publicIp,
				privateIp,
			});
			saveState();

			const idx = pendingTargetsQueue.indexOf(targetName);
			if (idx !== -1) {
				pendingTargetsQueue.splice(idx, 1);
			}

			if (pendingTargetsQueue.length === 0) {
				console.log("\nAll target instances successfully provisioned!");
				break;
			}

			console.log(
				`\nRemaining to provision: [${pendingTargetsQueue.join(", ")}]. Next attempt in ${config.retryInterval}s...\n`,
			);
			attemptCount++;
			await sleep(config.retryInterval * 1000);
		} catch (err: unknown) {
			const error = err as {
				statusCode?: number;
				serviceCode?: string;
				message?: string;
			};
			const msg = error.message || String(err);
			const code = error.serviceCode || "";
			const status = error.statusCode;

			let waitSeconds = config.retryInterval;
			const isOutOfCapacity =
				status === 500 ||
				code === "InternalError" ||
				code === "OutOfCapacity" ||
				code === "TooManyRequests" ||
				status === 429 ||
				msg.includes("Out of host capacity") ||
				msg.includes("capacity");

			if (isOutOfCapacity) {
				if (
					msg.includes("Too many requests") ||
					code === "TooManyRequests" ||
					status === 429
				) {
					waitSeconds = Math.max(config.retryInterval, 60) + 10;
					console.log(
						`Rate limited on ${faultDomain}. Adding cooldown, retrying in ${waitSeconds}s...`,
					);
				} else {
					console.log(
						`Out of host capacity on ${faultDomain}. Retrying in ${waitSeconds}s...`,
					);
				}
			} else {
				console.log(`Failed (Status: ${status}, Code: ${code}): ${msg}`);
				if (status === 400 || status === 401 || status === 404) {
					console.error(
						"\n[CRITICAL ERROR] The request was rejected by OCI due to invalid credentials or parameters.",
					);
					console.error(
						"Please verify your .env settings and run 'npm run check-env' to troubleshoot.",
					);
					process.exit(1);
				}
			}

			currentTargetIndex++;
			attemptCount++;
			await sleep(waitSeconds * 1000);
		}
	}

	console.log("\n=======================================================");
	console.log("   ALL TARGET INSTANCES SUCCESSFULLY PROVISIONED!      ");
	console.log("=======================================================");
	for (const rec of records) {
		console.log(
			`- ${rec.name.padEnd(15)} | IP: ${(rec.publicIp || "Pending").padEnd(16)} | OCID: ${rec.id || "N/A"}`,
		);
	}
	console.log("=======================================================\n");
	console.log(`Saved provisioning summary to: ${stateFilePath}`);
}

main().catch((err) => {
	console.error("\nUnexpected fatal error:", err);
	process.exit(1);
});
