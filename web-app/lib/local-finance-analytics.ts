export interface LocalAnalyticsResult {
	period: string;
	startDate: string;
	endDate: string;
	totalIncome: number;
	totalExpense: number;
	netBalance: number;
	savingsRate: number;
	todayCashflow: {
		net: number;
		income: number;
		expense: number;
	};
	timeline: Array<{
		label: string;
		income: number;
		expense: number;
		net: number;
		cumulativeBalance: number;
	}>;
	expenseCategories: Array<{
		category: string;
		amount: number;
		percentage: number;
	}>;
	incomeCategories: Array<{
		category: string;
		amount: number;
		percentage: number;
	}>;
}

export function calculateLocalFinanceAnalytics(
	finances: Array<Record<string, unknown>>,
	period = "month",
	baseDateInput?: string,
): LocalAnalyticsResult {
	const baseDate = baseDateInput ? new Date(baseDateInput) : new Date();
	let startDate: Date;
	let endDate: Date;

	if (period === "week") {
		const target = new Date(baseDate);
		const day = target.getDay();
		const diff = target.getDate() - day + (day === 0 ? -6 : 1);
		startDate = new Date(target.setDate(diff));
		startDate.setHours(0, 0, 0, 0);
		endDate = new Date(startDate);
		endDate.setDate(startDate.getDate() + 6);
		endDate.setHours(23, 59, 59, 999);
	} else if (period === "year") {
		const y = baseDate.getFullYear();
		startDate = new Date(y, 0, 1, 0, 0, 0, 0);
		endDate = new Date(y, 11, 31, 23, 59, 59, 999);
	} else {
		const y = baseDate.getFullYear();
		const m = baseDate.getMonth();
		startDate = new Date(y, m, 1, 0, 0, 0, 0);
		endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
	}

	const filtered = finances.filter((t) => {
		const txTime = new Date(String(t.date)).getTime();
		return txTime >= startDate.getTime() && txTime <= endDate.getTime();
	});

	let totalIncome = 0;
	let totalExpense = 0;
	const expenseCategories: Record<string, number> = {};
	const incomeCategories: Record<string, number> = {};

	for (const t of filtered) {
		const amt = Number(t.amount) || 0;
		const cat = String(t.category || "General");
		if (String(t.type).toUpperCase() === "INCOME") {
			totalIncome += amt;
			incomeCategories[cat] = (incomeCategories[cat] || 0) + amt;
		} else {
			totalExpense += amt;
			expenseCategories[cat] = (expenseCategories[cat] || 0) + amt;
		}
	}

	const netBalance = totalIncome - totalExpense;
	const savingsRate =
		totalIncome > 0 ? Math.max(0, Math.round((netBalance / totalIncome) * 100)) : 0;

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
		while (current <= endDate) {
			const y = current.getFullYear();
			const m = String(current.getMonth() + 1).padStart(2, "0");
			const d = String(current.getDate()).padStart(2, "0");
			dayMap[`${y}-${m}-${d}`] = { income: 0, expense: 0 };
			current.setDate(current.getDate() + 1);
		}

		for (const t of filtered) {
			const dObj = new Date(String(t.date));
			const y = dObj.getFullYear();
			const m = String(dObj.getMonth() + 1).padStart(2, "0");
			const d = String(dObj.getDate()).padStart(2, "0");
			const key = `${y}-${m}-${d}`;
			if (dayMap[key]) {
				const amt = Number(t.amount) || 0;
				if (String(t.type).toUpperCase() === "INCOME") {
					dayMap[key].income += amt;
				} else {
					dayMap[key].expense += amt;
				}
			}
		}

		for (const day of Object.keys(dayMap).sort()) {
			const { income, expense } = dayMap[day];
			const net = income - expense;
			runningCumulative += net;
			const dObj = new Date(`${day}T00:00:00`);
			const label =
				period === "week"
					? dObj.toLocaleDateString("en-US", { weekday: "short" })
					: `${dObj.getDate()} ${dObj.toLocaleDateString("en-US", { month: "short" })}`;
			timeline.push({
				label,
				income,
				expense,
				net,
				cumulativeBalance: runningCumulative,
			});
		}
	} else if (period === "year") {
		const monthNames = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		];
		const monthMap = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

		for (const t of filtered) {
			const dObj = new Date(String(t.date));
			const m = dObj.getMonth();
			if (m >= 0 && m < 12) {
				const amt = Number(t.amount) || 0;
				if (String(t.type).toUpperCase() === "INCOME") {
					monthMap[m].income += amt;
				} else {
					monthMap[m].expense += amt;
				}
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

	const today = new Date();
	const todayStart = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
		0,
		0,
		0,
		0,
	).getTime();
	const todayEnd = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
		23,
		59,
		59,
		999,
	).getTime();

	let todayIncome = 0;
	let todayExpense = 0;
	for (const t of finances) {
		const txTime = new Date(String(t.date)).getTime();
		if (txTime >= todayStart && txTime <= todayEnd) {
			const amt = Number(t.amount) || 0;
			if (String(t.type).toUpperCase() === "INCOME") {
				todayIncome += amt;
			} else {
				todayExpense += amt;
			}
		}
	}

	return {
		period,
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString(),
		totalIncome,
		totalExpense,
		netBalance,
		savingsRate,
		todayCashflow: {
			net: todayIncome - todayExpense,
			income: todayIncome,
			expense: todayExpense,
		},
		timeline,
		expenseCategories: expenseCategoryList,
		incomeCategories: incomeCategoryList,
	};
}
