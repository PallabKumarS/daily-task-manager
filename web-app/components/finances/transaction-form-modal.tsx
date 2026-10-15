"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Repeat } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { CategoryManagerModal } from "@/components/categories/category-manager-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import {
	EXPENSE_CATEGORIES,
	formatCurrency,
	getCurrencySymbol,
	INCOME_CATEGORIES,
} from "@/lib/currency-symbols";
import { recordRecentAddition } from "@/lib/recent-activity-store";
import { DAY_NAMES_SHORT, useWorkweekPreferences } from "@/lib/workweek-preferences";

const formSchema = z.object({
	type: z.enum(["EXPENSE", "INCOME"]),
	amount: z.number().positive("Amount must be greater than zero"),
	category: z.string().min(1, "Category is required"),
	description: z.string().optional(),
	paymentMethod: z.string().min(1),
	date: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface CustomCategoryItem {
	id: string;
	name: string;
	group: string;
	color?: string | null;
}

interface TransactionFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData?: {
		id: string;
		type: "EXPENSE" | "INCOME";
		amount: number;
		category: string;
		description?: string | null;
		paymentMethod: string;
		date: string | Date;
	} | null;
	defaultType?: "EXPENSE" | "INCOME";
	defaultDate?: string;
}

export function TransactionFormModal({
	isOpen,
	onClose,
	onSuccess,
	initialData,
	defaultType = "EXPENSE",
	defaultDate,
}: TransactionFormModalProps) {
	const { user } = useAuth();
	const { weekdays, weekendDays } = useWorkweekPreferences();
	const currencySymbol = getCurrencySymbol(user?.currency || "USD");

	const [amountDisplay, setAmountDisplay] = React.useState<string>("");
	const [customCategories, setCustomCategories] = React.useState<CustomCategoryItem[]>([]);
	const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
	const [managerGroup, setManagerGroup] = React.useState<"EXPENSE" | "INCOME" | "PAYMENT_METHOD">(
		"EXPENSE",
	);

	// Recurring state
	const [isRecurring, setIsRecurring] = React.useState(false);
	const [recurringDays, setRecurringDays] = React.useState<number[]>(weekdays);

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
			type: defaultType,
			amount: 0,
			category: defaultType === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
			description: "",
			paymentMethod: "Cash",
			date: new Date().toISOString().slice(0, 10),
		},
	});

	const currentType = watch("type");
	const selectedCategory = watch("category");
	const selectedPaymentMethod = watch("paymentMethod");

	const fetchCustomCategories = React.useCallback(async () => {
		try {
			const res = await api.get<CustomCategoryItem[]>("/categories");
			if (res.success && Array.isArray(res.data)) {
				setCustomCategories(res.data);
			}
		} catch {
			// ignore
		}
	}, []);

	React.useEffect(() => {
		if (isOpen) {
			fetchCustomCategories();
		}
	}, [isOpen, fetchCustomCategories]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset form on modal open
	React.useEffect(() => {
		if (initialData) {
			const d = new Date(initialData.date);
			const dateStr = !Number.isNaN(d.getTime())
				? d.toISOString().slice(0, 10)
				: new Date().toISOString().slice(0, 10);

			let baseDesc = initialData.description || "";
			const recMatch = baseDesc.match(/\[Recurring:\s*([^\]]+)\]/i);
			if (recMatch) {
				setIsRecurring(true);
				baseDesc = baseDesc.replace(/\[Recurring:\s*[^\]]+\]/i, "").trim();
				const daysStr = recMatch[1].toLowerCase();
				const parsedDays: number[] = [];
				DAY_NAMES_SHORT.forEach((day, index) => {
					if (daysStr.includes(day.toLowerCase())) {
						parsedDays.push(index);
					}
				});
				setRecurringDays(parsedDays.length > 0 ? parsedDays : weekdays);
			} else {
				setIsRecurring(false);
				setRecurringDays(weekdays);
			}

			setAmountDisplay(String(initialData.amount));
			reset({
				type: initialData.type,
				amount: initialData.amount,
				category: initialData.category,
				description: baseDesc,
				paymentMethod: initialData.paymentMethod || "Cash",
				date: dateStr,
			});
		} else {
			setIsRecurring(false);
			setRecurringDays(weekdays);
			setAmountDisplay("");
			reset({
				type: defaultType,
				amount: 0,
				category: defaultType === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
				description: "",
				paymentMethod: "Cash",
				date: defaultDate || new Date().toISOString().slice(0, 10),
			});
		}
	}, [initialData, defaultType, defaultDate, reset, isOpen, weekdays]);

	const handleTypeToggle = (type: "EXPENSE" | "INCOME") => {
		setValue("type", type);
		const defaultCat = type === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
		setValue("category", defaultCat);
	};

	const handleAmountFocus = () => {
		if (amountDisplay === "0" || amountDisplay === "0.00") {
			setAmountDisplay("");
		}
	};

	const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setAmountDisplay(val);
		const numeric = parseFloat(val);
		setValue("amount", Number.isNaN(numeric) ? 0 : numeric, {
			shouldValidate: true,
		});
	};

	const handleToggleRecurringDay = (dayIndex: number) => {
		setRecurringDays((prev) => {
			if (prev.includes(dayIndex)) {
				if (prev.length <= 1) return prev;
				return prev.filter((d) => d !== dayIndex);
			}
			return [...prev, dayIndex].sort();
		});
	};

	const handleCreateCategory = async (name: string) => {
		try {
			const res = await api.post<CustomCategoryItem>("/categories", {
				name,
				group: currentType,
			});
			if (res.success && res.data) {
				setCustomCategories((prev) => [...prev, res.data]);
				setValue("category", res.data.name);
				toast.success(`Category "${res.data.name}" saved to your collection`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to create category";
			toast.error(message);
		}
	};

	const handleCreatePaymentMethod = async (name: string) => {
		try {
			const res = await api.post<CustomCategoryItem>("/categories", {
				name,
				group: "PAYMENT_METHOD",
			});
			if (res.success && res.data) {
				setCustomCategories((prev) => [...prev, res.data]);
				setValue("paymentMethod", res.data.name);
				toast.success(`Payment method "${res.data.name}" saved`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to create payment method";
			toast.error(message);
		}
	};

	const onSubmit = async (data: FormValues) => {
		try {
			let finalDescription = data.description?.trim() || "";
			if (isRecurring && recurringDays.length > 0) {
				const daysLabel = recurringDays.map((d) => DAY_NAMES_SHORT[d]).join(", ");
				finalDescription = finalDescription
					? `${finalDescription} [Recurring: ${daysLabel}]`
					: `[Recurring: ${daysLabel}]`;
			}

			const payload = {
				...data,
				description: finalDescription,
			};

			const endpoint = initialData ? `/finances/${initialData.id}` : "/finances";
			const res = initialData
				? await api.patch(endpoint, payload)
				: await api.post(endpoint, payload);

			if (res.success) {
				const txData = (res.data as { id?: string }) || {};
				const createdId = txData.id || initialData?.id || String(Date.now());

				recordRecentAddition({
					id: createdId,
					type: data.type,
					title: data.description?.trim() || `${data.category} Transaction`,
					amount: data.amount,
					category: data.category,
					paymentMethod: data.paymentMethod,
					date: data.date,
				});

				const formattedAmt = formatCurrency(data.amount, user?.currency || "USD");
				toast.success(
					`${data.type === "INCOME" ? "Income" : "Expense"} of ${formattedAmt} recorded`,
					{
						description: `${data.category} • ${data.paymentMethod}${data.description ? ` • "${data.description}"` : ""}`,
					},
				);
				onSuccess();
				onClose();
			} else {
				toast.error(res.message || "Failed to record transaction");
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Error recording transaction";
			toast.error(message);
		}
	};

	const categoryOptions: SelectOption[] = React.useMemo(() => {
		const defaults = currentType === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
		const defaultOpts: SelectOption[] = defaults.map((cat) => ({
			label: cat,
			value: cat,
		}));

		const userOpts: SelectOption[] = customCategories
			.filter((c) => c.group === currentType && !(defaults as readonly string[]).includes(c.name))
			.map((c) => ({
				label: c.name,
				value: c.name,
			}));

		return [...defaultOpts, ...userOpts];
	}, [currentType, customCategories]);

	const paymentOptions: SelectOption[] = React.useMemo(() => {
		const defaults = [
			"Cash",
			"Debit / Credit Card",
			"Bank Transfer",
			"Mobile Banking",
			"Crypto",
			"Other",
		];
		const defaultOpts: SelectOption[] = defaults.map((method) => ({
			label: method,
			value: method,
		}));

		const userOpts: SelectOption[] = customCategories
			.filter((c) => c.group === "PAYMENT_METHOD" && !defaults.includes(c.name))
			.map((c) => ({
				label: c.name,
				value: c.name,
			}));

		return [...defaultOpts, ...userOpts];
	}, [customCategories]);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={
				initialData
					? `Edit ${initialData.type === "INCOME" ? "Income" : "Expense"}`
					: `Record New ${currentType === "EXPENSE" ? "Expense" : "Income"}`
			}
			description="Log an itemized cashflow entry with amount, category, and date"
			maxWidth="md"
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
				{/* Type Switcher */}
				<div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
					<button
						type="button"
						onClick={() => handleTypeToggle("EXPENSE")}
						className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
							currentType === "EXPENSE"
								? "bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Expense
					</button>
					<button
						type="button"
						onClick={() => handleTypeToggle("INCOME")}
						className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
							currentType === "INCOME"
								? "bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Income
					</button>
				</div>

				{/* Amount & Date */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<Label htmlFor="amount">Amount ({currencySymbol})</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">
								{currencySymbol}
							</span>
							<Input
								id="amount"
								type="number"
								step="any"
								placeholder="0.00"
								value={amountDisplay}
								onFocus={handleAmountFocus}
								onChange={handleAmountChange}
								className="pl-8 h-11 text-base font-semibold"
								autoComplete="off"
							/>
						</div>
						{errors.amount && <p className="text-xs text-rose-400">{errors.amount.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="date">Date</Label>
						<Input id="date" type="date" className="h-11" {...register("date")} />
					</div>
				</div>

				{/* Custom Category & Payment Method Dropdowns */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<CustomSelect
						label="Category"
						value={selectedCategory}
						onChange={(val) => setValue("category", val, { shouldValidate: true })}
						options={categoryOptions}
						placeholder="Select category..."
						group={currentType}
						onCreateNew={handleCreateCategory}
						onEditClick={() => {
							setManagerGroup(currentType);
							setCategoryManagerOpen(true);
						}}
						createPlaceholder="Create new category name..."
						error={errors.category?.message}
					/>

					<CustomSelect
						label="Payment Method"
						value={selectedPaymentMethod}
						onChange={(val) => setValue("paymentMethod", val, { shouldValidate: true })}
						options={paymentOptions}
						placeholder="Select payment method..."
						group="PAYMENT_METHOD"
						onCreateNew={handleCreatePaymentMethod}
						onEditClick={() => {
							setManagerGroup("PAYMENT_METHOD");
							setCategoryManagerOpen(true);
						}}
						createPlaceholder="Create new payment method..."
						error={errors.paymentMethod?.message}
					/>
				</div>

				<CategoryManagerModal
					isOpen={categoryManagerOpen}
					onClose={() => setCategoryManagerOpen(false)}
					defaultGroup={managerGroup}
					onUpdated={fetchCustomCategories}
				/>

				<div className="space-y-1.5">
					<Label htmlFor="description">Description / Notes (Optional)</Label>
					<Input
						id="description"
						placeholder="e.g. Grocery shopping, Client invoice, Coffee"
						{...register("description")}
					/>
				</div>

				{/* Recurring Transaction Configuration (Progressive Disclosure) */}
				<div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Repeat className="w-4 h-4 text-teal-400" />
							<span className="text-xs font-bold text-slate-200">Recurring Transaction</span>
						</div>
						<button
							type="button"
							onClick={() => setIsRecurring(!isRecurring)}
							className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
								isRecurring
									? "bg-teal-500/15 text-teal-300 border-teal-500/30"
									: "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
							}`}
						>
							{isRecurring ? "Recurring Active" : "One-Time Entry"}
						</button>
					</div>

					{isRecurring && (
						<div className="space-y-2 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-slate-400 font-medium">Schedule Presets:</span>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										onClick={() => setRecurringDays(weekdays)}
										className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
									>
										Weekdays ({weekdays.map((d) => DAY_NAMES_SHORT[d]).join(",")})
									</button>
									<button
										type="button"
										onClick={() => setRecurringDays(weekendDays)}
										className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
									>
										Weekends ({weekendDays.map((d) => DAY_NAMES_SHORT[d]).join(",")})
									</button>
									<button
										type="button"
										onClick={() => setRecurringDays([0, 1, 2, 3, 4, 5, 6])}
										className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
									>
										All Days
									</button>
								</div>
							</div>

							<div className="flex flex-wrap gap-1.5 pt-1">
								{DAY_NAMES_SHORT.map((dayName, idx) => {
									const isSelected = recurringDays.includes(idx);
									return (
										<button
											key={dayName}
											type="button"
											onClick={() => handleToggleRecurringDay(idx)}
											className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
												isSelected
													? "bg-teal-500/20 text-teal-300 border-teal-500/40"
													: "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
											}`}
										>
											{dayName}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-3 pt-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="submit"
						variant={currentType === "EXPENSE" ? "destructive" : "default"}
						disabled={isSubmitting}
					>
						{isSubmitting
							? "Recording..."
							: initialData
								? "Save Changes"
								: `Record ${currentType === "EXPENSE" ? "Expense" : "Income"}`}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
