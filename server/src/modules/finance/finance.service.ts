import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { broadcastSyncUpdate } from "../socket/socket.service.js";
import { ICreateTransaction, IUpdateTransaction } from "./finance.interface.js";

const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekRange = (date = new Date()): { start: Date; end: Date } => {
  const target = new Date(date);
  const day = target.getDay();
  const diff = target.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(target.setDate(diff));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getMonthRange = (year: number, month: number): { start: Date; end: Date } => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const getYearRange = (year: number): { start: Date; end: Date } => {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
};

export const getTransactionsFromDB = async (
  userId: string,
  filters: { type?: string; category?: string; startDate?: string; endDate?: string; limit?: number }
) => {
  const where: Record<string, unknown> = { userId };

  if (filters.type && ["EXPENSE", "INCOME"].includes(filters.type.toUpperCase())) {
    where.type = filters.type.toUpperCase();
  }

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.startDate || filters.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
    if (filters.endDate) dateFilter.lte = new Date(filters.endDate);
    where.date = dateFilter;
  }

  return prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    take: filters.limit || 50,
  });
};

export const createTransactionInDB = async (userId: string, payload: ICreateTransaction) => {
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: payload.type,
      amount: payload.amount,
      category: payload.category,
      description: payload.description || null,
      paymentMethod: payload.paymentMethod || "Cash",
      date: payload.date ? new Date(payload.date) : new Date(),
    },
  });

  broadcastSyncUpdate(userId, "transaction", "create", transaction);
  return transaction;
};

export const updateTransactionInDB = async (
  userId: string,
  id: string,
  payload: IUpdateTransaction
) => {
  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new AppError(404, "Transaction not found.");
  }

  const updateData: Record<string, unknown> = { ...payload };
  if (payload.date) {
    updateData.date = new Date(payload.date);
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: updateData,
  });

  broadcastSyncUpdate(userId, "transaction", "update", updated);
  return updated;
};

export const deleteTransactionFromDB = async (userId: string, id: string) => {
  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new AppError(404, "Transaction not found.");
  }

  await prisma.transaction.delete({ where: { id } });
  broadcastSyncUpdate(userId, "transaction", "delete", { id });
  return null;
};

export const getCumulativeAnalyticsFromDB = async (
  userId: string,
  period = "month",
  baseDate = new Date()
) => {
  let startDate: Date;
  let endDate: Date;

  if (period === "week") {
    const range = getWeekRange(baseDate);
    startDate = range.start;
    endDate = range.end;
  } else if (period === "year") {
    const range = getYearRange(baseDate.getFullYear());
    startDate = range.start;
    endDate = range.end;
  } else {
    const range = getMonthRange(baseDate.getFullYear(), baseDate.getMonth() + 1);
    startDate = range.start;
    endDate = range.end;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseCategories: Record<string, number> = {};
  const incomeCategories: Record<string, number> = {};

  for (const t of transactions) {
    if (t.type === "INCOME") {
      totalIncome += t.amount;
      incomeCategories[t.category] = (incomeCategories[t.category] || 0) + t.amount;
    } else {
      totalExpense += t.amount;
      expenseCategories[t.category] = (expenseCategories[t.category] || 0) + t.amount;
    }
  }

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netBalance / totalIncome) * 100)) : 0;

  const timeline: Array<{
    label: string;
    income: number;
    expense: number;
    net: number;
    cumulativeBalance: number;
  }> = [];

  let runningCumulative = 0;

  if (period === "week" || period === "month") {
    const dayMap: Record<string, { income: number; expense: number }> = {};
    const current = new Date(startDate);
    const endLimit = new Date(endDate);

    while (current <= endLimit) {
      const key = formatDateString(current);
      dayMap[key] = { income: 0, expense: 0 };
      current.setDate(current.getDate() + 1);
    }

    for (const t of transactions) {
      const key = formatDateString(t.date);
      if (dayMap[key]) {
        if (t.type === "INCOME") dayMap[key].income += t.amount;
        else dayMap[key].expense += t.amount;
      }
    }

    const sortedDays = Object.keys(dayMap).sort();
    for (const day of sortedDays) {
      const { income, expense } = dayMap[day];
      const net = income - expense;
      runningCumulative += net;
      const d = new Date(day);
      const label =
        period === "week"
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;

      timeline.push({
        label,
        income,
        expense,
        net,
        cumulativeBalance: runningCumulative,
      });
    }
  } else if (period === "year") {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthMap: Array<{ income: number; expense: number }> = Array.from({ length: 12 }, () => ({
      income: 0,
      expense: 0,
    }));

    for (const t of transactions) {
      const m = t.date.getMonth();
      if (t.type === "INCOME") monthMap[m].income += t.amount;
      else monthMap[m].expense += t.amount;
    }

    for (let i = 0; i < 12; i++) {
      const { income, expense } = monthMap[i];
      const net = income - expense;
      runningCumulative += net;
      timeline.push({
        label: monthNames[i],
        income,
        expense,
        net,
        cumulativeBalance: runningCumulative,
      });
    }
  }

  const expenseCategoryList = Object.entries(expenseCategories)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const incomeCategoryList = Object.entries(incomeCategories)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalIncome,
    totalExpense,
    netBalance,
    savingsRate,
    timeline,
    expenseCategories: expenseCategoryList,
    incomeCategories: incomeCategoryList,
  };
};
