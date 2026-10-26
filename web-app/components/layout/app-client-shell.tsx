"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { TransactionFormModal } from "@/components/finances/transaction-form-modal";
import { AppNavbar } from "@/components/layout/app-navbar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomDock } from "@/components/layout/bottom-dock";
import { ContextDockProvider, MobileContextDock } from "@/components/layout/context-dock";
import { CustomizeNavModal } from "@/components/layout/customize-nav-modal";
import { FloatingQuickAction } from "@/components/layout/floating-quick-action";
import { useAuth } from "@/components/providers/auth-provider";
import { NavTabsProvider, useNavTabs } from "@/components/providers/nav-tabs-provider";
import { RoutineFormModal } from "@/components/routines/routine-form-modal";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TrackerFormModal } from "@/components/trackers/tracker-form-modal";

function GlobalCustomizeNavModal() {
	const { isCustomizeOpen, setCustomizeOpen } = useNavTabs();
	return <CustomizeNavModal isOpen={isCustomizeOpen} onClose={() => setCustomizeOpen(false)} />;
}

interface AppClientShellProps {
	children: React.ReactNode;
}

export function AppClientShell({ children }: AppClientShellProps) {
	const { user, loading } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	const [routineModalOpen, setRoutineModalOpen] = React.useState(false);
	const [taskModalOpen, setTaskModalOpen] = React.useState(false);
	const [taskModalType, setTaskModalType] = React.useState<"TASK" | "EVENT">("TASK");
	const [transactionModalOpen, setTransactionModalOpen] = React.useState(false);
	const [trackerModalOpen, setTrackerModalOpen] = React.useState(false);

	React.useEffect(() => {
		if (!loading && !user) {
			router.push("/login");
		}
	}, [user, loading, router]);

	const handleQuickAdd = (type: "routine" | "task" | "transaction" | "tracker" | "alarm") => {
		if (type === "routine") setRoutineModalOpen(true);
		if (type === "alarm") {
			setTaskModalType("EVENT");
			setTaskModalOpen(true);
		}
		if (type === "task") {
			setTaskModalType("TASK");
			setTaskModalOpen(true);
		}
		if (type === "transaction") setTransactionModalOpen(true);
		if (type === "tracker") setTrackerModalOpen(true);
	};

	const handleRefresh = () => {
		window.dispatchEvent(new CustomEvent("daypulse:refresh"));
	};

	if (loading || !user) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
					<p className="text-xs font-medium">
						{loading ? "Connecting to DayPulse..." : "Authenticating workspace..."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<NavTabsProvider>
			<ContextDockProvider>
				<div className="min-h-[calc(100vh-var(--titlebar-height,0px))] flex flex-row bg-background text-foreground">
					<AppSidebar />

					<div className="flex-1 flex flex-col min-w-0">
						<AppNavbar />

						<motion.main
							key={pathname}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
							className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto pb-36 md:pb-12"
						>
							{children}
						</motion.main>

						<MobileContextDock onQuickAdd={handleQuickAdd} onRefresh={handleRefresh} />
						<BottomDock />
						<FloatingQuickAction onQuickAdd={handleQuickAdd} />
					</div>

					<RoutineFormModal
						isOpen={routineModalOpen}
						onClose={() => setRoutineModalOpen(false)}
						onSuccess={handleRefresh}
					/>
					<TaskFormModal
						isOpen={taskModalOpen}
						onClose={() => setTaskModalOpen(false)}
						onSuccess={handleRefresh}
						defaultType={taskModalType}
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
					<GlobalCustomizeNavModal />
				</div>
			</ContextDockProvider>
		</NavTabsProvider>
	);
}
