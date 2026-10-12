import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl, getAuthToken, isCustomServerSet } from "./api-client";

let socket: Socket | null = null;

function getSocketUrl(): string {
	if (typeof window !== "undefined") {
		const apiUrl = getApiBaseUrl();
		try {
			const parsed = new URL(apiUrl);
			return parsed.origin;
		} catch {
			// ignore
		}
	}
	return process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
}

export function getSocket(): Socket | null {
	if (typeof window === "undefined") return null;

	const isDesktop = Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
	if (isDesktop || !isCustomServerSet()) return null;

	const token = getAuthToken();
	if (!token) {
		if (socket) {
			socket.disconnect();
			socket = null;
		}
		return null;
	}

	if (!socket) {
		socket = io(getSocketUrl(), {
			auth: { token },
			transports: ["websocket", "polling"],
			autoConnect: true,
			reconnection: true,
			reconnectionAttempts: 10,
			reconnectionDelay: 2000,
		});
	} else if (!socket.connected) {
		socket.auth = { token };
		socket.connect();
	}

	return socket;
}

export function disconnectSocket(): void {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
}
