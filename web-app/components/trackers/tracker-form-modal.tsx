"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Hash } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { CURRENCIES } from "@/lib/currency-symbols";
import { recordRecentAddition } from "@/lib/recent-activity-store";
import type { DailyTrackerItem } from "./tracker-types";

const formSchema = z.object({
	name: z.string().min(1, "Tracker name is required"),
	category: z.string().min(1, "Category is required"),
	unitName: z.string().min(1, "Unit name is required"),
	defaultTarget: z.number().min(0, "Default target must be 0 or greater"),
	unitPrice: z.number().min(0).nullable().optional(),
	currency: z.string().min(1),
	color: z.string().min(1),
	description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const TRACKER_CATEGORIES = [
	"Meals & Food",
	"Household & Utilities",
	"Health & Fitness",
	"Work & Study",
	"Personal & Habits",
	"Freelance & Billing",
];

const COLOR_OPTIONS: SelectOption[] = [
	{ label: "Emerald Green", value: "emerald" },
	{ label: "Cyan Aqua", value: "cyan" },
	{ label: "Ocean Blue", value: "blue" },
	{ label: "Amethyst Violet", value: "violet" },
	{ label: "Sunset Amber", value: "amber" },
	{ label: "Rose Pink", value: "rose" },
];

interface TrackerFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData?: DailyTrackerItem | null;
}

export function TrackerFormModal({
	isOpen,
	onClose,
	onSuccess,
	initialData,
}: TrackerFormModalProps) {
	const { user } = useAuth();
	const [isMonetary, setIsMonetary] = React.useState<boolean>(
		Boolean(initialData?.unitPrice && initialData.unitPrice > 0),
	);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			category: "Meals & Food",
			unitName: "meals",
			defaultTarget: 2,
			unitPrice: null,
			currency: user?.currency || "USD",
			color: "emerald",
			description: "",
		},
	});

	const selectedCategory = watch("category");
	const selectedCurrency = watch("currency");
	const selectedColor = watch("color");

	React.useEffect(() => {
		if (initialData) {
			setIsMonetary(Boolean(initialData.unitPrice && initialData.unitPrice > 0));
			reset({
				name: initialData.name,
				category: initialData.category,
				unitName: initialData.unitName,
				defaultTarget: initialData.defaultTarget,
				unitPrice: initialData.unitPrice ?? null,
				currency: initialData.currency || user?.currency || "USD",
				color: initialData.color || "emerald",
				description: initialData.description || "",
			});
		} else {
			setIsMonetary(false);
			reset({
				name: "",
				category: "Meals & Food",
				unitName: "meals",
				defaultTarget: 2,
				unitPrice: null,
				currency: user?.currency || "USD",
				color: "emerald",
				description: "",
			});
		}
	}, [initialData, reset, user]);

	const categoryOptions: SelectOption[] = TRACKER_CATEGORIES.map((cat) => ({
		label: cat,
		value: cat,
	}));

	const currencyOptions: SelectOption[] = CURRENCIES.map((c) => ({
		label: `${c.code} (${c.symbol})`,
		value: c.code,
	}));

	const onSubmit = async (data: FormValues) => {
		try {
			const finalUnitPrice = isMonetary ? (data.unitPrice ?? null) : null;
			const payload = {
				...data,
				unitPrice: finalUnitPrice,
			};

			if (initialData) {
				await api.patch(`/trackers/${initialData.id}`, payload);
				recordRecentAddition({
					id: initialData.id,
					type: "TRACKER",
					title: data.name,
					category: data.category,
					amount: finalUnitPrice ?? undefined,
					date: new Date().toISOString(),
				});
				toast.success(`Tracker "${data.name}" updated`);
			} else {
				const res = await api.post<DailyTrackerItem>("/trackers", payload);
				const createdId = res.data?.id || String(Date.now());
				recordRecentAddition({
					id: createdId,
					type: "TRACKER",
					title: data.name,
					category: data.category,
					amount: finalUnitPrice ?? undefined,
					date: new Date().toISOString(),
				});
				toast.success(`Tracker "${data.name}" created`, {
					description: `Target: ${data.defaultTarget} ${data.unitName}/day • ${data.category}`,
				});
			}
			onSuccess();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to save tracker";
			toast.error(msg);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={initialData ? "Edit Daily Tracker" : "Create Daily Tracker"}
			description="Track daily variable deliveries, counts, meals, and metered expenses."
			maxWidth="lg"
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{/* Tracker Name */}
				<div className="space-y-1.5">
					<Label htmlFor="trackerName">Tracker Name</Label>
					<Input
						id="trackerName"
						placeholder="e.g. Daily Meals, Cow Milk Delivery, Water Bottles..."
						{...register("name")}
					/>
					{errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
				</div>

				{/* Category & Unit Name */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<CustomSelect
						label="Category"
						value={selectedCategory}
						onChange={(val) => setValue("category", val)}
						options={categoryOptions}
						group="TRACKER_CATEGORY"
						placeholder="Select Category"
					/>

					<div className="space-y-1.5">
						<Label htmlFor="unitName">Unit Label (plural)</Label>
						<Input
							id="unitName"
							placeholder="e.g. meals, liters, bottles, hours, pages"
							{...register("unitName")}
						/>
						{errors.unitName && <p className="text-xs text-rose-400">{errors.unitName.message}</p>}
					</div>
				</div>

				{/* Counter Mode Selector */}
				<div className="space-y-1.5">
					<Label className="text-xs text-slate-300">Counter Classification</Label>
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={() => {
								setIsMonetary(false);
								setValue("unitPrice", null);
							}}
							className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition cursor-pointer ${
								!isMonetary
									? "bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-sm"
									: "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
							}`}
						>
							<div className="flex items-center gap-2 font-bold text-xs">
								<Hash className="w-4 h-4 text-teal-400" />
								<span>Simple Counter</span>
							</div>
							<p className="text-[11px] text-slate-400">
								Habits, water glasses, pushups, pages. No money or settlement.
							</p>
						</button>

						<button
							type="button"
							onClick={() => setIsMonetary(true)}
							className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition cursor-pointer ${
								isMonetary
									? "bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm"
									: "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
							}`}
						>
							<div className="flex items-center gap-2 font-bold text-xs">
								<DollarSign className="w-4 h-4 text-amber-400" />
								<span>Metered / Billable</span>
							</div>
							<p className="text-[11px] text-slate-400">
								Paid deliveries, daily meals, milk, billable hours. Has unit price & settlement.
							</p>
						</button>
					</div>
				</div>

				{/* Target & Conditional Pricing */}
				<div className={`grid grid-cols-1 ${isMonetary ? "sm:grid-cols-2" : ""} gap-4`}>
					<div className="space-y-1.5">
						<Label htmlFor="defaultTarget">Normal Daily Expected Count</Label>
						<Input
							id="defaultTarget"
							type="number"
							step="any"
							placeholder="e.g. 2 (for 2 meals/day)"
							{...register("defaultTarget", { valueAsNumber: true })}
						/>
						{errors.defaultTarget && (
							<p className="text-xs text-rose-400">{errors.defaultTarget.message}</p>
						)}
					</div>

					{isMonetary && (
						<div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
							<Label htmlFor="unitPrice">Unit Price</Label>
							<Input
								id="unitPrice"
								type="number"
								step="any"
								placeholder="e.g. 80.00 or 4.50"
								{...register("unitPrice", {
									setValueAs: (v) => (v === "" || v === null || Number.isNaN(v) ? null : Number(v)),
								})}
							/>
							<p className="text-[11px] text-slate-500">
								Price per unit for automatic bill calculation and ledger reconciliation.
							</p>
						</div>
					)}
				</div>

				{/* Currency (if monetary) & Color Theme */}
				<div className={`grid grid-cols-1 ${isMonetary ? "sm:grid-cols-2" : ""} gap-4`}>
					{isMonetary && (
						<CustomSelect
							label="Currency"
							value={selectedCurrency}
							onChange={(val) => setValue("currency", val)}
							options={currencyOptions}
							placeholder="Select Currency"
							allowManage={false}
						/>
					)}

					<CustomSelect
						label="Color Accent"
						value={selectedColor}
						onChange={(val) => setValue("color", val)}
						options={COLOR_OPTIONS}
						placeholder="Select Color"
						allowManage={false}
					/>
				</div>

				{/* Description / Provider Notes */}
				<div className="space-y-1.5">
					<Label htmlFor="description">Notes / Provider Info (Optional)</Label>
					<Input
						id="description"
						placeholder="e.g. Tiffin service provider phone: 017..., payable end of month"
						{...register("description")}
					/>
				</div>

				{/* Action Buttons */}
				<div className="pt-2 flex items-center justify-end gap-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={isSubmitting}
						className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
					>
						{isSubmitting ? "Saving..." : initialData ? "Update Tracker" : "Create Tracker"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
