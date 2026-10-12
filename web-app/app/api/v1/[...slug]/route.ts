import { type NextRequest, NextResponse } from "next/server";
import { getPrismaClient, handleApiDispatch, processGoogleOAuthCode } from "@/lib/server";

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	return processRequest(request, params.slug, "GET");
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	return processRequest(request, params.slug, "POST");
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	return processRequest(request, params.slug, "PATCH");
}

export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	return processRequest(request, params.slug, "PUT");
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ slug: string[] }> }) {
	const params = await props.params;
	return processRequest(request, params.slug, "DELETE");
}

async function processRequest(request: NextRequest, slug: string[], method: string) {
	const url = new URL(request.url);
	const pathname = `/${(slug || []).join("/")}`;

	if (method === "GET" && pathname === "/sync/google/callback") {
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state") || "";

		if (!code) {
			const targetUrl = new URL("/settings", request.url);
			targetUrl.searchParams.set("sync_error", "Missing authorization code");
			return NextResponse.redirect(targetUrl);
		}

		try {
			const prisma = getPrismaClient();
			const { profile, isOnboardingRestore } = await processGoogleOAuthCode(
				prisma,
				code,
				state,
			);
			const targetUrl = new URL(
				isOnboardingRestore ? "/dashboard" : "/settings",
				request.url,
			);
			targetUrl.searchParams.set("sync_status", "connected");
			targetUrl.searchParams.set("email", profile.email);
			return NextResponse.redirect(targetUrl);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to connect Google account";
			const targetUrl = new URL("/settings", request.url);
			targetUrl.searchParams.set("sync_error", msg);
			return NextResponse.redirect(targetUrl);
		}
	}

	const endpoint = `${pathname}${url.search}`;

	let body: unknown;
	if (["POST", "PATCH", "PUT"].includes(method)) {
		try {
			body = await request.json();
		} catch {
			body = {};
		}
	}

	const authHeader = request.headers.get("authorization");
	const cookieToken = request.cookies.get("token")?.value;
	const token = authHeader?.replace(/^Bearer\s+/i, "") || cookieToken || null;

	const response = await handleApiDispatch({
		endpoint,
		method,
		body,
		token,
	});

	return NextResponse.json(response, { status: response.statusCode });
}
