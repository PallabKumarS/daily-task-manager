export interface ISyncStatus {
  isConfigured: boolean;
  isConnected: boolean;
  configured?: boolean;
  connected?: boolean;
  email?: string | null;
  googleEmail?: string | null;
  lastSyncAt?: Date | string | null;
  lastGoogleSyncAt?: Date | string | null;
  driveFileId?: string | null;
}

export interface IConnectGooglePayload {
  code: string;
}

export interface IRestorePayload {
  fileId?: string;
}

export interface IDayPulseBackup {
  version: number;
  exportedAt: string;
  source: string;
  user: {
    id: string;
    email: string;
    name: string;
    currency: string;
  };
  data: {
    routines: Array<{
      id: string;
      title: string;
      description?: string | null;
      timeSlot: string;
      targetTime?: string | null;
      daysOfWeek: string;
      streakCount: number;
      lastCompletedDate?: string | null;
      reminderMinutes: number;
      createdAt: string;
      updatedAt: string;
    }>;
    routineLogs: Array<{
      id: string;
      routineId: string;
      date: string;
      completed: boolean;
      completedAt: string;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      description?: string | null;
      type: string;
      category: string;
      priority: string;
      status: string;
      startDate?: string | null;
      dueDate?: string | null;
      remindBeforeMinutes: number;
      reminderSent: boolean;
      completedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      category: string;
      description?: string | null;
      paymentMethod: string;
      date: string;
      createdAt: string;
      updatedAt: string;
    }>;
    dailyTrackers?: Array<{
      id: string;
      name: string;
      category: string;
      unitName: string;
      defaultTarget: number;
      unitPrice?: number | null;
      currency: string;
      description?: string | null;
      color?: string | null;
      isArchived: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    dailyTrackerLogs?: Array<{
      id: string;
      trackerId: string;
      date: string;
      value: number;
      status: string;
      unitPrice?: number | null;
      notes?: string | null;
      isSettled: boolean;
      settledAt?: string | null;
      settlementTransactionId?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}
