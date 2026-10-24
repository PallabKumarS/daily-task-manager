"use client";

import { Copy, Maximize2, Minimize2, Minus, Square, X } from "lucide-react";
import Image from "next/image";
import * as React from "react";

export function DesktopTitlebar() {
	const [isElectron, setIsElectron] = React.useState(false);
	const [isMaximized, setIsMaximized] = React.useState(false);
	const [isFullScreen, setIsFullScreen] = React.useState(false);

	React.useEffect(() => {
		if (typeof window === "undefined") return;

		const api = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;
		if (api?.isElectron) {
			setIsElectron(true);
			document.documentElement.classList.add("is-electron");
			document.documentElement.style.setProperty("--titlebar-height", "36px");

			const checkState = async () => {
				try {
					if (typeof api.isMaximized === "function") {
						const max = await (api.isMaximized as () => Promise<boolean>)();
						setIsMaximized(Boolean(max));
					}
					if (typeof api.isFullScreen === "function") {
						const fs = await (api.isFullScreen as () => Promise<boolean>)();
						setIsFullScreen(Boolean(fs));
					}
				} catch {
					// Ignore IPC errors when initializing window state
				}
			};

			checkState();

			if (typeof api.onWindowStateChange === "function") {
				const unsubscribe = (
					api.onWindowStateChange as (
						cb: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
					) => () => void
				)((state) => {
					setIsMaximized(state.isMaximized);
					setIsFullScreen(state.isFullScreen);
				});
				return () => {
					if (typeof unsubscribe === "function") unsubscribe();
				};
			}
		}
	}, []);

	if (!isElectron) {
		return null;
	}

	const handleMinimize = () => {
		const api = (window as unknown as { electronAPI?: { minimize?: () => void } }).electronAPI;
		api?.minimize?.();
	};

	const handleMaximize = () => {
		const api = (window as unknown as { electronAPI?: { maximize?: () => void } }).electronAPI;
		api?.maximize?.();
	};

	const handleToggleFullScreen = () => {
		const api = (window as unknown as { electronAPI?: { toggleFullScreen?: () => void } })
			.electronAPI;
		api?.toggleFullScreen?.();
	};

	const handleClose = () => {
		const api = (window as unknown as { electronAPI?: { close?: () => void } }).electronAPI;
		api?.close?.();
	};

	const dragStyle: React.CSSProperties = {
		WebkitAppRegion: "drag",
	} as React.CSSProperties;

	const noDragStyle: React.CSSProperties = {
		WebkitAppRegion: "no-drag",
	} as React.CSSProperties;

	return (
		<div
			style={dragStyle}
			className="h-9 w-full bg-surface border-b border-border flex items-center justify-between select-none z-50 shrink-0 sticky top-0"
		>
			<div className="flex items-center gap-2 px-3 min-w-0" style={noDragStyle}>
				<div className="w-4 h-4 relative shrink-0">
					<Image
						src="/icon.png"
						alt="DayPulse"
						width={16}
						height={16}
						className="rounded object-contain"
					/>
				</div>
				<span className="text-xs font-bold text-foreground tracking-tight">DayPulse</span>
			</div>

			<div className="flex-1 h-full" style={dragStyle} />

			<div className="flex items-center h-full" style={noDragStyle}>
				<button
					type="button"
					onClick={handleToggleFullScreen}
					className="h-full px-3 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors flex items-center justify-center cursor-pointer"
					title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
				>
					{isFullScreen ? (
						<Minimize2 className="w-3.5 h-3.5" />
					) : (
						<Maximize2 className="w-3.5 h-3.5" />
					)}
				</button>

				<button
					type="button"
					onClick={handleMinimize}
					className="h-full px-3 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors flex items-center justify-center cursor-pointer"
					title="Minimize"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>

				<button
					type="button"
					onClick={handleMaximize}
					className="h-full px-3 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors flex items-center justify-center cursor-pointer"
					title={isMaximized ? "Restore" : "Maximize"}
				>
					{isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
				</button>

				<button
					type="button"
					onClick={handleClose}
					className="h-full px-3.5 text-muted-foreground hover:text-foreground hover:bg-rose-600 transition-colors flex items-center justify-center cursor-pointer"
					title="Minimize to Tray"
				>
					<X className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}
