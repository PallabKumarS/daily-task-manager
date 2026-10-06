"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { EXPENSE_CATEGORIES, formatCurrency } from "@/lib/currency-symbols";
import type { DailyTrackerItem } from "./tracker-types";

interface TrackerSettlementModalProps {
	isOpen: boolean;
	onClose: () => void;
	tracker: DailyTrackerItem | null;
	onSuccess: () => void;
}

const DEFAULT_PAYMENT_METHODS = [
	"Cash",
	"Mobile Banking",
	"Bank Transfer",
	"Debit / Credit Card",
	"Other",
];

export function TrackerSettlementModal({
	isOpen,
	onClose,
	tracker,
	onSuccess,
}: TrackerSettlementModalProps) {
	const [startDate, setStartDate] = React.useState<string>("");
	const [endDate, setEndDate] = React.useState<string>("");
	const [paymentMethod, setPaymentMethod] = React.useState<string>("Cash");
	const [category, setCategory] = React.useState<string>("Food & Dining");
	const [notes, setNotes] = React.useState<string>("");
	const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (tracker && isOpen) {
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, "0");
			const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

			const start = `${year}-${month}-01`;
			const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

			setStartDate(start);
			setEndDate(end);
			setCategory(tracker.category || "Food & Dining");
			setPaymentMethod("Cash");
			setNotes(
				`Settlement for ${tracker.name} (${tracker.monthStats.unsettledUnits} ${tracker.unitName})`,
			);
		}
	}, [tracker, isOpen]);

	if (!tracker) return null;

	const paymentOptions: SelectOption[] = DEFAULT_PAYMENT_METHODS.map((m) => ({
		label: m,
		value: m,
	}));

	const categoryOptions: SelectOption[] = EXPENSE_CATEGORIES.map((c) => ({
		label: c,
		value: c,
	}));

	const handleSettle = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!startDate || !endDate) {
			toast.error("Please specify both start and end dates");
			return;
		}

		try {
			setIsSubmitting(true);
			const res = await api.post<{
				totalAmount: number;
				totalUnits: number;
				settledLogsCount: number;
			}>(`/trackers/${tracker.id}/settle`, {
				startDate,
				endDate,
				paymentMethod,
				category,
				notes: notes.trim() || undefined,
			});

			if (res.success) {
				toast.success(
					`Settlement of ${formatCurrency(res.data.totalAmount, tracker.currency)} recorded to Finances!`,
				);
				window.dispatchEvent(new CustomEvent("daypulse:refresh"));
				onSuccess();
				onClose();
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to record settlement";
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const hasUnitPrice = typeof tracker.unitPrice === "number" && tracker.unitPrice > 0;
	const estimatedAmount = hasUnitPrice
		? tracker.monthStats.unsettledUnits * (tracker.unitPrice || 0)
		: 0;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Settle Bill & Record in Finances"
			description={`Record payment for ${tracker.name} into your DayPulse financial ledger.`}
			maxWidth="md"
		>
			<form onSubmit={handleSettle} className="space-y-4">
				{/* Payable Summary Card */}
				<div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-emerald-300">Unsettled Units:</span>
						<span className="text-sm font-bold text-white">
							{tracker.monthStats.unsettledUnits} {tracker.unitName}
						</span>
					</div>
					<div className="mt-1 flex items-center justify-between">
						<span className="text-xs font-medium text-emerald-300">Rate:</span>
						<span className="text-sm font-bold text-white">
							{formatCurrency(tracker.unitPrice || 0, tracker.currency)} / {tracker.unitName}
						</span>
					</div>
					<div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between">
						<span className="text-xs font-bold text-emerald-300">Total Payable Amount:</span>
						<span className="text-xl font-extrabold text-emerald-400">
							{formatCurrency(estimatedAmount, tracker.currency)}
						</span>
					</div>
				</div>

				{/* Date Range Selection */}
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="startDate">Period From</Label>
						<Input
							id="startDate"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="endDate">Period To</Label>
						<Input
							id="endDate"
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							required
						/>
					</div>
				</div>

				{/* Payment Method CustomSelect */}
				<CustomSelect
					label="Payment Method"
					value={paymentMethod}
					onChange={(val) => setPaymentMethod(val)}
					options={paymentOptions}
					group="PAYMENT_METHOD"
					placeholder="Select payment method"
				/>

				{/* Ledger Expense Category CustomSelect */}
				<CustomSelect
					label="Financial Expense Category"
					value={category}
					onChange={(val) => setCategory(val)}
					options={categoryOptions}
					group="EXPENSE"
					placeholder="Select category for ledger"
				/>

				{/* Notes / Description */}
				<div className="space-y-1.5">
					<Label htmlFor="settleNotes">Ledger Note / Description</Label>
					<Input
						id="settleNotes"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="e.g. Settlement for October Meals"
					/>
				</div>

				{/* Actions */}
				<div className="pt-2 flex items-center justify-end gap-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={isSubmitting || tracker.monthStats.unsettledUnits <= 0}
						className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
					>
						{isSubmitting ? "Recording..." : "Confirm & Settle"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
