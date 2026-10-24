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
				"flex h-11 w-full rounded-xl border border-border-strong bg-input px-3.5 py-2 text-sm text-foreground placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:border-ring transition duration-150 disabled:cursor-not-allowed disabled:opacity-50",
				isPickerType && "cursor-pointer",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";
