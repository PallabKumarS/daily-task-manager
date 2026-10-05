import { contextBridge, ipcRenderer } from "electron";
import type { AlarmNotificationPayload, ElectronBridgeApi } from "./types.js";

const api: ElectronBridgeApi = {
	isElectron: true,
	platform: process.platform,
	minimizeToTray: () => {
		ipcRenderer.send("window:minimize-to-tray");
	},
	triggerAlarm: (payload: AlarmNotificationPayload) => {
		ipcRenderer.send("alarm:trigger", payload);
	},
	onAlarmReceived: (callback: (payload: AlarmNotificationPayload) => void) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			payload: AlarmNotificationPayload,
		) => {
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
	dispatch: async (req) => {
		return ipcRenderer.invoke("api:dispatch", req);
	},
};

contextBridge.exposeInMainWorld("electronAPI", api);
