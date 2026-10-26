import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export const metadata: Metadata = {
	title: "Dashboard — DayPulse",
	description: "Today's real-time pulse across daily habits, agenda, tasks, and cashflow.",
};

const DashboardClient = dynamic(
	() => import("@/components/dashboard/dashboard-client").then((mod) => mod.DashboardClient),
	{
		loading: () => <DashboardSkeleton />,
		ssr: true,
	},
);

export default function DashboardPage() {
	return <DashboardClient />;
}
