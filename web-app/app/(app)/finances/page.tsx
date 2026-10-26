import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { FinancesSkeleton } from "@/components/finances/finances-skeleton";

export const metadata: Metadata = {
	title: "Money & Ledger — DayPulse",
	description:
		"Itemized ledger entries with tabbed timeframes, debts and loans management, and 1-click repetition.",
};

const FinancesClient = dynamic(
	() => import("@/components/finances/finances-client").then((mod) => mod.FinancesClient),
	{
		loading: () => <FinancesSkeleton />,
		ssr: true,
	},
);

export default function FinancesPage() {
	return <FinancesClient />;
}
