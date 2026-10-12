import { type NextRequest, NextResponse } from "next/server";
import { handleApiDispatch } from "@/lib/server";

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
