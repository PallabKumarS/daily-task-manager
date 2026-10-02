"use client";

import * as React from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { RoutineFormModal } from "@/components/routines/routine-form-modal";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TransactionFormModal } from "@/components/finances/transaction-form-modal";
import { TrackerFormModal } from "@/components/trackers/tracker-form-modal";

export default function DashboardPage() {
  const [routineModalOpen, setRoutineModalOpen] = React.useState(false);
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = React.useState(false);
  const [trackerModalOpen, setTrackerModalOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  React.useEffect(() => {
    const onGlobalRefresh = () => handleRefresh();
    window.addEventListener("daypulse:refresh", onGlobalRefresh);
    return () => {
      window.removeEventListener("daypulse:refresh", onGlobalRefresh);
    };
  }, []);

  return (
    <>
      <DashboardView
        key={refreshKey}
        onOpenRoutineModal={() => setRoutineModalOpen(true)}
        onOpenTaskModal={() => setTaskModalOpen(true)}
        onOpenTransactionModal={() => setTransactionModalOpen(true)}
        onOpenTrackerModal={() => setTrackerModalOpen(true)}
      />

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
    </>
  );
}
