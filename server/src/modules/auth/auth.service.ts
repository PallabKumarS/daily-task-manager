import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../../config/index.js";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { IRegisterUser, ILoginUser, IAuthResponse } from "./auth.interface.js";

const generateToken = (payload: { userId: string; email: string }): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

export const registerUserIntoDB = async (payload: IRegisterUser): Promise<IAuthResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError(409, "An account with this email address already exists.");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(payload.password, salt);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email.toLowerCase(),
      passwordHash,
      currency: (payload.currency || "USD").toUpperCase(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
    },
  });

  const token = generateToken({ userId: user.id, email: user.email });

  return { user, token };
};

export const loginUserIntoDB = async (payload: ILoginUser): Promise<IAuthResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password.");
  }

  const isPasswordMatched = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isPasswordMatched) {
    throw new AppError(401, "Invalid email or password.");
  }

  const token = generateToken({ userId: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const getMeFromDB = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
      googleConnection: {
        select: {
          googleEmail: true,
          lastSyncAt: true,
          driveFileId: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found.");
  }

  return user;
};

export const updateProfileInDB = async (
  userId: string,
  payload: { name?: string; currency?: string }
) => {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name && { name: payload.name }),
      ...(payload.currency && { currency: payload.currency.toUpperCase() }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
    },
  });

  return updatedUser;
};
