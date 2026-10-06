import { BrowserWindow } from "electron";

let splashWindow: BrowserWindow | null = null;

const SPLASH_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    user-select: none;
  }
  body {
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
  }
  .card {
    width: 440px;
    height: 290px;
    background: #09090b;
    border: 1px solid rgba(39, 39, 42, 0.9);
    border-radius: 20px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 30px rgba(16, 185, 129, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .glow-orb {
    position: absolute;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.05) 50%, transparent 70%);
    top: -60px;
    border-radius: 50%;
    filter: blur(25px);
    pointer-events: none;
    animation: pulse 3s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    0% { transform: scale(0.92); opacity: 0.6; }
    100% { transform: scale(1.1); opacity: 1; }
  }
  .logo-box {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.05));
    border: 1px solid rgba(16, 185, 129, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.2);
    margin-bottom: 16px;
    position: relative;
    z-index: 2;
  }
  .logo-svg {
    width: 38px;
    height: 38px;
  }
  .brand-title {
    color: #f4f4f5;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
    position: relative;
    z-index: 2;
  }
  .brand-subtitle {
    color: #71717a;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 22px;
    position: relative;
    z-index: 2;
  }
  .status-text {
    color: #a1a1aa;
    font-size: 11px;
    margin-bottom: 12px;
    height: 16px;
    position: relative;
    z-index: 2;
    transition: opacity 0.2s ease;
  }
  .progress-bar-track {
    width: 220px;
    height: 3px;
    background: rgba(39, 39, 42, 0.8);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
    z-index: 2;
  }
  .progress-bar-fill {
    width: 45%;
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 999px;
    animation: indeterminate 1.4s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
  }
  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(250%);
    }
  }
  .version-tag {
    position: absolute;
    bottom: 12px;
    font-size: 9px;
    color: #3f3f46;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
<div class="card">
  <div class="glow-orb"></div>
  <div class="logo-box">
    <svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  </div>
  <div class="brand-title">DayPulse</div>
  <div class="brand-subtitle">Standalone Workspace</div>
  <div class="status-text" id="statusMsg">Initializing local database...</div>
  <div class="progress-bar-track">
    <div class="progress-bar-fill"></div>
  </div>
  <div class="version-tag">LOCAL v1.0.0</div>
</div>
</body>
</html>
`;

export function showSplashWindow(): BrowserWindow {
	if (splashWindow && !splashWindow.isDestroyed()) {
		splashWindow.focus();
		return splashWindow;
	}

	splashWindow = new BrowserWindow({
		width: 440,
		height: 290,
		frame: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		show: false,
		center: true,
		skipTaskbar: true,
		backgroundColor: "#00000000",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`);

	splashWindow.once("ready-to-show", () => {
		splashWindow?.show();
	});

	return splashWindow;
}

export function updateSplashStatus(statusText: string): void {
	if (!splashWindow || splashWindow.isDestroyed()) return;
	const escaped = JSON.stringify(statusText);
	splashWindow.webContents
		.executeJavaScript(
			`const el = document.getElementById("statusMsg"); if (el) { el.textContent = ${escaped}; }`,
		)
		.catch(() => {});
}

export function closeSplashWindow(): void {
	if (splashWindow && !splashWindow.isDestroyed()) {
		splashWindow.destroy();
		splashWindow = null;
	}
}
