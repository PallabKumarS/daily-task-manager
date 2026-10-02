export interface ICreateCategory {
  name: string;
  group: "EXPENSE" | "INCOME" | "PAYMENT_METHOD" | "TASK_CATEGORY";
  color?: string;
}
