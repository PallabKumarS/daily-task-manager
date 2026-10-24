import type * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
	const variantStyles = {
		default: "bg-routine-soft text-routine-fg border-teal-500/30",
		secondary: "bg-surface-2 text-muted-foreground border-border-strong",
		success: "bg-income-soft text-income-fg border-emerald-500/30",
		warning: "bg-alarm-soft text-alarm-fg border-amber-500/30",
		destructive: "bg-expense-soft text-expense-fg border-rose-500/30",
		outline: "text-muted-foreground border-border-strong bg-transparent",
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
