import type { CategoryOption, Prisma, PrismaClient } from "@prisma/client";
import type { IpcApiResponse } from "./ipc-dispatcher";

type RequestBody = Record<string, unknown>;

/**
 * Groups whose option names are persisted verbatim on domain records.
 * Renaming one of these must rewrite the stored string on every matching record,
 * otherwise historical data keeps the old name and appears "not renamed".
 */
const CASCADING_GROUPS = new Set([
	"EXPENSE",
	"INCOME",
	"PAYMENT_METHOD",
	"TASK_CATEGORY",
	"TRACKER_CATEGORY",
]);

const normalizeGroup = (value: unknown): string =>
	String(value || "EXPENSE")
		.trim()
		.toUpperCase();

const normalizeName = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normalizeColor = (value: unknown): string | null | undefined => {
	if (value === undefined) return undefined;
	return typeof value === "string" && value.trim() ? value.trim() : null;
};

const serialize = (category: CategoryOption) => ({
	...category,
	createdAt: category.createdAt.toISOString(),
});

const fail = (statusCode: number, message: string): IpcApiResponse => ({
	statusCode,
	success: false,
	message,
	data: null,
});

export async function cascadeCategoryRename(
	db: Prisma.TransactionClient,
	userId: string,
	group: string,
	oldName: string,
	newName: string,
): Promise<number> {
	if (oldName === newName || !CASCADING_GROUPS.has(group)) return 0;

	if (group === "EXPENSE" || group === "INCOME") {
		const result = await db.transaction.updateMany({
			where: { userId, type: group, category: oldName },
			data: { category: newName },
		});
		return result.count;
	}

	if (group === "PAYMENT_METHOD") {
		const result = await db.transaction.updateMany({
			where: { userId, paymentMethod: oldName },
			data: { paymentMethod: newName },
		});
		return result.count;
	}

	if (group === "TASK_CATEGORY") {
		const result = await db.task.updateMany({
			where: { userId, category: oldName },
			data: { category: newName },
		});
		return result.count;
	}

	const result = await db.dailyTracker.updateMany({
		where: { userId, category: oldName },
		data: { category: newName },
	});
	return result.count;
}

async function listCategories(
	prisma: PrismaClient,
	userId: string,
	query: Record<string, string>,
): Promise<IpcApiResponse> {
	const categories = await prisma.categoryOption.findMany({
		where: {
			userId,
			...(query.group ? { group: normalizeGroup(query.group) } : {}),
		},
		orderBy: { name: "asc" },
	});
	return { statusCode: 200, success: true, data: categories.map(serialize) };
}

async function createCategory(
	prisma: PrismaClient,
	userId: string,
	body: RequestBody,
): Promise<IpcApiResponse> {
	const name = normalizeName(body.name);
	if (!name) return fail(400, "Category name cannot be empty.");

	const group = normalizeGroup(body.group);
	const color = normalizeColor(body.color);

	const category = await prisma.categoryOption.upsert({
		where: { userId_group_name: { userId, group, name } },
		update: color !== undefined ? { color } : {},
		create: { userId, group, name, color: color ?? null },
	});

	return {
		statusCode: 201,
		success: true,
		message: "Category saved",
		data: serialize(category),
	};
}

async function updateCategory(
	prisma: PrismaClient,
	userId: string,
	id: string,
	body: RequestBody,
): Promise<IpcApiResponse> {
	const existing = await prisma.categoryOption.findFirst({
		where: { id, userId },
	});
	if (!existing) return fail(404, "Category not found.");

	const requestedName = normalizeName(body.name);
	const nextName = requestedName || existing.name;
	const color = normalizeColor(body.color);

	if (nextName !== existing.name) {
		const conflict = await prisma.categoryOption.findFirst({
			where: {
				userId,
				group: existing.group,
				name: nextName,
				NOT: { id },
			},
		});
		if (conflict) {
			return fail(409, `A category named "${nextName}" already exists.`);
		}
	}

	const { category, updatedRecords } = await prisma.$transaction(
		async (tx: Prisma.TransactionClient) => {
			const updated = await tx.categoryOption.update({
				where: { id },
				data: {
					name: nextName,
					...(color !== undefined ? { color } : {}),
				},
			});
			const count = await cascadeCategoryRename(
				tx,
				userId,
				existing.group,
				existing.name,
				nextName,
			);
			return { category: updated, updatedRecords: count };
		},
	);

	return {
		statusCode: 200,
		success: true,
		message:
			updatedRecords > 0
				? `Category renamed and ${updatedRecords} record(s) updated`
				: "Category updated",
		data: { ...serialize(category), updatedRecords },
	};
}

