import type * as common from "oci-common";

export interface AuthProviderResult {
	provider: common.AuthenticationDetailsProvider;
	compartmentId: string;
	region: string;
}

export interface InstanceRecord {
	name: string;
	id?: string;
	lifecycleState?: string;
	publicIp?: string;
	privateIp?: string;
}

export interface LaunchConfig {
	shape: string;
	ocpus: number;
	memoryInGBs: number;
	bootVolumeSize: number;
	bootVolumeVpu: number;
	configuredFaultDomain?: string;
	assignPublicIp: boolean;
	retryInterval: number;
	targetInstanceNames: string[];
}
