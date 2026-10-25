import type { DebtLoan, DebtLoanRepayment, PrismaClient } from "@prisma/client";
import type { IpcApiResponse } from "./ipc-dispatcher.js";

type RequestBody = Record<string, unknown>;

const serializeRepayment = (r: DebtLoanRepayment) => ({
	...r,
	date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
	createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
	updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
});

const serializeDebtLoan = (d: DebtLoan & { repayments?: DebtLoanRepayment[] }) => {
	const repayments = d.repayments ? d.repayments.map(serializeRepayment) : [];
	const remainingAmount = Math.max(0, Number((d.amount - d.paidAmount).toFixed(2)));

	return {
		...d,
		remainingAmount,
		date: d.date instanceof Date ? d.date.toISOString() : String(d.date),
		dueDate: d.dueDate
			? d.dueDate instanceof Date
				? d.dueDate.toISOString()
				: String(d.dueDate)
			: null,
		createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
		updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt),
		repayments,
	};
};

const fail = (statusCode: number, message: string): IpcApiResponse => ({
	statusCode,
	success: false,
	message,
	data: null,
});

export async function handleDebtLoanRoute(
	prisma: PrismaClient,
	userId: string,
	method: string,
	pathname: string,
	query: Record<string, string>,
	body: RequestBody,
): Promise<IpcApiResponse | null> {
	if (!userId) {
		return fail(401, "Not authenticated");
	}

	if (pathname === "/debts-loans" && method === "GET") {
		return handleGetDebtsLoans(prisma, userId, query);
	}

	if (pathname === "/debts-loans" && method === "POST") {
		return handleCreateDebtLoan(prisma, userId, body);
	}

	const repayMatch = pathname.match(/^\/debts-loans\/([^/]+)\/repay$/);
	if (repayMatch && method === "POST") {
		return handleRecordRepayment(prisma, userId, repayMatch[1], body);
	}

	const repaymentDeleteMatch = pathname.match(/^\/debts-loans\/([^/]+)\/repayments\/([^/]+)$/);
	if (repaymentDeleteMatch && method === "DELETE") {
		return handleDeleteRepayment(prisma, userId, repaymentDeleteMatch[1], repaymentDeleteMatch[2]);
	}

	const singleMatch = pathname.match(/^\/debts-loans\/([^/]+)$/);
	if (singleMatch) {
		const debtLoanId = singleMatch[1];
		if (method === "GET") {
			return handleGetSingleDebtLoan(prisma, userId, debtLoanId);
		}
		if (method === "PATCH") {
			return handleUpdateDebtLoan(prisma, userId, debtLoanId, body);
		}
		if (method === "DELETE") {
			return handleDeleteDebtLoan(prisma, userId, debtLoanId);
		}
	}

	return null;
}

async function handleGetDebtsLoans(
	prisma: PrismaClient,
	userId: string,
	query: Record<string, string>,
): Promise<IpcApiResponse> {
	const typeFilter = query.type ? query.type.toUpperCase() : "ALL";
	const statusFilter = query.status ? query.status.toUpperCase() : "ALL";
	const search = (query.search || "").trim().toLowerCase();

	const where: Record<string, unknown> = { userId };
	if (typeFilter === "DEBT" || typeFilter === "LOAN") {
		where.type = typeFilter;
	}
	if (statusFilter === "ACTIVE" || statusFilter === "SETTLED") {
		where.status = statusFilter;
	}

	const allRecords = await prisma.debtLoan.findMany({
		where: { userId },
		include: {
			repayments: {
				orderBy: { date: "desc" },
			},
		},
		orderBy: { date: "desc" },
	});

	let totalDebt = 0;
	let totalLoan = 0;
	let activeDebtCount = 0;
	let activeLoanCount = 0;
	let settledCount = 0;
	let totalSettledAmount = 0;

	for (const item of allRecords) {
		const remaining = Math.max(0, item.amount - item.paidAmount);
		if (item.status === "SETTLED") {
			settledCount += 1;
			totalSettledAmount += item.amount;
		} else if (item.type === "DEBT") {
			activeDebtCount += 1;
			totalDebt += remaining;
		} else if (item.type === "LOAN") {
			activeLoanCount += 1;
			totalLoan += remaining;
		}
	}

	const filtered = allRecords.filter((item) => {
		if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
		if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
		if (search) {
			const nameMatch = item.personName.toLowerCase().includes(search);
			const descMatch = (item.description || "").toLowerCase().includes(search);
			if (!nameMatch && !descMatch) return false;
		}
		return true;
	});

	return {
		statusCode: 200,
		success: true,
		data: {
			debtsLoans: filtered.map(serializeDebtLoan),
			summary: {
				totalDebt: Number(totalDebt.toFixed(2)),
				totalLoan: Number(totalLoan.toFixed(2)),
				netBalance: Number((totalLoan - totalDebt).toFixed(2)),
				activeDebtCount,
				activeLoanCount,
				settledCount,
				totalSettledAmount: Number(totalSettledAmount.toFixed(2)),
			},
		},
	};
}

