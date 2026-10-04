import * as core from "oci-core";

export async function resolveSubnet(
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

	console.log(
		`[NETWORK] No subnets found in compartment. Automatically creating "${targetVcnName}" and "${targetSubnetName}"...`,
	);

	const vcn = await networkClient.createVcn({
		createVcnDetails: {
			compartmentId,
			displayName: targetVcnName,
			cidrBlock: "10.0.0.0/16",
			dnsLabel: "vcnnodejs",
		},
	});
	console.log(`[NETWORK] Created VCN "${targetVcnName}" (${vcn.vcn.id})`);

	const ig = await networkClient.createInternetGateway({
		createInternetGatewayDetails: {
			compartmentId,
			vcnId: vcn.vcn.id,
			displayName: "ig-nodejs",
			isEnabled: true,
		},
	});
	console.log(`[NETWORK] Created Internet Gateway (${ig.internetGateway.id})`);

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
