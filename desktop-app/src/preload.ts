import { contextBridge, ipcRenderer, webFrame } from "electron";
import type { AlarmNotificationPayload, ElectronBridgeApi } from "./config/index.js";

const api: ElectronBridgeApi = {
	isElectron: true,
	platform: process.platform,
	minimizeToTray: () => {
		ipcRenderer.send("window:minimize-to-tray");
	},
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
	isMaximized: async () => {
		return ipcRenderer.invoke("window:is-maximized");
	},
	isFullScreen: async () => {
		return ipcRenderer.invoke("window:is-fullscreen");
	},
	onWindowStateChange: (
		callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
	) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			state: { isMaximized: boolean; isFullScreen: boolean },
		) => {
			callback(state);
		};
		ipcRenderer.on("window:state-changed", listener);
		return () => {
			ipcRenderer.removeListener("window:state-changed", listener);
		};
	},
	triggerAlarm: (payload: AlarmNotificationPayload) => {
		ipcRenderer.send("alarm:trigger", payload);
	},
	onAlarmReceived: (callback: (payload: AlarmNotificationPayload) => void) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: AlarmNotificationPayload) => {
			callback(payload);
		};
		ipcRenderer.on("alarm:received", listener);
		return () => {
			ipcRenderer.removeListener("alarm:received", listener);
		};
	},
	syncNow: async () => {
		return ipcRenderer.invoke("sync:now");
	},
	saveBackupFile: async (defaultName: string, base64Data: string) => {
		return ipcRenderer.invoke("backup:save-dialog", defaultName, base64Data);
	},
	pickBackupFile: async () => {
		return ipcRenderer.invoke("backup:open-dialog");
	},
	openExternal: async (url: string) => {
		return ipcRenderer.invoke("shell:open-external", url);
	},
	dispatch: async (req) => {
		return ipcRenderer.invoke("api:dispatch", req);
	},
};

ipcRenderer.on("daypulse:sync-updated", (_event, payload) => {
	window.dispatchEvent(new CustomEvent("daypulse:sync-updated", { detail: payload }));
	window.dispatchEvent(new CustomEvent("daypulse:refresh"));
});

contextBridge.exposeInMainWorld("electronAPI", api);

try {
	webFrame.executeJavaScript(`
		(() => {
			if (typeof document !== "undefined" && document.documentElement) {
				document.documentElement.classList.add("is-electron");
				document.documentElement.style.setProperty("--titlebar-height", "36px");
			}
			if (window.__daypulse_ipc_interceptor_installed) return;
			window.__daypulse_ipc_interceptor_installed = true;

			const _originalFetch = window.fetch;
			window.fetch = async function(resource, init) {
				const rawUrl = typeof resource === "string" ? resource : (resource && resource.url) ? resource.url : String(resource || "");
				const apiMatch = rawUrl.match(/^(?:https?:\\/\\/[^\\/]+)?\\/api(?:\\/v1)?(\\/[^?#]*)(.*)?$/);

				if (apiMatch && window.electronAPI && typeof window.electronAPI.dispatch === "function") {
					const endpoint = (apiMatch[1] || "/") + (apiMatch[2] || "");
					const method = (init && init.method) || (resource && resource.method) || "GET";
					let body = init && init.body;
					if (typeof body === "string") {
						try { body = JSON.parse(body); } catch {}
					}

					try {
						const res = await window.electronAPI.dispatch({
							endpoint,
							method,
							body,
							token: localStorage.getItem("daypulse_auth_token")
						});

						return new Response(JSON.stringify(res), {
							status: res.statusCode || 200,
							statusText: res.success ? "OK" : "Error",
							headers: { "Content-Type": "application/json" }
						});
					} catch (dispatchErr) {
						const errMessage = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
						return new Response(JSON.stringify({
							statusCode: 500,
							success: false,
							message: errMessage,
							data: null
						}), {
							status: 500,
							headers: { "Content-Type": "application/json" }
						});
					}
				}

				return _originalFetch.apply(this, arguments);
			};
		})();
	`);
} catch (e) {
	console.error("[Preload] Could not install fetch interceptor:", e);
}
