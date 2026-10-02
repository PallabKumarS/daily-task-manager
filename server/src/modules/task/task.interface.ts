export interface ICreateTask {
  title: string;
  description?: string;
  type?: "TASK" | "EVENT";
  category?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  startDate?: string | null;
  dueDate?: string | null;
  remindBeforeMinutes?: number;
}

export interface IUpdateTask {
  title?: string;
  description?: string | null;
  type?: "TASK" | "EVENT";
  category?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  startDate?: string | null;
  dueDate?: string | null;
  remindBeforeMinutes?: number;
}
