import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { TasksSkeleton } from "@/components/tasks/tasks-skeleton";

export const metadata: Metadata = {
	title: "Tasks & Alarms — DayPulse",
	description:
		"Configure daily or one-time alarms with multi-ring chimes, frequency intervals, and advance notifications.",
};

const TasksClient = dynamic(
	() => import("@/components/tasks/tasks-client").then((mod) => mod.TasksClient),
	{
		loading: () => <TasksSkeleton />,
		ssr: true,
	},
);

export default function TasksPage() {
	return <TasksClient />;
}
