import type { Metadata } from "next";
import type * as React from "react";
import { AppClientShell } from "@/components/layout/app-client-shell";

export const metadata: Metadata = {
	title: "DayPulse — Daily Routines, Tasks & Financial Ledger",
	description: "Personal daily agenda, habits, task tracking, and financial cashflow ledger.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return <AppClientShell>{children}</AppClientShell>;
}
