import type * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
	const variantStyles = {
		default: "bg-teal-500/10 text-teal-300 border-teal-500/30",
		secondary: "bg-slate-800/80 text-slate-300 border-slate-700/60",
		success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
		warning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
		destructive: "bg-rose-500/10 text-rose-300 border-rose-500/30",
		outline: "text-slate-300 border-slate-700/80 bg-transparent",
	};

	return (
		<div
			className={cn(
				"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
				variantStyles[variant],
				className,
			)}
			{...props}
		/>
	);
}
