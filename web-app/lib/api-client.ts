const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const TOKEN_KEY = "daypulse_auth_token";

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
				parsedBody =
					typeof options.body === "string"
						? JSON.parse(options.body)
						: options.body;
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
			throw new Error(ipcRes.message || "An error occurred in local storage");
		}

		const reqMethod = (options.method || "GET").toUpperCase();
		if (
			typeof window !== "undefined" &&
			["POST", "PATCH", "PUT", "DELETE"].includes(reqMethod)
		) {
			window.dispatchEvent(new CustomEvent("daypulse:refresh"));
		}

		return ipcRes;
	}

	const url = endpoint.startsWith("http")
		? endpoint
		: `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

	const token = getAuthToken();

	const headers = new Headers(options.headers || {});
	if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
		headers.set("Content-Type", "application/json");
	}
	if (token && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	const response = await fetch(url, {
		...options,
		headers,
		credentials: "omit",
	});

	let json: ApiResponse<T>;
	try {
		json = (await response.json()) as ApiResponse<T>;
	} catch {
		throw new Error(`Server returned status ${response.status}`);
	}

	if (!response.ok || !json.success) {
		if (response.status === 401) {
			clearAuthToken();
			if (
				typeof window !== "undefined" &&
				!window.location.pathname.startsWith("/login")
			) {
				window.dispatchEvent(new CustomEvent("daypulse:unauthorized"));
			}
		}
		throw new Error(json.message || "An unexpected API error occurred");
	}

	const reqMethod = (options.method || "GET").toUpperCase();
	if (
		typeof window !== "undefined" &&
		["POST", "PATCH", "PUT", "DELETE"].includes(reqMethod)
	) {
		window.dispatchEvent(new CustomEvent("daypulse:refresh"));
	}

	return json;
}

export const api = {
	get: <T = unknown>(endpoint: string, options?: RequestInit) =>
		apiRequest<T>(endpoint, { ...options, method: "GET" }),

	post: <T = unknown>(
		endpoint: string,
		body?: unknown,
		options?: RequestInit,
	) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "POST",
			body: body ? JSON.stringify(body) : undefined,
		}),

	patch: <T = unknown>(
		endpoint: string,
		body?: unknown,
		options?: RequestInit,
	) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "PATCH",
			body: body ? JSON.stringify(body) : undefined,
		}),

	delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
		apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
