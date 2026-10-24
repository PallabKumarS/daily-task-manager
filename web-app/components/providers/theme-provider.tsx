"use client";

import * as React from "react";
import { Toaster } from "sonner";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
	reduceMotion: boolean;
	setPreference: (pref: ThemePreference) => void;
	toggleTheme: () => void;
	setReduceMotion: (reduce: boolean) => void;
}

const STORAGE_THEME_KEY = "daypulse_theme_preference";
const STORAGE_MOTION_KEY = "daypulse_reduce_motion";

const ThemeContext = React.createContext<ThemeContextValue>({
	preference: "system",
	resolvedTheme: "dark",
	reduceMotion: false,
	setPreference: () => {},
	toggleTheme: () => {},
	setReduceMotion: () => {},
});

function resolveSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "dark";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyDomTheme(resolved: ResolvedTheme, animateTransition = false) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;

	if (animateTransition) {
		root.classList.add("theme-transitioning");
		window.setTimeout(() => {
			root.classList.remove("theme-transitioning");
		}, 320);
	}

	if (resolved === "dark") {
		root.classList.add("dark");
		root.classList.remove("light");
		root.style.colorScheme = "dark";
	} else {
		root.classList.add("light");
		root.classList.remove("dark");
		root.style.colorScheme = "light";
	}

	const themeColorMeta = document.querySelector('meta[name="theme-color"]');
	if (themeColorMeta) {
		themeColorMeta.setAttribute("content", resolved === "dark" ? "#0b0f17" : "#f5f7fb");
	}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [preference, setPreferenceState] = React.useState<ThemePreference>("system");
	const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("dark");
	const [reduceMotion, setReduceMotionState] = React.useState(false);

	React.useEffect(() => {
		const savedPref = (localStorage.getItem(STORAGE_THEME_KEY) as ThemePreference) || "system";
		const validPref: ThemePreference =
			savedPref === "light" || savedPref === "dark" || savedPref === "system"
				? savedPref
				: "system";
		const savedMotion = localStorage.getItem(STORAGE_MOTION_KEY) === "true";

		setPreferenceState(validPref);
		setReduceMotionState(savedMotion);

		const initialResolved = validPref === "system" ? resolveSystemTheme() : validPref;
		setResolvedTheme(initialResolved);
		applyDomTheme(initialResolved, false);

		if (savedMotion) {
			document.documentElement.classList.add("reduce-motion");
		} else {
			document.documentElement.classList.remove("reduce-motion");
		}
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const handleSystemChange = (event: MediaQueryListEvent) => {
			const currentPref =
				(localStorage.getItem(STORAGE_THEME_KEY) as ThemePreference) || preference;
			if (currentPref === "system") {
				const nextResolved: ResolvedTheme = event.matches ? "dark" : "light";
				setResolvedTheme(nextResolved);
				applyDomTheme(nextResolved, true);
			}
		};

		mediaQuery.addEventListener("change", handleSystemChange);
		return () => mediaQuery.removeEventListener("change", handleSystemChange);
	}, [preference]);

	const setPreference = React.useCallback((nextPref: ThemePreference) => {
		localStorage.setItem(STORAGE_THEME_KEY, nextPref);
		setPreferenceState(nextPref);
		const nextResolved = nextPref === "system" ? resolveSystemTheme() : nextPref;
		setResolvedTheme(nextResolved);
		applyDomTheme(nextResolved, true);
	}, []);

	const toggleTheme = React.useCallback(() => {
		setPreference(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setPreference]);

	const setReduceMotion = React.useCallback((reduce: boolean) => {
		localStorage.setItem(STORAGE_MOTION_KEY, String(reduce));
		setReduceMotionState(reduce);
		if (typeof document !== "undefined") {
			document.documentElement.classList.toggle("reduce-motion", reduce);
		}
	}, []);

	const contextValue = React.useMemo(
		() => ({
			preference,
			resolvedTheme,
			reduceMotion,
			setPreference,
			toggleTheme,
			setReduceMotion,
		}),
		[preference, resolvedTheme, reduceMotion, setPreference, toggleTheme, setReduceMotion],
	);

	return (
		<ThemeContext.Provider value={contextValue}>
			{children}
			<Toaster
				theme={resolvedTheme}
				position="top-right"
				richColors
				closeButton
				toastOptions={{
					className:
						"rounded-xl border border-border bg-surface text-foreground shadow-[var(--shadow-pop)]",
				}}
			/>
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	return React.useContext(ThemeContext);
}
