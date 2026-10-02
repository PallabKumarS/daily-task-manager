export interface ICreateTransaction {
  type: "EXPENSE" | "INCOME";
  amount: number;
  category: string;
  description?: string;
  paymentMethod?: string;
  date?: string;
}

export interface IUpdateTransaction {
  type?: "EXPENSE" | "INCOME";
  amount?: number;
  category?: string;
  description?: string | null;
  paymentMethod?: string;
  date?: string;
}
