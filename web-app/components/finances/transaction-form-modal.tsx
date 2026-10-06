"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { EXPENSE_CATEGORIES, getCurrencySymbol, INCOME_CATEGORIES } from "@/lib/currency-symbols";

const formSchema = z.object({
	type: z.enum(["EXPENSE", "INCOME"]),
	amount: z.number().positive("Amount must be greater than zero"),
	category: z.string().min(1, "Category is required"),
	description: z.string().optional(),
	paymentMethod: z.string().min(1),
	date: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_PAYMENT_METHODS = [
	"Cash",
	"Debit / Credit Card",
	"Bank Transfer",
	"Mobile Banking",
	"Crypto",
	"Other",
];

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
}

export function TransactionFormModal({
	isOpen,
	onClose,
	onSuccess,
	initialData,
	defaultType = "EXPENSE",
}: TransactionFormModalProps) {
	const { user } = useAuth();
	const currencySymbol = getCurrencySymbol(user?.currency || "USD");

	const [amountDisplay, setAmountDisplay] = React.useState<string>("");
	const [customCategories, setCustomCategories] = React.useState<CustomCategoryItem[]>([]);
	const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
	const [managerGroup, setManagerGroup] = React.useState<"EXPENSE" | "INCOME" | "PAYMENT_METHOD">(
		"EXPENSE",
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

	// Fetch custom categories from server collection
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

		const onCategoriesUpdated = () => fetchCustomCategories();
		window.addEventListener("daypulse:categories-updated", onCategoriesUpdated);
		return () => {
			window.removeEventListener("daypulse:categories-updated", onCategoriesUpdated);
		};
	}, [isOpen, fetchCustomCategories]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset form on modal open
	React.useEffect(() => {
		if (initialData) {
			const d = new Date(initialData.date);
			const dateStr = !Number.isNaN(d.getTime())
				? d.toISOString().slice(0, 10)
				: new Date().toISOString().slice(0, 10);

			setAmountDisplay(String(initialData.amount));
			reset({
				type: initialData.type,
				amount: initialData.amount,
				category: initialData.category,
				description: initialData.description || "",
				paymentMethod: initialData.paymentMethod || "Cash",
				date: dateStr,
			});
		} else {
			setAmountDisplay("");
			reset({
				type: defaultType,
				amount: 0,
				category: defaultType === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
				description: "",
				paymentMethod: "Cash",
				date: new Date().toISOString().slice(0, 10),
			});
		}
	}, [initialData, defaultType, reset, isOpen]);

	const handleTypeToggle = (type: "EXPENSE" | "INCOME") => {
		setValue("type", type);
		const defaultCat = type === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
		setValue("category", defaultCat);
	};

	// Amount input focus/blur handling to avoid zero sticking
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
			const endpoint = initialData ? `/finances/${initialData.id}` : "/finances";
			const res = initialData ? await api.patch(endpoint, data) : await api.post(endpoint, data);

			if (res.success) {
				toast.success(res.message || `${data.type === "INCOME" ? "Income" : "Expense"} recorded`);
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

	// Compile Category Options (Defaults + User Custom Categories)
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
				isCustom: true,
				color: c.color || "#10b981",
			}));

		return [...defaultOpts, ...userOpts];
	}, [currentType, customCategories]);

	// Compile Payment Method Options (Defaults + User Custom Methods)
	const paymentOptions: SelectOption[] = React.useMemo(() => {
		const defaultOpts: SelectOption[] = DEFAULT_PAYMENT_METHODS.map((method) => ({
			label: method,
			value: method,
		}));

		const userOpts: SelectOption[] = customCategories
			.filter(
				(c) =>
					c.group === "PAYMENT_METHOD" &&
					!(DEFAULT_PAYMENT_METHODS as readonly string[]).includes(c.name),
			)
			.map((c) => ({
				label: c.name,
				value: c.name,
				isCustom: true,
				color: "#38bdf8",
			}));

		return [...defaultOpts, ...userOpts];
	}, [customCategories]);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={
				initialData
					? "Edit Transaction"
					: currentType === "EXPENSE"
						? "Log Daily Spending"
						: "Log Income / Earning"
			}
			description="Track daily cashflow with full cumulative analytics"
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{/* Toggle Expense vs Income */}
				<div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
					<button
						type="button"
						onClick={() => handleTypeToggle("EXPENSE")}
						className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
							currentType === "EXPENSE"
								? "bg-red-500/20 text-red-400 border border-red-500/30"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Spending (Expense)
					</button>
					<button
						type="button"
						onClick={() => handleTypeToggle("INCOME")}
						className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
							currentType === "INCOME"
								? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Earning (Income)
					</button>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{/* Amount input with dynamic 0 removal */}
					<div className="space-y-1.5">
						<Label htmlFor="amount">Amount ({currencySymbol})</Label>
						<div className="relative">
							<span className="absolute left-3.5 top-3 text-sm font-semibold text-slate-400">
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
						{errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
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

				<div className="flex justify-end gap-3 pt-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="submit"
						variant={currentType === "EXPENSE" ? "destructive" : "emerald"}
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
