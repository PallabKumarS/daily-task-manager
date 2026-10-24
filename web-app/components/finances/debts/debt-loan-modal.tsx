"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HandCoins, WalletCards } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { DebtLoanItem } from "./types";

const debtLoanSchema = z.object({
	type: z.enum(["DEBT", "LOAN"]),
	personName: z.string().min(1, "Person or entity name is required"),
	amount: z.number().positive("Amount must be greater than zero"),
	date: z.string().min(1, "Date is required"),
	dueDate: z.string().optional(),
	description: z.string().optional(),
	paymentMethod: z.string().min(1),
});

type FormValues = z.infer<typeof debtLoanSchema>;

interface DebtLoanModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData?: DebtLoanItem | null;
	defaultType?: "DEBT" | "LOAN";
}

const PAYMENT_METHODS = [
	{ label: "Cash", value: "Cash" },
	{ label: "Bank Transfer", value: "Bank Transfer" },
	{ label: "Credit Card", value: "Credit Card" },
	{ label: "Debit Card", value: "Debit Card" },
	{ label: "Mobile Wallet", value: "Mobile Wallet" },
	{ label: "Other", value: "Other" },
];

export function DebtLoanModal({
	isOpen,
	onClose,
	onSuccess,
	initialData,
	defaultType = "DEBT",
}: DebtLoanModalProps) {
	const isEditing = Boolean(initialData);

	const todayString = React.useMemo(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}, []);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(debtLoanSchema),
		defaultValues: {
			type: defaultType,
			personName: "",
			amount: undefined,
			date: todayString,
			dueDate: "",
			description: "",
			paymentMethod: "Cash",
		},
	});

	const selectedType = watch("type");
	const selectedPaymentMethod = watch("paymentMethod");

	React.useEffect(() => {
		if (isOpen) {
			if (initialData) {
				const datePart = initialData.date ? initialData.date.slice(0, 10) : todayString;
				const duePart = initialData.dueDate ? initialData.dueDate.slice(0, 10) : "";
				reset({
					type: initialData.type,
					personName: initialData.personName,
					amount: initialData.amount,
					date: datePart,
					dueDate: duePart,
					description: initialData.description || "",
					paymentMethod: "Cash",
				});
			} else {
				reset({
					type: defaultType,
					personName: "",
					amount: undefined,
					date: todayString,
					dueDate: "",
					description: "",
					paymentMethod: "Cash",
				});
			}
		}
	}, [isOpen, initialData, defaultType, todayString, reset]);

	const onSubmit = async (data: FormValues) => {
		try {
			if (isEditing && initialData) {
				const res = await api.patch(`/debts-loans/${initialData.id}`, {
					personName: data.personName,
					description: data.description || null,
					dueDate: data.dueDate || null,
					date: data.date,
				});
				if (res.success) {
					toast.success("Record updated successfully");
					onSuccess();
					onClose();
				} else {
					toast.error(res.message || "Failed to update record");
				}
			} else {
				const res = await api.post("/debts-loans", {
					type: data.type,
					personName: data.personName,
					amount: Number(data.amount),
					date: data.date,
					dueDate: data.dueDate || null,
					description: data.description || null,
					paymentMethod: data.paymentMethod,
				});
				if (res.success) {
					toast.success(`${data.type === "DEBT" ? "Debt" : "Loan"} recorded successfully`);
					onSuccess();
					onClose();
				} else {
					toast.error(res.message || "Failed to create record");
				}
			}
		} catch {
			toast.error("An unexpected error occurred");
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isEditing ? "Edit Record" : "Add Debt or Loan"}
			description={
				isEditing
					? "Update counterparty details, due dates, or descriptions"
					: "Track money borrowed or lent with automatic income and expense accounting"
			}
			maxWidth="md"
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{/* Type Switcher */}
				{!isEditing && (
					<div className="space-y-1.5">
						<Label className="text-xs text-slate-300">Transaction Classification</Label>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setValue("type", "DEBT")}
								className={`flex items-center gap-2 p-3 rounded-xl border text-left transition cursor-pointer ${
									selectedType === "DEBT"
										? "bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm"
										: "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
								}`}
							>
								<WalletCards className="w-5 h-5 shrink-0 text-amber-400" />
								<div>
									<div className="text-xs font-bold">I Borrowed (Debt)</div>
									<div className="text-[11px] text-slate-400">Cash In (+Income in ledger)</div>
								</div>
							</button>

							<button
								type="button"
								onClick={() => setValue("type", "LOAN")}
								className={`flex items-center gap-2 p-3 rounded-xl border text-left transition cursor-pointer ${
									selectedType === "LOAN"
										? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm"
										: "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
								}`}
							>
								<HandCoins className="w-5 h-5 shrink-0 text-emerald-400" />
								<div>
									<div className="text-xs font-bold">I Lent (Loan)</div>
									<div className="text-[11px] text-slate-400">Cash Out (-Expense in ledger)</div>
								</div>
							</button>
						</div>
					</div>
				)}

				{/* Counterparty Person Name */}
				<div className="space-y-1.5">
					<Label htmlFor="personName" className="text-xs text-slate-300">
						{selectedType === "DEBT"
							? "Borrowed From (Person / Entity)"
							: "Lent To (Person / Entity)"}
					</Label>
					<Input
						id="personName"
						placeholder="e.g. John Doe, Sarah, Bank, Mom"
						{...register("personName")}
						className="bg-slate-900 border-slate-800 text-foreground placeholder:text-slate-500 text-xs"
					/>
					{errors.personName && (
						<p className="text-[11px] text-destructive">{errors.personName.message}</p>
					)}
				</div>

				{/* Amount & Date Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="amount" className="text-xs text-slate-300">
							Principal Amount
						</Label>
						<Input
							id="amount"
							type="number"
							step="0.01"
							placeholder="0.00"
							disabled={isEditing}
							{...register("amount", { valueAsNumber: true })}
							className="bg-slate-900 border-slate-800 text-foreground placeholder:text-slate-500 text-xs disabled:opacity-60"
						/>
						{errors.amount && (
							<p className="text-[11px] text-destructive">{errors.amount.message}</p>
						)}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="date" className="text-xs text-slate-300">
							Date
						</Label>
						<Input
							id="date"
							type="date"
							{...register("date")}
							className="bg-slate-900 border-slate-800 text-foreground text-xs"
						/>
						{errors.date && <p className="text-[11px] text-destructive">{errors.date.message}</p>}
					</div>
				</div>

				{/* Due Date & Payment Method Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="dueDate" className="text-xs text-slate-300">
							Expected Due Date <span className="text-slate-500">(Optional)</span>
						</Label>
						<Input
							id="dueDate"
							type="date"
							{...register("dueDate")}
							className="bg-slate-900 border-slate-800 text-foreground text-xs"
						/>
					</div>

					{!isEditing && (
						<div className="space-y-1.5">
							<Label className="text-xs text-slate-300">Payment Channel</Label>
							<CustomSelect
								options={PAYMENT_METHODS}
								value={selectedPaymentMethod}
								onChange={(val) => setValue("paymentMethod", val)}
							/>
						</div>
					)}
				</div>

				{/* Notes / Description */}
				<div className="space-y-1.5">
					<Label htmlFor="description" className="text-xs text-slate-300">
						Notes / Purpose <span className="text-slate-500">(Optional)</span>
					</Label>
					<Input
						id="description"
						placeholder="e.g. Car repair loan, dinner bill split, emergency cash"
						{...register("description")}
						className="bg-slate-900 border-slate-800 text-foreground placeholder:text-slate-500 text-xs"
					/>
				</div>

				{/* Form Actions */}
				<div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onClose}
						className="border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
					>
						Cancel
					</Button>
					<Button
						type="submit"
						size="sm"
						variant="emerald"
						disabled={isSubmitting}
						className="min-w-[100px]"
					>
						{isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Record Entry"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
