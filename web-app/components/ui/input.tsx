import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, onClick, ...props }, ref) => {
	const isPickerType = type === "date" || type === "time" || type === "datetime-local";

	const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
		if (isPickerType) {
			try {
				e.currentTarget.showPicker?.();
			} catch {
				// Fallback if browser does not support showPicker
			}
		}
		onClick?.(e);
	};

	return (
		<input
			type={type}
			onClick={handleClick}
			className={cn(
				"flex h-10 w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 transition duration-150 disabled:cursor-not-allowed disabled:opacity-50",
				isPickerType && "cursor-pointer [color-scheme:dark]",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";
