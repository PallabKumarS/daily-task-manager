"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCurrencySymbol } from "@/lib/currency-symbols";
import { useAuth } from "@/components/providers/auth-provider";

const formSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive("Amount must be greater than zero"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  paymentMethod: z.string().min(1),
  date: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

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

  React.useEffect(() => {
    if (initialData) {
      const d = new Date(initialData.date);
      const dateStr = !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      reset({
        type: initialData.type,
        amount: initialData.amount,
        category: initialData.category,
        description: initialData.description || "",
        paymentMethod: initialData.paymentMethod || "Cash",
        date: dateStr,
      });
    } else {
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
    setValue("category", type === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const url = initialData ? `/api/finances/${initialData.id}` : "/api/finances";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || `${data.type === "INCOME" ? "Income" : "Expense"} recorded`);
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to record transaction");
      }
    } catch {
      toast.error("Network error while recording transaction");
    }
  };

  const categories = currentType === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Transaction" : currentType === "EXPENSE" ? "Log Daily Spending" : "Log Income / Earning"}
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
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount ({currencySymbol})</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">
                {currencySymbol}
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pl-8"
                {...register("amount", { valueAsNumber: true })}
              />
            </div>
            {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              {...register("category")}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <select
              id="paymentMethod"
              {...register("paymentMethod")}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Debit / Credit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Mobile Banking">Mobile Banking (bKash/Nagad/UPI)</option>
              <option value="Crypto">Crypto</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description / Notes</Label>
          <Input id="description" placeholder="e.g. Grocery shopping, Client invoice, Coffee" {...register("description")} />
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
            {isSubmitting ? "Recording..." : initialData ? "Save Changes" : `Record ${currentType === "EXPENSE" ? "Expense" : "Income"}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
