import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { ICreateCategory } from "./category.interface.js";

export const getCategoriesFromDB = async (userId: string, group?: string) => {
  return prisma.categoryOption.findMany({
    where: {
      userId,
      ...(group && { group }),
    },
    orderBy: { createdAt: "asc" },
  });
};

export const createCategoryInDB = async (userId: string, payload: ICreateCategory) => {
  const trimmedName = payload.name.trim();
  if (!trimmedName) {
    throw new AppError(400, "Category name cannot be empty.");
  }

  return prisma.categoryOption.upsert({
    where: {
      userId_group_name: {
        userId,
        group: payload.group,
        name: trimmedName,
      },
    },
    update: {
      ...(payload.color && { color: payload.color }),
    },
    create: {
      userId,
      group: payload.group,
      name: trimmedName,
      color: payload.color || null,
    },
  });
};

export const deleteCategoryFromDB = async (userId: string, id: string) => {
  const existing = await prisma.categoryOption.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new AppError(404, "Category not found.");
  }

  await prisma.categoryOption.delete({ where: { id } });
  return null;
};

export const updateCategoryInDB = async (
  userId: string,
  id: string,
  payload: { name?: string; color?: string }
) => {
  const existing = await prisma.categoryOption.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new AppError(404, "Category not found.");
  }

  const updatedName = payload.name?.trim();

  const updated = await prisma.categoryOption.update({
    where: { id },
    data: {
      ...(updatedName && { name: updatedName }),
      ...(payload.color !== undefined && { color: payload.color }),
    },
  });

  if (updatedName && updatedName !== existing.name) {
    await prisma.transaction.updateMany({
      where: { userId, category: existing.name },
      data: { category: updatedName },
    });
  }

  return updated;
};

