import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
	HTMLLabelElement,
	React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
	return (
		<label
			ref={ref}
			className={cn(
				"text-xs font-semibold uppercase tracking-wider text-slate-400 select-none",
				className,
			)}
			{...props}
		/>
	);
});
Label.displayName = "Label";
