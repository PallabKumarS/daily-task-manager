const { contextBridge, ipcRenderer } = require("electron");

try {
	if (typeof document !== "undefined" && document.documentElement) {
		document.documentElement.classList.add("is-electron");
		document.documentElement.style.setProperty("--titlebar-height", "36px");
	}
} catch (_) {}

contextBridge.exposeInMainWorld("electronAPI", {
	isElectron: true,
	minimize: () => {
		ipcRenderer.send("window:minimize");
	},
	maximize: () => {
		ipcRenderer.send("window:maximize");
	},
	toggleFullScreen: () => {
		ipcRenderer.send("window:toggle-fullscreen");
	},
	close: () => {
		ipcRenderer.send("window:close");
	},
	isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
	isFullScreen: () => ipcRenderer.invoke("window:is-fullscreen"),
	openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
	onWindowStateChange: (callback) => {
		const listener = (_event, state) => {
			if (typeof callback === "function") {
				callback(state);
			}
		};
		ipcRenderer.on("window:state-changed", listener);
		return () => {
			ipcRenderer.removeListener("window:state-changed", listener);
		};
	},
});
