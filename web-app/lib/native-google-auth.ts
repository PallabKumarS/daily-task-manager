import { isCapacitorNative } from "./api-client";

export interface NativeGoogleUser {
	accessToken: string;
	email: string;
	name?: string;
	id?: string;
	idToken?: string;
	serverAuthCode?: string;
}

export interface NativeGoogleAuthPlugin {
	signIn(options?: { serverClientId?: string }): Promise<NativeGoogleUser>;
	signOut(): Promise<void>;
}

export async function isNativeGoogleAuthAvailable(): Promise<boolean> {
	if (!isCapacitorNative()) return false;
	try {
		const { Capacitor } = await import("@capacitor/core");
		return Boolean(Capacitor.isPluginAvailable("NativeGoogleAuth"));
	} catch {
		return false;
	}
}

export async function signInWithNativeGoogle(serverClientId?: string): Promise<NativeGoogleUser> {
	const { registerPlugin } = await import("@capacitor/core");
	const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth");
	return await NativeGoogleAuth.signIn({ serverClientId });
}

export async function signOutNativeGoogle(): Promise<void> {
	try {
		const { registerPlugin } = await import("@capacitor/core");
		const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth");
		await NativeGoogleAuth.signOut();
	} catch {}
}
