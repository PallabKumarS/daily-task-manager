"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
			if (initialData) {
				await api.patch(`/trackers/${initialData.id}`, data);
				toast.success("Tracker updated successfully");
			} else {
				await api.post("/trackers", data);
				toast.success("Tracker created successfully");
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
					{errors.name && (
						<p className="text-xs text-rose-400">{errors.name.message}</p>
					)}
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
						{errors.unitName && (
							<p className="text-xs text-rose-400">{errors.unitName.message}</p>
						)}
					</div>
				</div>

				{/* Default Expected Target & Unit Price */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
							<p className="text-xs text-rose-400">
								{errors.defaultTarget.message}
							</p>
						)}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="unitPrice">Unit Price (Optional)</Label>
						<Input
							id="unitPrice"
							type="number"
							step="any"
							placeholder="e.g. 80.00 or 4.50 (leave empty if non-monetary)"
							{...register("unitPrice", {
								setValueAs: (v) =>
									v === "" || v === null || Number.isNaN(v) ? null : Number(v),
							})}
						/>
						<p className="text-[11px] text-slate-500">
							Set a price per unit to enable automatic bill calculation and
							ledger reconciliation.
						</p>
					</div>
				</div>

				{/* Currency & Color Theme */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<CustomSelect
						label="Currency"
						value={selectedCurrency}
						onChange={(val) => setValue("currency", val)}
						options={currencyOptions}
						placeholder="Select Currency"
						allowManage={false}
					/>

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
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={isSubmitting}
						className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
					>
						{isSubmitting
							? "Saving..."
							: initialData
								? "Update Tracker"
								: "Create Tracker"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
