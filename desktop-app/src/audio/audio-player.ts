import { BrowserWindow } from "electron";

let audioWindow: BrowserWindow | null = null;

const audioHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
let audioCtx = null;
let activeAlarmTimer = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSingleChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Harmonic C5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Harmonic G5
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);

    // Harmonic C6 chime accent
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1046.50, now + 0.3);
    gain3.gain.setValueAtTime(0.25, now + 0.3);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + 0.85);
  } catch (err) {
    console.error('Audio synthesizer error:', err);
  }
}

window.playChime = function() {
  playSingleChime();
};

window.startAlarm = function(ringCount, intervalSeconds) {
  if (activeAlarmTimer) {
    clearInterval(activeAlarmTimer);
    activeAlarmTimer = null;
  }

  const count = ringCount !== undefined ? ringCount : 3;
  const intervalSec = Math.max(2, intervalSeconds || 10);
  const isContinuous = count === 0;
  const maxRings = isContinuous ? 60 : count;

  playSingleChime();
  let ringsDone = 1;

  if (maxRings <= 1) return;

  activeAlarmTimer = setInterval(() => {
    ringsDone += 1;
    playSingleChime();
    if (!isContinuous && ringsDone >= maxRings) {
      clearInterval(activeAlarmTimer);
      activeAlarmTimer = null;
    }
  }, intervalSec * 1000);
};

window.stopAlarm = function() {
  if (activeAlarmTimer) {
    clearInterval(activeAlarmTimer);
    activeAlarmTimer = null;
  }
};
</script>
</body>
</html>
`;

export function initAudioPlayer(): void {
	if (audioWindow) return;

	audioWindow = new BrowserWindow({
		show: false,
		width: 100,
		height: 100,
		webPreferences: {
			autoplayPolicy: "no-user-gesture-required",
		},
	});

	audioWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(audioHtml)}`);
}

export function playAlarmSound(ringCount = 3, intervalSeconds = 10): void {
	if (!audioWindow || audioWindow.isDestroyed()) {
		initAudioPlayer();
	}
	const js = `window.startAlarm(${ringCount}, ${intervalSeconds});`;
	audioWindow?.webContents.executeJavaScript(js).catch(() => {});
}

export function stopAlarmSound(): void {
	if (audioWindow && !audioWindow.isDestroyed()) {
		audioWindow.webContents.executeJavaScript("window.stopAlarm();").catch(() => {});
	}
}

export function destroyAudioPlayer(): void {
	if (audioWindow && !audioWindow.isDestroyed()) {
		audioWindow.destroy();
		audioWindow = null;
	}
}
