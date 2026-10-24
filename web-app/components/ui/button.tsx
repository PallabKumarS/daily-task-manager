import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "emerald";
	size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "default", size = "default", ...props }, ref) => {
		const baseStyles =
			"inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer select-none";

		const variantStyles = {
			default:
				"bg-teal-600 text-white hover:bg-teal-500 shadow-sm shadow-teal-950/20 hover:shadow-md hover:shadow-teal-600/20",
			emerald:
				"bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 font-semibold hover:bg-teal-500 dark:hover:bg-teal-400 shadow-sm shadow-teal-500/20",
			secondary: "bg-surface-2 text-foreground hover:bg-border/60 border border-border-strong/70",
			outline: "border border-border-strong bg-surface/70 text-foreground hover:bg-surface-2",
			ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
			destructive: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-950/20",
		};

		const sizeStyles = {
			default: "h-10 px-4 py-2",
			sm: "h-9 rounded-xl px-3.5 text-xs",
			lg: "h-12 rounded-xl px-6 text-base",
			icon: "h-10 w-10",
		};

		return (
			<button
				ref={ref}
				className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";
