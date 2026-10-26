"use client";

import * as React from "react";

export interface RecentAdditionItem {
	id: string;
	type: "EXPENSE" | "INCOME" | "TASK" | "EVENT" | "ROUTINE" | "TRACKER";
	title: string;
	amount?: number;
	category?: string;
	date: string;
	paymentMethod?: string;
	priority?: string;
	timestamp: number;
}

const STORAGE_KEY = "daypulse_recent_additions";
const MAX_ITEMS = 15;

function getStoredAdditions(): RecentAdditionItem[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		const cutoff = Date.now() - 24 * 60 * 60 * 1000;
		return Array.isArray(parsed) ? parsed.filter((item) => item.timestamp > cutoff) : [];
	} catch {
		return [];
	}
}

function saveStoredAdditions(items: RecentAdditionItem[]): void {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
	} catch {
		// Ignore storage quota error
	}
}

export function recordRecentAddition(
	item: Omit<RecentAdditionItem, "timestamp">,
): RecentAdditionItem {
	const fullItem: RecentAdditionItem = {
		...item,
		timestamp: Date.now(),
	};

	if (typeof window !== "undefined") {
		const current = getStoredAdditions();
		const updated = [fullItem, ...current.filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS);
		saveStoredAdditions(updated);

		window.dispatchEvent(
			new CustomEvent("daypulse:item-created", {
				detail: fullItem,
			}),
		);
		window.dispatchEvent(new CustomEvent("daypulse:refresh"));
	}

	return fullItem;
}

export function useRecentAdditions() {
	const [recentList, setRecentList] = React.useState<RecentAdditionItem[]>([]);
	const [activeAdditionId, setActiveAdditionId] = React.useState<string | null>(null);
	const activeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	React.useEffect(() => {
		setRecentList(getStoredAdditions());

		const handleItemCreated = (event: Event) => {
			const customEvent = event as CustomEvent<RecentAdditionItem>;
			if (customEvent.detail) {
				const newItem = customEvent.detail;
				setRecentList((prev) =>
					[newItem, ...prev.filter((i) => i.id !== newItem.id)].slice(0, MAX_ITEMS),
				);
				setActiveAdditionId(newItem.id);

				if (activeTimeoutRef.current) {
					clearTimeout(activeTimeoutRef.current);
				}
				activeTimeoutRef.current = setTimeout(() => {
					setActiveAdditionId((curr) => (curr === newItem.id ? null : curr));
					activeTimeoutRef.current = null;
				}, 10000);
			}
		};

		const handleRefresh = () => {
			setRecentList(getStoredAdditions());
		};

		window.addEventListener("daypulse:item-created", handleItemCreated);
		window.addEventListener("daypulse:refresh", handleRefresh);

		return () => {
			if (activeTimeoutRef.current) {
				clearTimeout(activeTimeoutRef.current);
				activeTimeoutRef.current = null;
			}
			window.removeEventListener("daypulse:item-created", handleItemCreated);
			window.removeEventListener("daypulse:refresh", handleRefresh);
		};
	}, []);

	const latestAddition = recentList.length > 0 ? recentList[0] : null;
	const isRecent = latestAddition ? Date.now() - latestAddition.timestamp < 15 * 60 * 1000 : false;

	const dismissLatest = React.useCallback(() => {
		if (recentList.length > 0) {
			const next = recentList.slice(1);
			setRecentList(next);
			saveStoredAdditions(next);
		}
	}, [recentList]);

	return {
		recentList,
		latestAddition: isRecent ? latestAddition : null,
		activeAdditionId,
		dismissLatest,
	};
}
