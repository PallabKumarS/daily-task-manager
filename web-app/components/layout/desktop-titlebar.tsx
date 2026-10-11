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
					// ignore
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
			className="h-9 w-full bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between select-none z-50 shrink-0 sticky top-0"
		>
			{/* Left: App Branding */}
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
				<span className="text-xs font-bold text-slate-200 tracking-tight">DayPulse</span>
			</div>

			{/* Center: Draggable Space */}
			<div className="flex-1 h-full" style={dragStyle} />

			{/* Right: Window Controls */}
			<div className="flex items-center h-full" style={noDragStyle}>
				{/* Fullscreen Toggle */}
				<button
					type="button"
					onClick={handleToggleFullScreen}
					className="h-full px-3 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
					title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
				>
					{isFullScreen ? (
						<Minimize2 className="w-3.5 h-3.5" />
					) : (
						<Maximize2 className="w-3.5 h-3.5" />
					)}
				</button>

				{/* Minimize Button */}
				<button
					type="button"
					onClick={handleMinimize}
					className="h-full px-3 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
					title="Minimize"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>

				{/* Maximize / Restore Button */}
				<button
					type="button"
					onClick={handleMaximize}
					className="h-full px-3 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
					title={isMaximized ? "Restore" : "Maximize"}
				>
					{isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
				</button>

				{/* Close Button (Minimizes to tray) */}
				<button
					type="button"
					onClick={handleClose}
					className="h-full px-3.5 text-slate-400 hover:text-white hover:bg-rose-600 transition-colors flex items-center justify-center cursor-pointer"
					title="Minimize to Tray"
				>
					<X className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}
