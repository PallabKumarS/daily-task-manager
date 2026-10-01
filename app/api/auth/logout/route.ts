import { NextResponse } from "next/server";
import { sendApiResponse } from "@/lib/send-response";

export async function POST() {
  const response = sendApiResponse({
    statusCode: 200,
    success: true,
    message: "Logged out successfully",
    data: null,
  });

  response.cookies.set("token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
