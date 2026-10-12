const { BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

function createWindow() {
	const iconPath = path.join(__dirname, "../assets/daypulse.ico");
	const splashPath = path.join(__dirname, "../assets/splash.html");
	const preloadPath = path.join(__dirname, "preload.js");

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 640,
		show: true,
		title: "DayPulse",
		backgroundColor: "#090d16",
		frame: false,
		icon: fs.existsSync(iconPath) ? iconPath : undefined,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
		},
	});

	if (fs.existsSync(splashPath)) {
		mainWindow.loadFile(splashPath);
	}

	return mainWindow;
}

function getWindow() {
	return mainWindow;
}

module.exports = { createWindow, getWindow };
