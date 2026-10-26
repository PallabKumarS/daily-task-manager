"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import {
	ALL_NAV_TABS,
	DEFAULT_ENABLED_TABS,
	type NavTabId,
	type NavTabItem,
	parseEnabledTabs,
	serializeEnabledTabs,
} from "@/lib/nav-tabs-config";

interface NavTabsContextType {
	enabledTabs: NavTabId[];
	visibleNavTabs: NavTabItem[];
	isTabEnabled: (id: NavTabId) => boolean;
	toggleTab: (id: NavTabId) => Promise<boolean>;
	setEnabledTabs: (tabs: NavTabId[]) => Promise<boolean>;
	resetToDefault: () => Promise<boolean>;
	isCustomizeOpen: boolean;
	setCustomizeOpen: (open: boolean) => void;
	isSaving: boolean;
}

const NavTabsContext = React.createContext<NavTabsContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "daypulse_nav_tabs";

function getInitialTabs(): NavTabId[] {
	if (typeof window === "undefined") return DEFAULT_ENABLED_TABS;
	try {
		const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (cached) {
			return parseEnabledTabs(cached);
		}
	} catch {}
	return DEFAULT_ENABLED_TABS;
}

export function NavTabsProvider({ children }: { children: React.ReactNode }) {
	const { user, updateProfile } = useAuth();
	const [enabledTabs, setEnabledTabsState] = React.useState<NavTabId[]>(getInitialTabs);
	const [isCustomizeOpen, setCustomizeOpen] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);

	// Sync when user account loads from database
	React.useEffect(() => {
		if (user?.enabledTabs) {
			const parsed = parseEnabledTabs(user.enabledTabs);
			setEnabledTabsState(parsed);
			try {
				localStorage.setItem(LOCAL_STORAGE_KEY, user.enabledTabs);
			} catch {}
		}
	}, [user?.enabledTabs]);

	const isTabEnabled = React.useCallback((id: NavTabId) => enabledTabs.includes(id), [enabledTabs]);

	const visibleNavTabs = React.useMemo(() => {
		return ALL_NAV_TABS.filter((tab) => enabledTabs.includes(tab.id));
	}, [enabledTabs]);

	const commitTabs = React.useCallback(
		async (nextTabs: NavTabId[]): Promise<boolean> => {
			if (nextTabs.length === 0) {
				toast.error("At least one navigation tab must remain active");
				return false;
			}

			const serialized = serializeEnabledTabs(nextTabs);
			setEnabledTabsState(nextTabs);
			try {
				localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
			} catch {}

			setIsSaving(true);
			try {
				const ok = await updateProfile({ enabledTabs: serialized });
				if (ok) {
					toast.success("Navigation tabs updated");
					return true;
				}
				return false;
			} catch {
				toast.error("Failed to sync navigation tabs with database");
				return false;
			} finally {
				setIsSaving(false);
			}
		},
		[updateProfile],
	);

	const toggleTab = React.useCallback(
		async (id: NavTabId): Promise<boolean> => {
			const currentlyEnabled = enabledTabs.includes(id);
			if (currentlyEnabled) {
				if (enabledTabs.length <= 1) {
					toast.error("You must keep at least one navigation tab active");
					return false;
				}
				const next = enabledTabs.filter((tabId) => tabId !== id);
				return commitTabs(next);
			}

			// Preserve the canonical order from ALL_NAV_TABS
			const next = ALL_NAV_TABS.map((t) => t.id).filter(
				(tabId) => tabId === id || enabledTabs.includes(tabId),
			);
			return commitTabs(next);
		},
		[enabledTabs, commitTabs],
	);

	const resetToDefault = React.useCallback(async () => {
		return commitTabs(DEFAULT_ENABLED_TABS);
	}, [commitTabs]);

	const value = React.useMemo(
		() => ({
			enabledTabs,
			visibleNavTabs,
			isTabEnabled,
			toggleTab,
			setEnabledTabs: commitTabs,
			resetToDefault,
			isCustomizeOpen,
			setCustomizeOpen,
			isSaving,
		}),
		[
			enabledTabs,
			visibleNavTabs,
			isTabEnabled,
			toggleTab,
			commitTabs,
			resetToDefault,
			isCustomizeOpen,
			isSaving,
		],
	);

	return <NavTabsContext.Provider value={value}>{children}</NavTabsContext.Provider>;
}

export function useNavTabs(): NavTabsContextType {
	const context = React.useContext(NavTabsContext);
	if (!context) {
		throw new Error("useNavTabs must be used within a NavTabsProvider");
	}
	return context;
}
