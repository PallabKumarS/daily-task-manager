"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { TransactionFormModal } from "@/components/finances/transaction-form-modal";
import { AppNavbar } from "@/components/layout/app-navbar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomDock } from "@/components/layout/bottom-dock";
import { useAuth } from "@/components/providers/auth-provider";
import { RoutineFormModal } from "@/components/routines/routine-form-modal";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TrackerFormModal } from "@/components/trackers/tracker-form-modal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth();
	const router = useRouter();

	const [routineModalOpen, setRoutineModalOpen] = React.useState(false);
	const [taskModalOpen, setTaskModalOpen] = React.useState(false);
	const [transactionModalOpen, setTransactionModalOpen] = React.useState(false);
	const [trackerModalOpen, setTrackerModalOpen] = React.useState(false);

	React.useEffect(() => {
		if (!loading && !user) {
			router.push("/login");
		}
	}, [user, loading, router]);

	const handleQuickAdd = (type: "routine" | "task" | "transaction" | "tracker") => {
		if (type === "routine") setRoutineModalOpen(true);
		if (type === "task") setTaskModalOpen(true);
		if (type === "transaction") setTransactionModalOpen(true);
		if (type === "tracker") setTrackerModalOpen(true);
	};

	const handleRefresh = () => {
		// Dispatches refresh event so active views can update
		window.dispatchEvent(new CustomEvent("daypulse:refresh"));
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
					<p className="text-xs">Connecting to DayPulse...</p>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
					<p className="text-xs">Authenticating workspace...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-row bg-background text-foreground">
			<AppSidebar />

			<div className="flex-1 flex flex-col min-w-0">
				<AppNavbar onQuickAdd={handleQuickAdd} />

				<main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
					{children}
				</main>

				<BottomDock />
			</div>

			{/* Global Quick Add Modals */}
			<RoutineFormModal
				isOpen={routineModalOpen}
				onClose={() => setRoutineModalOpen(false)}
				onSuccess={handleRefresh}
			/>
			<TaskFormModal
				isOpen={taskModalOpen}
				onClose={() => setTaskModalOpen(false)}
				onSuccess={handleRefresh}
			/>
			<TransactionFormModal
				isOpen={transactionModalOpen}
				onClose={() => setTransactionModalOpen(false)}
				onSuccess={handleRefresh}
			/>
			<TrackerFormModal
				isOpen={trackerModalOpen}
				onClose={() => setTrackerModalOpen(false)}
				onSuccess={handleRefresh}
			/>
		</div>
	);
}