/**
 * Renames an option by name rather than id. Required for built-in defaults,
 * which have no database row until the user customizes them.
 */
async function renameCategoryByName(
	prisma: PrismaClient,
	userId: string,
	body: RequestBody,
): Promise<IpcApiResponse> {
	const group = normalizeGroup(body.group);
	const oldName = normalizeName(body.oldName);
	const newName = normalizeName(body.newName);
	const color = normalizeColor(body.color);

	if (!oldName || !newName) {
		return fail(400, "Both the current and new names are required.");
	}

	const [source, target] = await Promise.all([
		prisma.categoryOption.findFirst({
			where: { userId, group, name: oldName },
		}),
		oldName === newName
			? Promise.resolve(null)
			: prisma.categoryOption.findFirst({
					where: { userId, group, name: newName },
				}),
	]);

	if (source && target) {
		return fail(409, `A category named "${newName}" already exists.`);
	}

	const { category, updatedRecords } = await prisma.$transaction(
		async (tx: Prisma.TransactionClient) => {
			let saved: CategoryOption;
			if (source) {
				saved = await tx.categoryOption.update({
					where: { id: source.id },
					data: { name: newName, ...(color !== undefined ? { color } : {}) },
				});
			} else if (target) {
				saved =
					color !== undefined
						? await tx.categoryOption.update({
								where: { id: target.id },
								data: { color },
							})
						: target;
			} else {
				saved = await tx.categoryOption.create({
					data: { userId, group, name: newName, color: color ?? null },
				});
			}

			const count = await cascadeCategoryRename(tx, userId, group, oldName, newName);
			return { category: saved, updatedRecords: count };
		},
	);

	return {
		statusCode: 200,
		success: true,
		message:
			updatedRecords > 0
				? `Renamed to "${newName}" and ${updatedRecords} record(s) updated`
				: `Renamed to "${newName}"`,
		data: { ...serialize(category), updatedRecords },
	};
}

async function deleteCategory(
	prisma: PrismaClient,
	userId: string,
	id: string,
): Promise<IpcApiResponse> {
	const existing = await prisma.categoryOption.findFirst({
		where: { id, userId },
	});
	if (!existing) return fail(404, "Category not found.");

	await prisma.categoryOption.delete({ where: { id } });
	return {
		statusCode: 200,
		success: true,
		message: "Category deleted",
		data: null,
	};
}

async function deleteAllCategories(prisma: PrismaClient, userId: string): Promise<IpcApiResponse> {
	const result = await prisma.categoryOption.deleteMany({ where: { userId } });
	return {
		statusCode: 200,
		success: true,
		message: `${result.count} custom categories deleted`,
		data: null,
	};
}

export async function handleCategoryRoute(
	prisma: PrismaClient,
	userId: string,
	method: string,
	pathname: string,
	query: Record<string, string>,
	body: RequestBody,
): Promise<IpcApiResponse | null> {
	if (pathname === "/categories") {
		if (method === "GET") return listCategories(prisma, userId, query);
		if (method === "POST") return createCategory(prisma, userId, body);
		if (method === "DELETE") return deleteAllCategories(prisma, userId);
		return null;
	}

	if (pathname === "/categories/rename" && (method === "POST" || method === "PATCH")) {
		return renameCategoryByName(prisma, userId, body);
	}

	const match = pathname.match(/^\/categories\/([^/]+)$/);
	if (!match) return null;

	if (method === "PATCH") return updateCategory(prisma, userId, match[1], body);
	if (method === "DELETE") return deleteCategory(prisma, userId, match[1]);
	return null;
}
