export interface ICreateTask {
	title: string;
	description?: string | null;
	type?: "TASK" | "EVENT";
	category?: string;
	priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
	startDate?: string | null;
	dueDate?: string | null;
	remindBeforeMinutes?: number;

	isRecurring?: boolean;
	repeatFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
	repeatInterval?: number;
	repeatDaysOfWeek?: string | null;
	repeatTime?: string | null;
	repeatDayOfMonth?: number | null;
	repeatMonthOfYear?: number | null;
	repeatEndType?: "NEVER" | "COUNT" | "UNTIL_DATE" | null;
	repeatCount?: number | null;
	repeatUntil?: string | null;
	lastCompletedDate?: string | null;
}

export interface IUpdateTask extends Partial<ICreateTask> {
	completedOccurrences?: number;
	lastTriggeredDate?: string | null;
	lastCompletedDate?: string | null;
}
