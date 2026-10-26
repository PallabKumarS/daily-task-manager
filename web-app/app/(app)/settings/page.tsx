import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SettingsSkeleton } from "@/components/settings/settings-skeleton";

export const metadata: Metadata = {
	title: "Settings & System Preferences — DayPulse",
	description: "Customize appearance, active modules, cloud synchronization, and backup archives.",
};

const SettingsClient = dynamic(
	() => import("@/components/settings/settings-client").then((mod) => mod.SettingsClient),
	{
		loading: () => <SettingsSkeleton />,
		ssr: true,
	},
);

export default function SettingsPage() {
	return <SettingsClient />;
}
