import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../utils/prisma.js";
import { broadcastSyncUpdate } from "../socket/socket.service.js";
import type { ICreateDebtLoan, IRecordRepayment, IUpdateDebtLoan } from "./debt-loan.interface.js";

export const getDebtsLoansFromDB = async (
	userId: string,
	query: { type?: string; status?: string; search?: string },
) => {
	const typeFilter = query.type ? query.type.toUpperCase() : "ALL";
	const statusFilter = query.status ? query.status.toUpperCase() : "ALL";
	const search = (query.search || "").trim().toLowerCase();

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
		debtsLoans: filtered.map((d) => ({
			...d,
			remainingAmount: Math.max(0, Number((d.amount - d.paidAmount).toFixed(2))),
		})),
		summary: {
			totalDebt: Number(totalDebt.toFixed(2)),
			totalLoan: Number(totalLoan.toFixed(2)),
			netBalance: Number((totalLoan - totalDebt).toFixed(2)),
			activeDebtCount,
			activeLoanCount,
			settledCount,
			totalSettledAmount: Number(totalSettledAmount.toFixed(2)),
		},
	};
};

export const getDebtLoanDetailsFromDB = async (userId: string, debtLoanId: string) => {
	const item = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
		include: {
			repayments: {
				orderBy: { date: "desc" },
			},
		},
	});

	if (!item) {
		throw new AppError(404, "Debt or loan record not found");
	}

	return {
		...item,
		remainingAmount: Math.max(0, Number((item.amount - item.paidAmount).toFixed(2))),
	};
};

export const createDebtLoanInDB = async (userId: string, payload: ICreateDebtLoan) => {
	const isDebt = payload.type === "DEBT";
	const txType = isDebt ? "INCOME" : "EXPENSE";
	const txCategory = isDebt ? "Debt / Borrowed" : "Loan Given";
	const txDesc = isDebt
		? `Borrowed from ${payload.personName}${payload.description ? ` - ${payload.description}` : ""}`
		: `Loan to ${payload.personName}${payload.description ? ` - ${payload.description}` : ""}`;
	const txDate = payload.date ? new Date(payload.date) : new Date();

	const [transaction, debtLoan] = await prisma.$transaction(async (txClient) => {
		const createdTx = await txClient.transaction.create({
			data: {
				userId,
				type: txType,
				amount: payload.amount,
				category: txCategory,
				description: txDesc,
				paymentMethod: payload.paymentMethod || "Cash",
				date: txDate,
			},
		});

		const createdDebtLoan = await txClient.debtLoan.create({
			data: {
				userId,
				type: payload.type,
				personName: payload.personName,
				amount: payload.amount,
				paidAmount: 0,
				status: "ACTIVE",
				date: txDate,
				dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
				description: payload.description || null,
				initialTransactionId: createdTx.id,
			},
			include: {
				repayments: true,
			},
		});

		return [createdTx, createdDebtLoan];
	});

	broadcastSyncUpdate(userId, "debtLoan", "create", debtLoan);
	broadcastSyncUpdate(userId, "transaction", "create", transaction);

	return {
		...debtLoan,
		remainingAmount: debtLoan.amount,
	};
};