async function handleGetSingleDebtLoan(
	prisma: PrismaClient,
	userId: string,
	debtLoanId: string,
): Promise<IpcApiResponse> {
	const item = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
		include: {
			repayments: {
				orderBy: { date: "desc" },
			},
		},
	});

	if (!item) {
		return fail(404, "Debt or loan record not found");
	}

	return {
		statusCode: 200,
		success: true,
		data: serializeDebtLoan(item),
	};
}

async function handleCreateDebtLoan(
	prisma: PrismaClient,
	userId: string,
	body: RequestBody,
): Promise<IpcApiResponse> {
	const rawType = String(body.type || "DEBT").toUpperCase();
	const type = rawType === "LOAN" ? "LOAN" : "DEBT";
	const personName = String(body.personName || "").trim();
	const amount = Number(body.amount);
	const description = typeof body.description === "string" ? body.description.trim() : null;
	const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "Cash";
	const txDate = body.date ? new Date(String(body.date)) : new Date();
	const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;

	if (!personName) {
		return fail(400, "Person name is required");
	}
	if (!amount || amount <= 0 || Number.isNaN(amount)) {
		return fail(400, "Amount must be a positive number");
	}

	const isDebt = type === "DEBT";
	const txType = isDebt ? "INCOME" : "EXPENSE";
	const txCategory = isDebt ? "Debt / Borrowed" : "Loan Given";
	const txDesc = isDebt
		? `Borrowed from ${personName}${description ? ` - ${description}` : ""}`
		: `Loan to ${personName}${description ? ` - ${description}` : ""}`;

	const recordTransaction = body.recordTransaction !== false;
	let initialTransactionId: string | null = null;

	if (recordTransaction) {
		const transaction = await prisma.transaction.create({
			data: {
				userId,
				type: txType,
				amount,
				category: txCategory,
				description: txDesc,
				paymentMethod,
				date: txDate,
			},
		});
		initialTransactionId = transaction.id;
	}

	const debtLoan = await prisma.debtLoan.create({
		data: {
			userId,
			type,
			personName,
			amount,
			paidAmount: 0,
			status: "ACTIVE",
			date: txDate,
			dueDate,
			description,
			initialTransactionId,
		},
		include: {
			repayments: true,
		},
	});

	return {
		statusCode: 201,
		success: true,
		message: `${isDebt ? "Debt" : "Loan"} recorded successfully`,
		data: serializeDebtLoan(debtLoan),
	};
}

async function handleRecordRepayment(
	prisma: PrismaClient,
	userId: string,
	debtLoanId: string,
	body: RequestBody,
): Promise<IpcApiResponse> {
	const debtLoan = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
	});

	if (!debtLoan) {
		return fail(404, "Debt or loan record not found");
	}

	const inputAmount = Number(body.amount);
	if (!inputAmount || inputAmount <= 0 || Number.isNaN(inputAmount)) {
		return fail(400, "Repayment amount must be greater than zero");
	}

	const remaining = Math.max(0, debtLoan.amount - debtLoan.paidAmount);
	const repayAmount = Number(Math.min(inputAmount, remaining).toFixed(2));
	if (repayAmount <= 0) {
		return fail(400, "Debt or loan is already completely settled");
	}

	const notes = typeof body.notes === "string" ? body.notes.trim() : null;
	const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "Cash";
	const repayDate = body.date ? new Date(String(body.date)) : new Date();

	const isDebt = debtLoan.type === "DEBT";
	const txType = isDebt ? "EXPENSE" : "INCOME";
	const txCategory = isDebt ? "Debt Repayment" : "Loan Return";
	const txDesc = isDebt
		? `Debt repayment to ${debtLoan.personName}${notes ? ` - ${notes}` : ""}`
		: `Loan return from ${debtLoan.personName}${notes ? ` - ${notes}` : ""}`;

	const recordTransaction = body.recordTransaction !== false;
	let transactionId: string | null = null;

	if (recordTransaction) {
		const tx = await prisma.transaction.create({
			data: {
				userId,
				type: txType,
				amount: repayAmount,
				category: txCategory,
				description: txDesc,
				paymentMethod,
				date: repayDate,
			},
		});
		transactionId = tx.id;
	}

	const repayment = await prisma.debtLoanRepayment.create({
		data: {
			debtLoanId,
			userId,
			amount: repayAmount,
			date: repayDate,
			paymentMethod,
			notes,
			transactionId,
		},
	});

	const newPaidAmount = Number((debtLoan.paidAmount + repayAmount).toFixed(2));
	const isSettled = newPaidAmount >= debtLoan.amount;

	const updated = await prisma.debtLoan.update({
		where: { id: debtLoanId },
		data: {
			paidAmount: newPaidAmount,
			status: isSettled ? "SETTLED" : "ACTIVE",
		},
		include: {
			repayments: {
				orderBy: { date: "desc" },
			},
		},
	});

	return {
		statusCode: 201,
		success: true,
		message: `Repayment of ${repayAmount} recorded successfully`,
		data: {
			debtLoan: serializeDebtLoan(updated),
			repayment: serializeRepayment(repayment),
		},
	};
}

