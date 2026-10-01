"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  currency: string;
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
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUser(json.data);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = React.useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          setUser(json.data.user);
          toast.success(json.message || "Welcome back to DayPulse");
          router.push("/dashboard");
          return true;
        }

        toast.error(json.message || "Failed to sign in");
        return false;
      } catch {
        toast.error("Network error during login");
        return false;
      }
    },
    [router]
  );

  const register = React.useCallback(
    async (name: string, email: string, password: string, currency = "USD"): Promise<boolean> => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, currency }),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          setUser(json.data.user);
          toast.success("Account created successfully");
          router.push("/dashboard");
          return true;
        }

        toast.error(json.message || "Registration failed");
        return false;
      } catch {
        toast.error("Network error during registration");
        return false;
      }
    },
    [router]
  );

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      toast.success("Logged out successfully");
      router.push("/");
    } catch {
      toast.error("Failed to log out");
    }
  }, [router]);

  const updateProfile = React.useCallback(
    async (data: { name?: string; currency?: string }): Promise<boolean> => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          setUser(json.data);
          toast.success("Profile updated");
          return true;
        }

        toast.error(json.message || "Update failed");
        return false;
      } catch {
        toast.error("Failed to update profile");
        return false;
      }
    },
    []
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
    [user, loading, refreshUser, login, register, logout, updateProfile]
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
