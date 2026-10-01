import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = signToken({ userId: user.id, email: user.email });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      createdAt: user.createdAt,
    };

    const response = sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Logged in successfully",
      data: { user: safeUser, token },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
