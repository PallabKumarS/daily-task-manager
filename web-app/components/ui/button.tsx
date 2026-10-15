import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "emerald";
	size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "default", size = "default", ...props }, ref) => {
		const baseStyles =
			"inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer";

		const variantStyles = {
			default: "bg-teal-600 text-white hover:bg-teal-500 shadow-sm shadow-teal-950/40",
			emerald:
				"bg-teal-500 text-slate-950 font-semibold hover:bg-teal-400 shadow-sm shadow-teal-500/20",
			secondary: "bg-slate-800/90 text-slate-100 hover:bg-slate-700/80 border border-slate-700/60",
			outline: "border border-slate-700/80 bg-slate-900/40 hover:bg-slate-800 hover:text-white",
			ghost: "hover:bg-slate-800/60 hover:text-slate-100",
			destructive: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-950/40",
		};

		const sizeStyles = {
			default: "h-10 px-4 py-2",
			sm: "h-8 rounded-lg px-3 text-xs",
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
