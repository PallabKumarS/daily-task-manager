import { NextResponse } from "next/server";

export interface ApiResponseOptions<T> {
  statusCode: number;
  success: boolean;
  message?: string;
  data?: T | null;
  meta?: {
    page?: number;
    limit?: number;
    totalData?: number;
    totalPage?: number;
  } | null;
}

export function sendApiResponse<T>(options: ApiResponseOptions<T>): NextResponse {
  return NextResponse.json(
    {
      statusCode: options.statusCode,
      success: options.success,
      message: options.message,
      data: options.data ?? null,
      meta: options.meta ?? null,
    },
    { status: options.statusCode }
  );
}
