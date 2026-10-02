import { PrismaClient } from "@prisma/client";

declare global {
  var serverPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.serverPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.serverPrisma = prisma;
}
