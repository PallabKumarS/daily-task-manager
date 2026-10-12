const { contextBridge, ipcRenderer } = require("electron");

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
