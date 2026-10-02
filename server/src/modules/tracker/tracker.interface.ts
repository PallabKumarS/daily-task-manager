export interface ICreateTracker {
	name: string;
	category?: string;
	unitName?: string;
	defaultTarget?: number;
	unitPrice?: number | null;
	currency?: string;
	description?: string | null;
	color?: string;
}

export interface IUpdateTracker {
	name?: string;
	category?: string;
	unitName?: string;
	defaultTarget?: number;
	unitPrice?: number | null;
	currency?: string;
	description?: string | null;
	color?: string;
	isArchived?: boolean;
}

export interface ILogDailyTracker {
	date: string;
	value: number;
	status?: "LOGGED" | "CANCELLED" | "SKIPPED";
	notes?: string | null;
	unitPrice?: number | null;
}

export interface ISettleTracker {
	startDate: string;
	endDate: string;
	paymentMethod?: string;
	category?: string;
	notes?: string | null;
}
