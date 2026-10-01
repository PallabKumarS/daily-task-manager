import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { getMonthRange, getWeekRange, getYearRange, formatDateString } from "@/lib/date-helpers";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Unauthorized",
      });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month"; // week, month, year, all
    const baseDateStr = searchParams.get("date");
    const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();

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
    } else if (period === "all") {
      startDate = new Date(2000, 0, 1);
      endDate = new Date(2100, 11, 31);
    } else {
      // Month
      const range = getMonthRange(baseDate.getFullYear(), baseDate.getMonth() + 1);
      startDate = range.start;
      endDate = range.end;
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: auth.userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
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

    // Build timeline progression based on period
    const timeline: {
      label: string;
      income: number;
      expense: number;
      net: number;
      cumulativeBalance: number;
    }[] = [];

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
          if (t.type === "INCOME") {
            dayMap[key].income += t.amount;
          } else {
            dayMap[key].expense += t.amount;
          }
        }
      }

      const sortedDays = Object.keys(dayMap).sort();
      for (const day of sortedDays) {
        const { income, expense } = dayMap[day];
        const net = income - expense;
        runningCumulative += net;
        const d = new Date(day);
        const label = period === "week"
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
      const monthMap: { income: number; expense: number }[] = Array.from({ length: 12 }, () => ({
        income: 0,
        expense: 0,
      }));

      for (const t of transactions) {
        const m = t.date.getMonth();
        if (t.type === "INCOME") {
          monthMap[m].income += t.amount;
        } else {
          monthMap[m].expense += t.amount;
        }
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

    const expenseCategoryList = Object.entries(expenseCategories).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    const incomeCategoryList = Object.entries(incomeCategories).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
