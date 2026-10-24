export const THEME_INIT_SCRIPT = `
try {
	if (typeof window !== "undefined") {
		if (window.electronAPI && window.electronAPI.isElectron) {
			document.documentElement.classList.add("is-electron");
			document.documentElement.style.setProperty("--titlebar-height", "36px");
		}
		var savedPref = localStorage.getItem("daypulse_theme_preference") || "system";
		var reduceMotion = localStorage.getItem("daypulse_reduce_motion") === "true";
		var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
		var isDark = savedPref === "dark" || (savedPref === "system" && prefersDark);
		var root = document.documentElement;
		if (isDark) {
			root.classList.add("dark");
			root.classList.remove("light");
			root.style.colorScheme = "dark";
		} else {
			root.classList.add("light");
			root.classList.remove("dark");
			root.style.colorScheme = "light";
		}
		if (reduceMotion) {
			root.classList.add("reduce-motion");
		}
	}
} catch (e) {}
`;