async function handleUpdateDebtLoan(
	prisma: PrismaClient,
	userId: string,
	debtLoanId: string,
	body: RequestBody,
): Promise<IpcApiResponse> {
	const existing = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
	});

	if (!existing) {
		return fail(404, "Debt or loan record not found");
	}

	const updateData: Record<string, unknown> = {};
	if (typeof body.personName === "string" && body.personName.trim()) {
		updateData.personName = body.personName.trim();
	}
	if (body.description !== undefined) {
		updateData.description = typeof body.description === "string" ? body.description.trim() : null;
	}
	if (body.dueDate !== undefined) {
		updateData.dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
	}
	if (body.date) {
		updateData.date = new Date(String(body.date));
	}
	if (body.status === "ACTIVE" || body.status === "SETTLED") {
		updateData.status = body.status;
	}

	const updated = await prisma.debtLoan.update({
		where: { id: debtLoanId },
		data: updateData,
		include: {
			repayments: {
				orderBy: { date: "desc" },
			},
		},
	});

	if (existing.initialTransactionId && (body.personName || body.description !== undefined)) {
		const nextName = (updateData.personName as string) || existing.personName;
		const nextDesc = (updateData.description as string | null) ?? existing.description;
		const isDebt = existing.type === "DEBT";
		const newTxDesc = isDebt
			? `Borrowed from ${nextName}${nextDesc ? ` - ${nextDesc}` : ""}`
			: `Loan to ${nextName}${nextDesc ? ` - ${nextDesc}` : ""}`;

		try {
			await prisma.transaction.update({
				where: { id: existing.initialTransactionId },
				data: { description: newTxDesc },
			});
		} catch {
			// Ignore if initial transaction was manually deleted
		}
	}

	return {
		statusCode: 200,
		success: true,
		message: "Record updated",
		data: serializeDebtLoan(updated),
	};
}

async function handleDeleteDebtLoan(
	prisma: PrismaClient,
	userId: string,
	debtLoanId: string,
): Promise<IpcApiResponse> {
	const existing = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
		include: { repayments: true },
	});

	if (!existing) {
		return fail(404, "Debt or loan record not found");
	}

	const txIds: string[] = [];
	if (existing.initialTransactionId) {
		txIds.push(existing.initialTransactionId);
	}
	for (const rep of existing.repayments) {
		if (rep.transactionId) {
			txIds.push(rep.transactionId);
		}
	}

	if (txIds.length > 0) {
		await prisma.transaction.deleteMany({
			where: { id: { in: txIds }, userId },
		});
	}

	await prisma.debtLoanRepayment.deleteMany({
		where: { debtLoanId },
	});

	await prisma.debtLoan.delete({
		where: { id: debtLoanId },
	});

	return {
		statusCode: 200,
		success: true,
		message: "Debt or loan and linked transactions deleted",
		data: null,
	};
}

async function handleDeleteRepayment(
	prisma: PrismaClient,
	userId: string,
	debtLoanId: string,
	repaymentId: string,
): Promise<IpcApiResponse> {
	const repayment = await prisma.debtLoanRepayment.findFirst({
		where: { id: repaymentId, debtLoanId, userId },
	});

	if (!repayment) {
		return fail(404, "Repayment record not found");
	}

	const debtLoan = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
	});

	if (repayment.transactionId) {
		try {
			await prisma.transaction.delete({
				where: { id: repayment.transactionId },
			});
		} catch {
			// Ignore if transaction was already removed
		}
	}

	await prisma.debtLoanRepayment.delete({
		where: { id: repaymentId },
	});

	if (debtLoan) {
		const newPaidAmount = Math.max(0, Number((debtLoan.paidAmount - repayment.amount).toFixed(2)));
		await prisma.debtLoan.update({
			where: { id: debtLoanId },
			data: {
				paidAmount: newPaidAmount,
				status: newPaidAmount >= debtLoan.amount ? "SETTLED" : "ACTIVE",
			},
		});
	}

	return {
		statusCode: 200,
		success: true,
		message: "Repayment reversed",
		data: null,
	};
}
