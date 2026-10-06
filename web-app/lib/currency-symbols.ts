export interface CurrencyOption {
	code: string;
	symbol: string;
	name: string;
}

export const CURRENCIES: CurrencyOption[] = [
	{ code: "USD", symbol: "$", name: "US Dollar ($)" },
	{ code: "EUR", symbol: "€", name: "Euro (€)" },
	{ code: "GBP", symbol: "£", name: "British Pound (£)" },
	{ code: "BDT", symbol: "৳", name: "Bangladeshi Taka (৳)" },
	{ code: "INR", symbol: "₹", name: "Indian Rupee (₹)" },
	{ code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
	{ code: "AUD", symbol: "AU$", name: "Australian Dollar" },
	{ code: "JPY", symbol: "¥", name: "Japanese Yen (¥)" },
];

export function getCurrencySymbol(code: string): string {
	const match = CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
	return match ? match.symbol : code;
}

export function formatCurrency(amount: number, currencyCode = "USD"): string {
	const symbol = getCurrencySymbol(currencyCode);
	return `${symbol}${amount.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

export const EXPENSE_CATEGORIES = [
	"Food & Dining",
	"Transport & Fuel",
	"Housing & Bills",
	"Shopping & Goods",
	"Entertainment & Leisure",
	"Health & Medical",
	"Education & Self-Improvement",
	"Family & Personal",
	"Debt & Loans",
	"Other Expense",
] as const;

export const INCOME_CATEGORIES = [
	"Salary & Wages",
	"Freelance & Consulting",
	"Business Revenue",
	"Investments & Dividends",
	"Gifts & Grants",
	"Rental Income",
	"Other Income",
] as const;

export const TASK_CATEGORIES = [
	"General",
	"Work & Career",
	"Study & Learning",
	"Health & Fitness",
	"Personal & Home",
	"Finance & Admin",
	"Social & Events",
] as const;
