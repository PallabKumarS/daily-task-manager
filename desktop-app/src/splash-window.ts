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
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0) 70%);
    top: -40px;
    filter: blur(25px);
    pointer-events: none;
    animation: orb-pulse 3s ease-in-out infinite alternate;
  }
  @keyframes orb-pulse {
    0% { transform: scale(0.85); opacity: 0.5; }
    100% { transform: scale(1.15); opacity: 1; }
  }
  .logo-box {
    position: relative;
    width: 68px;
    height: 68px;
    border-radius: 18px;
    background: linear-gradient(135deg, #18181b 0%, #10b981 180%);
    border: 1px solid rgba(16, 185, 129, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.25);
    animation: logo-float 3s ease-in-out infinite alternate;
  }
  @keyframes logo-float {
    0% { transform: translateY(0px); }
    100% { transform: translateY(-4px); }
  }
  .pulse-icon {
    width: 34px;
    height: 34px;
    stroke: #10b981;
    stroke-width: 2.2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.6));
    animation: pulse-draw 2.5s ease-in-out infinite;
  }
  @keyframes pulse-draw {
    0%, 100% { opacity: 0.85; transform: scale(0.97); }
    50% { opacity: 1; transform: scale(1.03); }
  }
  .title {
    font-size: 26px;
    font-weight: 700;
    color: #f4f4f5;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 13px;
    color: #a1a1aa;
    font-weight: 400;
    margin-bottom: 26px;
    letter-spacing: -0.1px;
  }
  .bar-container {
    width: 260px;
    height: 4px;
    background: #18181b;
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
    margin-bottom: 12px;
  }
  .bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 35%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
    animation: progress-slide 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }
  @keyframes progress-slide {
    0% { left: -35%; }
    100% { left: 100%; }
  }
  .status-text {
    font-size: 11.5px;
    color: #71717a;
    font-weight: 500;
    height: 16px;
    transition: opacity 0.2s ease;
  }
</style>
</head>
<body>
<div class="card">
  <div class="glow-orb"></div>
  <div class="logo-box">
    <svg class="pulse-icon" viewBox="0 0 24 24">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  </div>
  <div class="title">DayPulse</div>
  <div class="subtitle">Local-First Workspace & Task Tracker</div>
  <div class="bar-container">
    <div class="bar-fill"></div>
  </div>
  <div id="status" class="status-text">Initializing offline database...</div>
</div>
<script>
  window.setStatus = function(text) {
    const el = document.getElementById('status');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => {
        el.innerText = text;
        el.style.opacity = '1';
      }, 150);
    }
  };
</script>
</body>
</html>
`;

export function createSplashWindow(iconPath?: string): BrowserWindow {
	if (splashWindow && !splashWindow.isDestroyed()) {
		return splashWindow;
	}

	splashWindow = new BrowserWindow({
		width: 440,
		height: 290,
		frame: false,
		transparent: true,
		resizable: false,
		center: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		icon: iconPath || undefined,
		backgroundColor: "#00000000",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`);

	return splashWindow;
}

export function updateSplashStatus(status: string): void {
	if (!splashWindow || splashWindow.isDestroyed()) return;

	const safeStatus = status.replace(/["'\\]/g, "");
	splashWindow.webContents.executeJavaScript(`window.setStatus("${safeStatus}");`).catch(() => {});
}

export async function closeSplashWindow(mainWindow: BrowserWindow): Promise<void> {
	mainWindow.show();
	mainWindow.focus();

	if (!splashWindow || splashWindow.isDestroyed()) {
		return;
	}

	// Smooth fade-out transition over 200ms
	let opacity = 1.0;
	const fadeInterval = setInterval(() => {
		opacity -= 0.2;
		if (opacity <= 0.05) {
			clearInterval(fadeInterval);
			if (splashWindow && !splashWindow.isDestroyed()) {
				splashWindow.destroy();
				splashWindow = null;
			}
		} else if (splashWindow && !splashWindow.isDestroyed()) {
			splashWindow.setOpacity(opacity);
		}
	}, 25);
}
