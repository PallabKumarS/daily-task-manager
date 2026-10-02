export interface ICreateRoutine {
  title: string;
  description?: string;
  timeSlot?: "morning" | "afternoon" | "evening" | "night" | "anytime";
  targetTime?: string;
  daysOfWeek?: string;
  reminderMinutes?: number;
}

export interface IUpdateRoutine {
  title?: string;
  description?: string | null;
  timeSlot?: "morning" | "afternoon" | "evening" | "night" | "anytime";
  targetTime?: string | null;
  daysOfWeek?: string;
  reminderMinutes?: number;
}
