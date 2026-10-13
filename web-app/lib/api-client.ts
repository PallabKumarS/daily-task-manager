import { handleLocalClientDispatch } from "./local-dispatcher";

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const TOKEN_KEY = "daypulse_auth_token";
const SERVER_URL_KEY = "daypulse_api_base_url";

export function isCapacitorNative(): boolean {
	if (typeof window === "undefined") return false;
	const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
	return Boolean(
		cap?.isNativePlatform?.() ||
			window.location.protocol === "capacitor:" ||
			(window.location.hostname === "localhost" && !window.location.port),
	);
}

export function isElectron(): boolean {
	if (typeof window === "undefined") return false;
	const electron = (window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI;
	return Boolean(electron?.isElectron);
}

export function isCustomServerSet(): boolean {
	if (typeof window === "undefined") return false;
	return Boolean(localStorage.getItem(SERVER_URL_KEY));
}

export function normalizeServerUrl(input: string): string {
	let trimmed = input.trim();
	if (!trimmed) return "";
	if (!/^https?:\/\//i.test(trimmed)) {
		trimmed = `http://${trimmed}`;
	}
	trimmed = trimmed.replace(/\/+$/, "");
	if (!trimmed.endsWith("/api/v1")) {
		trimmed = `${trimmed}/api/v1`;
	}
	return trimmed;
}

export async function testServerConnection(url: string): Promise<{ ok: boolean; message: string }> {
	const normalized = normalizeServerUrl(url);
	if (!normalized) return { ok: false, message: "Server URL cannot be empty." };

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 4000);

	try {
		const res = await fetch(`${normalized}/health`, {
			signal: controller.signal,
			headers: { Accept: "application/json" },
		});
		clearTimeout(timeoutId);
		if (res.ok) {
			return { ok: true, message: "Connected to DayPulse server successfully." };
		}
		return { ok: false, message: `Server returned HTTP ${res.status}.` };
	} catch (err) {
		clearTimeout(timeoutId);
		const msg =
			err instanceof Error && err.name === "AbortError"
				? "Connection timed out after 4 seconds."
				: "Cannot reach server. Verify IP, port, and Wi-Fi connection.";
		return { ok: false, message: msg };
	}
}

export function getApiBaseUrl(): string {
	if (typeof window !== "undefined") {
		const custom = localStorage.getItem(SERVER_URL_KEY);
		if (custom) return custom.replace(/\/+$/, "");

		// On Capacitor mobile native runtime, relative /api/v1 resolves to localhost:80 where no server is listening
		if (!isCapacitorNative() && window.location.protocol.startsWith("http")) {
			return "/api/v1";
		}
	}
	return DEFAULT_API_BASE_URL.replace(/\/+$/, "");
}

export function setApiBaseUrl(url: string): void {
	if (typeof window === "undefined") return;
	const trimmed = url.trim();
	if (trimmed) {
		localStorage.setItem(SERVER_URL_KEY, normalizeServerUrl(trimmed));
	} else {
		localStorage.removeItem(SERVER_URL_KEY);
	}
}

export function getAuthToken(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(TOKEN_KEY, token);
	document.cookie = `token=${token}; path=/; max-age=2592000; SameSite=Lax`;
}

export function clearAuthToken(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(TOKEN_KEY);
	document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
}

export interface ApiResponse<T = unknown> {
	statusCode: number;
	success: boolean;
	message?: string;
	data: T;
	meta?: {
		page: number;
		limit: number;
		totalData: number;
		totalPage: number;
	} | null;
}

export async function apiRequest<T = unknown>(
	endpoint: string,
	options: RequestInit = {},
): Promise<ApiResponse<T>> {
	// If running inside Electron desktop app, route via in-process IPC (zero network ports)
	if (
		typeof window !== "undefined" &&
		(
			window as unknown as {
				electronAPI?: { dispatch: (req: unknown) => Promise<ApiResponse<T>> };
			}
		).electronAPI?.dispatch
	) {
		let parsedBody: unknown;
		if (options.body) {
			try {
				parsedBody = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
			} catch {
				parsedBody = options.body;
			}
		}

		const ipcRes = await (
			window as unknown as {
				electronAPI: {
					dispatch: (req: {
						endpoint: string;
						method?: string;
						body?: unknown;
						token?: string | null;
					}) => Promise<ApiResponse<T>>;
				};
			}
		).electronAPI.dispatch({
			endpoint,
			method: options.method || "GET",
			body: parsedBody,
			token: getAuthToken(),
		});

		if (!ipcRes.success) {
			if (ipcRes.statusCode === 401) {
				clearAuthToken();
				if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
					window.dispatchEvent(new CustomEvent("daypulse:unauthorized"));
				}
			}
			throw new Error(ipcRes.message || "An error occurred in local storage");
		}

		const reqMethod = (options.method || "GET").toUpperCase();
		if (typeof window !== "undefined" && ["POST", "PATCH", "PUT", "DELETE"].includes(reqMethod)) {
			window.dispatchEvent(new CustomEvent("daypulse:refresh"));
		}

		return ipcRes;
	}

	// Route browser client (Vercel) and Capacitor native directly to client local storage when no custom server is configured.
	// Desktop Electron app runs a dedicated standalone server with SQLite/Prisma on its local port.
	if (!isElectron() && typeof window !== "undefined" && !isCustomServerSet()) {
		const localRes = await handleLocalClientDispatch<T>(endpoint, options);
		if (!localRes.success) {
			if (localRes.statusCode === 401) {
				clearAuthToken();
				if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
					window.dispatchEvent(new CustomEvent("daypulse:unauthorized"));
				}
			}
			throw new Error(localRes.message || "An error occurred in local storage");
		}
		const reqMethod = (options.method || "GET").toUpperCase();
		if (typeof window !== "undefined" && ["POST", "PATCH", "PUT", "DELETE"].includes(reqMethod)) {
			window.dispatchEvent(new CustomEvent("daypulse:refresh"));
		}
		return localRes;
	}

	const baseUrl = getApiBaseUrl();
	const url = endpoint.startsWith("http")
		? endpoint
		: `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

	const token = getAuthToken();

	const headers = new Headers(options.headers || {});
	if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
		headers.set("Content-Type", "application/json");
	}
	if (token && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	let response: Response;
	try {
		response = await fetch(url, {
			...options,
			headers,
			credentials: "omit",
		});
	} catch (_networkError) {
		throw new Error("Unable to connect to DayPulse server. Please ensure the server is online.");
	}

	let json: ApiResponse<T>;
	try {
		json = (await response.json()) as ApiResponse<T>;
	} catch {
		throw new Error(`Server returned status ${response.status}`);
	}

	if (!response.ok || !json.success) {
		if (response.status === 401) {
			clearAuthToken();
			if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
				window.dispatchEvent(new CustomEvent("daypulse:unauthorized"));
			}
		}
		throw new Error(json.message || "An unexpected API error occurred");
	}

	const reqMethod = (options.method || "GET").toUpperCase();
	if (typeof window !== "undefined" && ["POST", "PATCH", "PUT", "DELETE"].includes(reqMethod)) {
		window.dispatchEvent(new CustomEvent("daypulse:refresh"));
	}

	return json;
}

export const api = {
	get: <T = unknown>(endpoint: string, options?: RequestInit) =>
		apiRequest<T>(endpoint, { ...options, method: "GET" }),

	post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "POST",
			body: body ? JSON.stringify(body) : undefined,
		}),

	patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "PATCH",
			body: body ? JSON.stringify(body) : undefined,
		}),

	delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
		apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
