"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
	api,
	clearAuthToken,
	getAuthToken,
	isCapacitorNative,
	setAuthToken,
} from "@/lib/api-client";
import { disconnectSocket, getSocket } from "@/lib/socket-client";

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	currency: string;
	createdAt: string;
}

interface AuthContextType {
	user: AuthUser | null;
	loading: boolean;
	refreshUser: () => Promise<void>;
	login: (email: string, password: string) => Promise<boolean>;
	register: (name: string, email: string, password: string, currency?: string) => Promise<boolean>;
	logout: () => Promise<void>;
	updateProfile: (data: { name?: string; currency?: string }) => Promise<boolean>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = React.useState<AuthUser | null>(null);
	const [loading, setLoading] = React.useState(true);
	const router = useRouter();

	const refreshUser = React.useCallback(async () => {
		const isDesktop =
			typeof window !== "undefined" &&
			Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
		const isNative = isCapacitorNative();

		const token = getAuthToken();
		const hasLocalUser =
			typeof window !== "undefined" && Boolean(localStorage.getItem("daypulse_user_account"));

		if (!token && !isDesktop && !isNative && !hasLocalUser) {
			setUser(null);
			setLoading(false);
			return;
		}

		try {
			const res = await api.get<AuthUser>("/auth/me").catch(() => null);

			if (res?.success && res.data) {
				setUser(res.data);
				if (!token) {
					setAuthToken(`daypulse_token_${res.data.id}`);
				}
				getSocket();
				return;
			}

			setUser(null);
			clearAuthToken();
		} catch (error) {
			console.error("[Auth] refreshUser failed:", error);
			setUser(null);
			clearAuthToken();
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		refreshUser();

		const handleUnauthorized = () => {
			setUser(null);
			clearAuthToken();
			disconnectSocket();
			router.push("/login");
		};

		window.addEventListener("daypulse:unauthorized", handleUnauthorized);
		return () => {
			window.removeEventListener("daypulse:unauthorized", handleUnauthorized);
		};
	}, [refreshUser, router]);

	const login = React.useCallback(
		async (email: string, password: string): Promise<boolean> => {
			try {
				const res = await api.post<{ user: AuthUser; token: string }>("/auth/login", {
					email,
					password,
				});

				if (res.success && res.data.token) {
					setAuthToken(res.data.token);
					setUser(res.data.user);
					getSocket();
					toast.success(res.message || "Welcome back to DayPulse");
					router.push("/dashboard");
					return true;
				}

				toast.error(res.message || "Failed to sign in");
				return false;
			} catch (error) {
				const message = error instanceof Error ? error.message : "Network error during login";
				toast.error(message);
				return false;
			}
		},
		[router],
	);

	const register = React.useCallback(
		async (name: string, email: string, password: string, currency = "USD"): Promise<boolean> => {
			try {
				const res = await api.post<{ user: AuthUser; token: string }>("/auth/register", {
					name,
					email,
					password,
					currency,
				});

				if (res.success && res.data.token) {
					setAuthToken(res.data.token);
					setUser(res.data.user);
					getSocket();
					toast.success("Account created successfully");
					router.push("/dashboard");
					return true;
				}

				toast.error(res.message || "Registration failed");
				return false;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Network error during registration";
				toast.error(message);
				return false;
			}
		},
		[router],
	);

	const logout = React.useCallback(async () => {
		try {
			await api.post("/auth/logout").catch(() => {});
		} finally {
			clearAuthToken();
			disconnectSocket();
			setUser(null);
			toast.success("Logged out successfully");
			router.push("/login");
		}
	}, [router]);

	const updateProfile = React.useCallback(
		async (data: { name?: string; currency?: string }): Promise<boolean> => {
			try {
				const res = await api.patch<AuthUser>("/auth/me", data);
				if (res.success && res.data) {
					setUser(res.data);
					toast.success("Profile updated");
					return true;
				}
				toast.error(res.message || "Update failed");
				return false;
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to update profile";
				toast.error(message);
				return false;
			}
		},
		[],
	);

	const value = React.useMemo(
		() => ({
			user,
			loading,
			refreshUser,
			login,
			register,
			logout,
			updateProfile,
		}),
		[user, loading, refreshUser, login, register, logout, updateProfile],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
	const context = React.useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
