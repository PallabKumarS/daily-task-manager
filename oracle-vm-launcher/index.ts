import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import * as common from "oci-common";
import * as core from "oci-core";
import * as identity from "oci-identity";

// Load .env
const localEnvPath = path.resolve(process.cwd(), ".env");
const parentEnvPath = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
} else {
  dotenv.config();
}

console.log(
  "\n==================================================================",
);
console.log(
  "   Oracle Cloud (OCI) ARM VM Always Free Auto-Launcher Loop       ",
);
console.log(
  "==================================================================\n",
);

function getAuthProvider(): {
  provider: common.AuthenticationDetailsProvider;
  compartmentId: string;
  region: string;
} {
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

function getSshKey(): string {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveSubnet(
  networkClient: core.VirtualNetworkClient,
  compartmentId: string,
): Promise<string> {
  if (process.env.OCI_SUBNET_OCID?.trim()) {
    return process.env.OCI_SUBNET_OCID.trim();
  }

  const targetSubnetName =
    process.env.OCI_SUBNET_NAME?.trim() || "subnet-nodejs";
  const targetVcnName = process.env.OCI_VCN_NAME?.trim() || "vcn-nodejs";

  console.log(
    `[NETWORK] Searching for existing subnet "${targetSubnetName}"...`,
  );
  const subnetResp = await networkClient.listSubnets({ compartmentId });
  const subnets = subnetResp.items || [];

  const matchedSubnet = subnets.find(
    (s) =>
      s.displayName === targetSubnetName ||
      s.displayName?.toLowerCase().includes("public") ||
      s.displayName?.toLowerCase().includes("nodejs"),
  );

  if (matchedSubnet) {
    console.log(
      `[NETWORK] Found existing subnet "${matchedSubnet.displayName}" (${matchedSubnet.id})`,
    );
    return matchedSubnet.id;
  }

  if (subnets.length > 0) {
    console.log(
      `[NETWORK] Subnet "${targetSubnetName}" not found by exact name. Using first available: "${subnets[0].displayName}" (${subnets[0].id})`,
    );
    return subnets[0].id;
  }

  // If no subnet exists at all, automatically create VCN + Internet Gateway + Route Table + Subnet
  console.log(
    `[NETWORK] No subnets found in compartment. Automatically creating "${targetVcnName}" and "${targetSubnetName}"...`,
  );

  // 1. Create VCN
  const vcn = await networkClient.createVcn({
    createVcnDetails: {
      compartmentId,
      displayName: targetVcnName,
      cidrBlock: "10.0.0.0/16",
      dnsLabel: "vcnnodejs",
    },
  });
  console.log(`[NETWORK] Created VCN "${targetVcnName}" (${vcn.vcn.id})`);

  // 2. Create Internet Gateway
  const ig = await networkClient.createInternetGateway({
    createInternetGatewayDetails: {
      compartmentId,
      vcnId: vcn.vcn.id,
      displayName: "ig-nodejs",
      isEnabled: true,
    },
  });
  console.log(`[NETWORK] Created Internet Gateway (${ig.internetGateway.id})`);

  // 3. Update Default Route Table with 0.0.0.0/0 -> Internet Gateway
  const defaultRtId = vcn.vcn.defaultRouteTableId;
  await networkClient.updateRouteTable({
    rtId: defaultRtId as string,
    updateRouteTableDetails: {
      routeRules: [
        {
          destination: "0.0.0.0/0",
          destinationType: core.models.RouteRule.DestinationType.CidrBlock,
          networkEntityId: ig.internetGateway.id,
          description: "Default internet route",
        },
      ],
    },
  });
  console.log("[NETWORK] Configured default route table for internet access");

  // 4. Update Default Security List to allow SSH (port 22)
  const defaultSecListId = vcn.vcn.defaultSecurityListId;
  await networkClient.updateSecurityList({
    securityListId: defaultSecListId as string,
    updateSecurityListDetails: {
      ingressSecurityRules: [
        {
          protocol: "6", // TCP
          source: "0.0.0.0/0",
          tcpOptions: {
            destinationPortRange: { min: 22, max: 22 },
          },
          description: "Allow SSH inbound",
        },
        {
          protocol: "1", // ICMP
          source: "0.0.0.0/0",
          description: "Allow ICMP ping",
        },
      ],
    },
  });
  console.log(
    "[NETWORK] Configured security list to allow inbound SSH (port 22)",
  );

  // 5. Create Subnet
  const subnet = await networkClient.createSubnet({
    createSubnetDetails: {
      compartmentId,
      vcnId: vcn.vcn.id,
      displayName: targetSubnetName,
      cidrBlock: "10.0.0.0/24",
      dnsLabel: "subnetnodejs",
      routeTableId: defaultRtId,
      securityListIds: [defaultSecListId as string],
    },
  });
  console.log(
    `[NETWORK] Successfully created public subnet "${targetSubnetName}" (${subnet.subnet.id})`,
  );
  return subnet.subnet.id;
}

async function resolveImageId(
  computeClient: core.ComputeClient,
  compartmentId: string,
): Promise<string> {
  if (process.env.OCI_IMAGE_OCID?.trim()) {
    return process.env.OCI_IMAGE_OCID.trim();
  }

  console.log(
    "[IMAGE] Resolving latest Canonical Ubuntu 24.04 ARM (aarch64) image...",
  );
  const imgResp = await computeClient.listImages({
    compartmentId,
    shape: "VM.Standard.A1.Flex",
    operatingSystem: "Canonical Ubuntu",
  });
  const images = imgResp.items || [];

  // Prioritize exact match for Canonical Ubuntu 24.04 Minimal aarch64
  const minimal2404 = images.find(
    (img) =>
      img.displayName?.includes("24.04") &&
      img.displayName?.includes("Minimal") &&
      img.displayName?.includes("aarch64"),
  );

  if (minimal2404) {
    console.log(
      `[IMAGE] Selected: "${minimal2404.displayName}" (${minimal2404.id})`,
    );
    return minimal2404.id;
  }

  const standard2404 = images.find(
    (img) =>
      img.displayName?.includes("24.04") &&
      img.displayName?.includes("aarch64"),
  );

  if (standard2404) {
    console.log(
      `[IMAGE] Selected: "${standard2404.displayName}" (${standard2404.id})`,
    );
    return standard2404.id;
  }

  if (images.length > 0) {
    console.log(
      `[IMAGE] Using first available Ubuntu ARM image: "${images[0].displayName}" (${images[0].id})`,
    );
    return images[0].id;
  }

  throw new Error(
    "Could not find an Ubuntu ARM image for shape VM.Standard.A1.Flex in this region.",
  );
}

async function resolveAvailabilityDomain(
  identityClient: identity.IdentityClient,
  compartmentId: string,
): Promise<string> {
  if (process.env.OCI_AVAILABILITY_DOMAIN?.trim()) {
    return process.env.OCI_AVAILABILITY_DOMAIN.trim();
  }

  const adResp = await identityClient.listAvailabilityDomains({
    compartmentId,
  });
  const ads = adResp.items || [];
  if (ads.length === 0) {
    throw new Error("No Availability Domains found for compartment.");
  }

  const ad1 = ads.find((a) => a?.name?.includes("AD-1"));
  const selected = ad1 ? ad1.name : ads[0].name;
  console.log(`[AD] Selected Availability Domain: "${selected}"`);
  return selected as string;
}

async function main() {
  const { provider, compartmentId, region } = getAuthProvider();
  const sshKey = getSshKey();

  const computeClient = new core.ComputeClient({
    authenticationDetailsProvider: provider,
  });
  const networkClient = new core.VirtualNetworkClient({
    authenticationDetailsProvider: provider,
  });
  const identityClient = new identity.IdentityClient({
    authenticationDetailsProvider: provider,
  });

  // Resolve target configuration parameters
  const instanceName =
    process.env.OCI_INSTANCE_NAME?.trim() || "nodejs-servers";
  const shape = process.env.OCI_SHAPE?.trim() || "VM.Standard.A1.Flex";
  const ocpus = Number.parseInt(process.env.OCI_OCPUS || "1", 10);
  const memoryInGBs = Number.parseInt(process.env.OCI_MEMORY_IN_GBS || "6", 10);
  const bootVolumeSize = Number.parseInt(
    process.env.OCI_BOOT_VOLUME_SIZE_IN_GBS || "50",
    10,
  );
  const bootVolumeVpu = Number.parseInt(
    process.env.OCI_BOOT_VOLUME_VPU || "10",
    10,
  );
  const faultDomain = process.env.OCI_FAULT_DOMAIN?.trim() || "FAULT-DOMAIN-1";
  const assignPublicIp = process.env.OCI_ASSIGN_PUBLIC_IP !== "false";
  const retryInterval = Number.parseInt(
    process.env.OCI_RETRY_INTERVAL_SECONDS || "45",
    10,
  );

  const availabilityDomain = await resolveAvailabilityDomain(
    identityClient,
    compartmentId,
  );
  const imageId = await resolveImageId(computeClient, compartmentId);
  const subnetId = await resolveSubnet(networkClient, compartmentId);

  console.log("\n=======================================================");
  console.log("   Target Instance Specifications (Matches image_87): ");
  console.log("=======================================================");
  console.log(`- Instance Name:      ${instanceName}`);
  console.log(
    `- Shape:              ${shape} (${ocpus} OCPU, ${memoryInGBs} GB RAM)`,
  );
  console.log(
    `- Boot Volume:        ${bootVolumeSize} GB (VPU: ${bootVolumeVpu})`,
  );
  console.log(`- Availability Domain:${availabilityDomain}`);
  console.log(`- Fault Domain:       ${faultDomain}`);
  console.log(`- Region:             ${region}`);
  console.log(`- Subnet ID:          ${subnetId}`);
  console.log(`- Assign Public IP:   ${assignPublicIp}`);
  console.log(`- Retry Interval:     ${retryInterval} seconds`);
  console.log("=======================================================\n");

  const launchRequest: core.requests.LaunchInstanceRequest = {
    launchInstanceDetails: {
      compartmentId,
      displayName: instanceName,
      availabilityDomain,
      faultDomain,
      shape,
      shapeConfig: {
        ocpus,
        memoryInGBs,
      },
      sourceDetails: {
        sourceType: "image",
        imageId,
        bootVolumeSizeInGBs: bootVolumeSize,
        bootVolumeVpusPerGB: bootVolumeVpu,
      },
      isPvEncryptionInTransitEnabled: true,
      createVnicDetails: {
        assignPublicIp,
        subnetId,
        displayName: "VNIC-nodejs",
      },
      metadata: {
        ssh_authorized_keys: sshKey,
      },
      agentConfig: {
        isMonitoringDisabled: false,
        isManagementDisabled: true,
        pluginsConfig: [
          {
            name: "Custom Logs Monitoring",
            desiredState:
              core.models.InstanceAgentPluginConfigDetails.DesiredState.Enabled,
          },
          {
            name: "Compute Instance Run Command",
            desiredState:
              core.models.InstanceAgentPluginConfigDetails.DesiredState.Enabled,
          },
          {
            name: "Compute Instance Monitoring",
            desiredState:
              core.models.InstanceAgentPluginConfigDetails.DesiredState.Enabled,
          },
          {
            name: "Cloud Guard Workload Protection",
            desiredState:
              core.models.InstanceAgentPluginConfigDetails.DesiredState.Enabled,
          },
        ],
      },
    },
  };

  let attempt = 1;
  console.log(
    "Starting automated launch loop. Press Ctrl+C at any time to stop.\n",
  );

  while (true) {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    process.stdout.write(
      `[Attempt #${attempt} | ${timestamp}] Sending LaunchInstance request... `,
    );

    try {
      const res = await computeClient.launchInstance(launchRequest);
      const instance = res.instance;

      console.log(
        "\n\n=======================================================",
      );
      console.log("   SUCCESS! ORACLE CLOUD INSTANCE CREATED!            ");
      console.log("=======================================================");
      console.log(`- Instance Name:    ${instance.displayName}`);
      console.log(`- Instance OCID:    ${instance.id}`);
      console.log(`- Lifecycle State:  ${instance.lifecycleState}`);
      console.log(`- Created At:       ${instance.timeCreated}`);
      console.log("=======================================================");

      // Audible notification
      process.stdout.write("\x07\x07\x07");

      console.log("\nWaiting 15 seconds to fetch assigned Public IP...");
      await sleep(15000);

      try {
        const vnicAttachments = await computeClient.listVnicAttachments({
          compartmentId,
          instanceId: instance.id,
        });
        const vnicId = vnicAttachments.items?.[0]?.vnicId;
        if (vnicId) {
          const vnic = await networkClient.getVnic({ vnicId });
          console.log(
            `- Public IP:   ${vnic.vnic.publicIp || "None assigned"}`,
          );
          console.log(`- Private IP:  ${vnic.vnic.privateIp}`);
          if (vnic.vnic.publicIp) {
            console.log(
              `\nConnect with:\n  ssh ubuntu@${vnic.vnic.publicIp}\n`,
            );
          }
        }
      } catch {
        console.log(
          "Could not query VNIC public IP immediately. Check OCI Console for IP address.",
        );
      }

      console.log(
        "Instance is now provisioning in Oracle Cloud. Exiting cleanly.",
      );
      process.exit(0);
    } catch (err: unknown) {
      const error = err as {
        statusCode?: number;
        serviceCode?: string;
        message?: string;
      };
      const msg = error.message || String(err);
      const code = error.serviceCode || "";
      const status = error.statusCode;

      const isOutOfCapacity =
        status === 500 ||
        code === "InternalError" ||
        code === "OutOfCapacity" ||
        code === "TooManyRequests" ||
        msg.includes("Out of host capacity") ||
        msg.includes("capacity");

      if (isOutOfCapacity) {
        console.log(
          `Out of host capacity for ${shape}. Retrying in ${retryInterval}s...`,
        );
      } else {
        console.log(`Failed (Status: ${status}, Code: ${code}): ${msg}`);
        // If error is authentication or invalid request, inform user
        if (status === 400 || status === 401 || status === 404) {
          console.error(
            "\n[CRITICAL ERROR] The request was rejected by OCI due to invalid credentials or parameters.",
          );
          console.error(
            "Please verify your .env settings and run 'npm run check-env' to troubleshoot.",
          );
          process.exit(1);
        }
        console.log(`Retrying in ${retryInterval}s...`);
      }
    }

    attempt++;
    await sleep(retryInterval * 1000);
  }
}

main().catch((err) => {
  console.error("\nUnexpected fatal error:", err);
  process.exit(1);
});
