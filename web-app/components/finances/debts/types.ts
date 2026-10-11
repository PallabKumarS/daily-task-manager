export interface DebtLoanRepaymentItem {
	id: string;
	debtLoanId: string;
	amount: number;
	date: string;
	paymentMethod: string;
	notes?: string | null;
	transactionId?: string | null;
	createdAt: string;
}

export interface DebtLoanItem {
	id: string;
	userId: string;
	type: "DEBT" | "LOAN";
	personName: string;
	amount: number;
	paidAmount: number;
	remainingAmount: number;
	status: "ACTIVE" | "SETTLED";
	date: string;
	dueDate?: string | null;
	description?: string | null;
	initialTransactionId?: string | null;
	createdAt: string;
	updatedAt: string;
	repayments: DebtLoanRepaymentItem[];
}

export interface DebtLoanSummary {
	totalDebt: number;
	totalLoan: number;
	netBalance: number;
	activeDebtCount: number;
	activeLoanCount: number;
	settledCount: number;
	totalSettledAmount: number;
}