export const recordRepaymentInDB = async (
	userId: string,
	debtLoanId: string,
	payload: IRecordRepayment,
) => {
	const debtLoan = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
	});

	if (!debtLoan) {
		throw new AppError(404, "Debt or loan record not found");
	}

	const remaining = Math.max(0, debtLoan.amount - debtLoan.paidAmount);
	const repayAmount = Number(Math.min(payload.amount, remaining).toFixed(2));
	if (repayAmount <= 0) {
		throw new AppError(400, "Debt or loan is already completely settled");
	}

	const isDebt = debtLoan.type === "DEBT";
	const txType = isDebt ? "EXPENSE" : "INCOME";
	const txCategory = isDebt ? "Debt Repayment" : "Loan Return";
	const txDesc = isDebt
		? `Debt repayment to ${debtLoan.personName}${payload.notes ? ` - ${payload.notes}` : ""}`
		: `Loan return from ${debtLoan.personName}${payload.notes ? ` - ${payload.notes}` : ""}`;
	const repayDate = payload.date ? new Date(payload.date) : new Date();

	const [tx, repayment, updated] = await prisma.$transaction(async (txClient) => {
		const createdTx = await txClient.transaction.create({
			data: {
				userId,
				type: txType,
				amount: repayAmount,
				category: txCategory,
				description: txDesc,
				paymentMethod: payload.paymentMethod || "Cash",
				date: repayDate,
			},
		});

		const createdRepayment = await txClient.debtLoanRepayment.create({
			data: {
				debtLoanId,
				userId,
				amount: repayAmount,
				date: repayDate,
				paymentMethod: payload.paymentMethod || "Cash",
				notes: payload.notes || null,
				transactionId: createdTx.id,
			},
		});

		const newPaidAmount = Number((debtLoan.paidAmount + repayAmount).toFixed(2));
		const isSettled = newPaidAmount >= debtLoan.amount;

		const updatedDebtLoan = await txClient.debtLoan.update({
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

		return [createdTx, createdRepayment, updatedDebtLoan];
	});

	broadcastSyncUpdate(userId, "debtLoan", "update", updated);
	broadcastSyncUpdate(userId, "transaction", "create", tx);

	return {
		debtLoan: {
			...updated,
			remainingAmount: Math.max(0, Number((updated.amount - updated.paidAmount).toFixed(2))),
		},
		repayment,
	};
};

export const updateDebtLoanInDB = async (
	userId: string,
	debtLoanId: string,
	payload: IUpdateDebtLoan,
) => {
	const existing = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
	});

	if (!existing) {
		throw new AppError(404, "Debt or loan record not found");
	}

	const updated = await prisma.debtLoan.update({
		where: { id: debtLoanId },
		data: {
			personName: payload.personName,
			description: payload.description,
			dueDate: payload.dueDate
				? new Date(payload.dueDate)
				: payload.dueDate === null
					? null
					: undefined,
			date: payload.date ? new Date(payload.date) : undefined,
			status: payload.status,
		},
		include: {
			repayments: {
				orderBy: { date: "desc" },
			},
		},
	});

	if (existing.initialTransactionId && (payload.personName || payload.description !== undefined)) {
		const nextName = payload.personName || existing.personName;
		const nextDesc = payload.description !== undefined ? payload.description : existing.description;
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
			// Ignore if transaction was removed
		}
	}

	broadcastSyncUpdate(userId, "debtLoan", "update", updated);

	return {
		...updated,
		remainingAmount: Math.max(0, Number((updated.amount - updated.paidAmount).toFixed(2))),
	};
};

export const deleteDebtLoanFromDB = async (userId: string, debtLoanId: string) => {
	const existing = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
		include: { repayments: true },
	});

	if (!existing) {
		throw new AppError(404, "Debt or loan record not found");
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

	await prisma.$transaction(async (txClient) => {
		if (txIds.length > 0) {
			await txClient.transaction.deleteMany({
				where: { id: { in: txIds }, userId },
			});
		}
		await txClient.debtLoanRepayment.deleteMany({
			where: { debtLoanId },
		});
		await txClient.debtLoan.delete({
			where: { id: debtLoanId },
		});
	});

	broadcastSyncUpdate(userId, "debtLoan", "delete", { id: debtLoanId });

	return null;
};

export const deleteRepaymentFromDB = async (
	userId: string,
	debtLoanId: string,
	repaymentId: string,
) => {
	const repayment = await prisma.debtLoanRepayment.findFirst({
		where: { id: repaymentId, debtLoanId, userId },
	});

	if (!repayment) {
		throw new AppError(404, "Repayment record not found");
	}

	const debtLoan = await prisma.debtLoan.findFirst({
		where: { id: debtLoanId, userId },
	});

	await prisma.$transaction(async (txClient) => {
		if (repayment.transactionId) {
			try {
				await txClient.transaction.delete({
					where: { id: repayment.transactionId },
				});
			} catch {
				// Ignore
			}
		}
		await txClient.debtLoanRepayment.delete({
			where: { id: repaymentId },
		});
		if (debtLoan) {
			const newPaidAmount = Math.max(
				0,
				Number((debtLoan.paidAmount - repayment.amount).toFixed(2)),
			);
			await txClient.debtLoan.update({
				where: { id: debtLoanId },
				data: {
					paidAmount: newPaidAmount,
					status: newPaidAmount >= debtLoan.amount ? "SETTLED" : "ACTIVE",
				},
			});
		}
	});

	broadcastSyncUpdate(userId, "debtLoan", "update", { debtLoanId, repaymentId });

	return null;
};
