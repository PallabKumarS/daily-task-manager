"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
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
import { formatCurrency } from "@/lib/currency-symbols";
import type { DebtLoanItem } from "./types";

interface RepaymentModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	debtLoan: DebtLoanItem | null;
	currency?: string;
}

const repaymentSchema = z.object({
	amount: z.number().positive("Amount must be greater than zero"),
	date: z.string().min(1, "Date is required"),
	paymentMethod: z.string().min(1),
	notes: z.string().optional(),
});

type FormValues = z.infer<typeof repaymentSchema>;

const PAYMENT_METHODS = [
	{ label: "Cash", value: "Cash" },
	{ label: "Bank Transfer", value: "Bank Transfer" },
	{ label: "Credit Card", value: "Credit Card" },
	{ label: "Debit Card", value: "Debit Card" },
	{ label: "Mobile Wallet", value: "Mobile Wallet" },
	{ label: "Other", value: "Other" },
];

export function RepaymentModal({
	isOpen,
	onClose,
	onSuccess,
	debtLoan,
	currency = "USD",
}: RepaymentModalProps) {
	const todayString = React.useMemo(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}, []);

	const remainingAmount = debtLoan ? debtLoan.remainingAmount : 0;
	const isDebt = debtLoan?.type === "DEBT";

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(repaymentSchema),
		defaultValues: {
			amount: remainingAmount > 0 ? remainingAmount : undefined,
			date: todayString,
			paymentMethod: "Cash",
			notes: "",
		},
	});

	const selectedPaymentMethod = watch("paymentMethod");

	React.useEffect(() => {
		if (isOpen && debtLoan) {
			reset({
				amount: debtLoan.remainingAmount > 0 ? debtLoan.remainingAmount : undefined,
				date: todayString,
				paymentMethod: "Cash",
				notes: "",
			});
		}
	}, [isOpen, debtLoan, todayString, reset]);

	if (!debtLoan) return null;

	const handlePayFull = () => {
		setValue("amount", debtLoan.remainingAmount, { shouldValidate: true });
	};

	const onSubmit = async (data: FormValues) => {
		try {
			const res = await api.post(`/debts-loans/${debtLoan.id}/repay`, {
				amount: Number(data.amount),
				date: data.date,
				paymentMethod: data.paymentMethod,
				notes: data.notes || null,
			});

			if (res.success) {
				toast.success(`Recorded repayment of ${formatCurrency(Number(data.amount), currency)}`);
				onSuccess();
				onClose();
			} else {
				toast.error(res.message || "Failed to record repayment");
			}
		} catch {
			toast.error("An unexpected error occurred while saving repayment");
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isDebt ? "Repay Debt" : "Receive Loan Return"}
			description={
				isDebt
					? `Record money you are paying back to ${debtLoan.personName}. Automatically logs an Expense transaction.`
					: `Record money ${debtLoan.personName} is paying back to you. Automatically logs an Income transaction.`
			}
			maxWidth="md"
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{/* Current Balance Banner */}
				<div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between">
					<div>
						<div className="text-[11px] font-semibold text-slate-400">Remaining Balance</div>
						<div className="text-lg font-bold text-white">
							{formatCurrency(debtLoan.remainingAmount, currency)}
						</div>
					</div>

					<div className="text-right">
						<div className="text-[11px] text-slate-400">Total Principal</div>
						<div className="text-xs font-semibold text-slate-300">
							{formatCurrency(debtLoan.amount, currency)}
						</div>
					</div>
				</div>

				{/* Amount & Quick Button */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<Label htmlFor="repayAmount" className="text-xs text-slate-300">
							Repayment Amount
						</Label>
						<button
							type="button"
							onClick={handlePayFull}
							className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1"
						>
							<CheckCircle2 className="w-3 h-3" />
							<span>Pay Full Balance</span>
						</button>
					</div>

					<Input
						id="repayAmount"
						type="number"
						step="0.01"
						max={debtLoan.remainingAmount}
						placeholder="0.00"
						{...register("amount", { valueAsNumber: true })}
						className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 text-xs"
					/>
					{errors.amount && <p className="text-[11px] text-destructive">{errors.amount.message}</p>}
				</div>

				{/* Date & Payment Method */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="repayDate" className="text-xs text-slate-300">
							Date
						</Label>
						<Input
							id="repayDate"
							type="date"
							{...register("date")}
							className="bg-slate-900 border-slate-800 text-white text-xs"
						/>
						{errors.date && <p className="text-[11px] text-destructive">{errors.date.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs text-slate-300">Payment Channel</Label>
						<CustomSelect
							options={PAYMENT_METHODS}
							value={selectedPaymentMethod}
							onChange={(val) => setValue("paymentMethod", val)}
						/>
					</div>
				</div>

				{/* Notes / Reference */}
				<div className="space-y-1.5">
					<Label htmlFor="repayNotes" className="text-xs text-slate-300">
						Notes / Reference <span className="text-slate-500">(Optional)</span>
					</Label>
					<Input
						id="repayNotes"
						placeholder="e.g. Bank ref #1234, cash in hand, partial installment"
						{...register("notes")}
						className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 text-xs"
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
						className="min-w-[120px]"
					>
						{isSubmitting ? "Recording..." : "Save Repayment"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
