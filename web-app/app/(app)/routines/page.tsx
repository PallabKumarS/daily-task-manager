import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { RoutinesSkeleton } from "@/components/routines/routines-skeleton";

export const metadata: Metadata = {
	title: "Daily Routines — DayPulse",
	description:
		"Lock in morning, afternoon, and evening habit loops. Track streaks and get proactive alerts.",
};

const RoutinesClient = dynamic(
	() => import("@/components/routines/routines-client").then((mod) => mod.RoutinesClient),
	{
		loading: () => <RoutinesSkeleton />,
		ssr: true,
	},
);

export default function RoutinesPage() {
	return <RoutinesClient />;
}
