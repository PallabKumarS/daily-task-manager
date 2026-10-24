export type DebtLoanType = "DEBT" | "LOAN";
export type DebtLoanStatus = "ACTIVE" | "SETTLED";

export interface ICreateDebtLoan {
	type: DebtLoanType;
	personName: string;
	amount: number;
	date?: string;
	dueDate?: string | null;
	description?: string | null;
	paymentMethod?: string;
	recordTransaction?: boolean;
}

export interface IUpdateDebtLoan {
	personName?: string;
	description?: string | null;
	dueDate?: string | null;
	date?: string;
	status?: DebtLoanStatus;
}

export interface IRecordRepayment {
	amount: number;
	date?: string;
	paymentMethod?: string;
	notes?: string | null;
	recordTransaction?: boolean;
}
