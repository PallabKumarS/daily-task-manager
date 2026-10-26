import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { TrackersSkeleton } from "@/components/trackers/trackers-skeleton";

export const metadata: Metadata = {
	title: "Daily Trackers — DayPulse",
	description:
		"Log daily variable meals, metered deliveries, and habits with monthly billing calculation and ledger settlement.",
};

const TrackersClient = dynamic(
	() => import("@/components/trackers/trackers-client").then((mod) => mod.TrackersClient),
	{
		loading: () => <TrackersSkeleton />,
		ssr: true,
	},
);

export default function TrackersPage() {
	return <TrackersClient />;
}
