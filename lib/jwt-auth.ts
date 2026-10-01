import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "daypulse-default-jwt-secret-key-change-in-prod";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signToken(payload: TokenPayload, expiresIn = "30d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getAuthUser(req: NextRequest): TokenPayload | null {
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    const cookieToken = req.cookies.get("token")?.value;
    if (cookieToken) {
      token = cookieToken;
    }
  }

  if (!token) {
    return null;
  }

  return verifyToken(token);
}
