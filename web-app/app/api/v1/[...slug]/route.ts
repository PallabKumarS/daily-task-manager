import { type NextRequest, NextResponse } from "next/server";
import {
	downloadLatestBackupFromGoogleDrive,
	exchangeCodeForTokens,
	getGoogleProfile,
	getPrismaClient,
	handleApiDispatch,
	processGoogleOAuthCode,
} from "@/lib/server";

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
			const tokens = await exchangeCodeForTokens(code);
			const profile = await getGoogleProfile(tokens.accessToken);
			const isOnboardingRestore =
				state === "restore_onboarding" || state === "login_restore" || state.startsWith("restore");

			let backupData: Record<string, unknown> | null = null;
			if (isOnboardingRestore) {
				try {
					backupData = (await downloadLatestBackupFromGoogleDrive(tokens.accessToken)) as Record<
						string,
						unknown
					>;
				} catch (restoreErr) {
					console.warn("[DayPulse Google Sync] Backup download notice:", restoreErr);
				}
			}

			// Best-effort database update for persistent server/desktop
			try {
				const prisma = getPrismaClient();
				await processGoogleOAuthCode(prisma, code, state).catch(() => {});
			} catch {}

			const targetPath = isOnboardingRestore ? "/dashboard" : "/settings";
			const syncPayload = {
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					expiresIn: tokens.expiresIn,
					email: profile.email,
				},
				profile: {
					id: profile.id,
					email: profile.email,
					name: profile.name || "Google User",
				},
				user: {
					id: `usr_${profile.id.slice(-8)}`,
					name: profile.name || "Google User",
					email: profile.email,
					currency: "USD",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				token: `daypulse_token_${profile.id.slice(-8)}`,
				targetUrl: targetPath,
				backupData,
				isOnboardingRestore,
			};

			const html = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>DayPulse - Sync Connected</title>
</head>
<body style="background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
	<div style="background:#18181b;padding:48px;border-radius:20px;border:1px solid #27272a;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
		<h2 style="color:#10b981;margin:0 0 12px;font-size:22px;">Google Account Connected</h2>
		<p style="color:#a1a1aa;font-size:14px;margin:8px 0;line-height:1.5;">Account verified: ${profile.email}</p>
		<p style="color:#71717a;font-size:12px;">Syncing workspace and redirecting...</p>
	</div>
	<script>
		(function() {
			try {
				var data = ${JSON.stringify(syncPayload)};
				if (data.tokens) {
					localStorage.setItem("daypulse_google_tokens", JSON.stringify(data.tokens));
					localStorage.setItem("daypulse_google_sync_status", JSON.stringify({
						lastSyncAt: new Date().toISOString(),
						email: data.tokens.email
					}));
				}
				if (data.user) {
					var existing = localStorage.getItem("daypulse_user_account");
					if (!existing || data.isOnboardingRestore) {
						localStorage.setItem("daypulse_user_account", JSON.stringify(data.user));
					}
					localStorage.setItem("daypulse_auth_token", data.token);
					document.cookie = "token=" + data.token + "; path=/; max-age=2592000; SameSite=Lax";
				}
				if (data.backupData) {
					var b = data.backupData;
					var tasks = b.tasks || (b.data && b.data.tasks);
					var routines = b.routines || (b.data && b.data.routines);
					var routineLogs = b.routineLogs || (b.data && b.data.routineLogs);
					var finances = b.transactions || b.finances || (b.data && (b.data.transactions || b.data.finances));
					var trackers = b.trackers || (b.data && b.data.trackers);
					var trackerLogs = b.trackerLogs || (b.data && b.data.trackerLogs);
					var categories = b.categories || (b.data && b.data.categories);
					var debtsLoans = b.debtsLoans || (b.data && b.data.debtsLoans);
					var repayments = b.repayments || (b.data && b.data.repayments);

					if (Array.isArray(tasks)) localStorage.setItem("daypulse_local_tasks", JSON.stringify(tasks));
					if (Array.isArray(routines)) localStorage.setItem("daypulse_local_routines", JSON.stringify(routines));
					if (Array.isArray(routineLogs)) localStorage.setItem("daypulse_local_routine_logs", JSON.stringify(routineLogs));
					if (Array.isArray(finances)) localStorage.setItem("daypulse_local_finances", JSON.stringify(finances));
					if (Array.isArray(trackers)) localStorage.setItem("daypulse_local_trackers", JSON.stringify(trackers));
					if (Array.isArray(trackerLogs)) localStorage.setItem("daypulse_local_tracker_logs", JSON.stringify(trackerLogs));
					if (Array.isArray(categories)) localStorage.setItem("daypulse_local_categories", JSON.stringify(categories));
					if (Array.isArray(debtsLoans)) localStorage.setItem("daypulse_local_debts_loans", JSON.stringify(debtsLoans));
					if (Array.isArray(repayments)) localStorage.setItem("daypulse_local_debt_repayments", JSON.stringify(repayments));
				}
				if (window.opener && window.opener !== window) {
					try {
						window.opener.postMessage({ type: "daypulse:google_connected", email: data.profile.email }, "*");
						window.close();
						return;
					} catch(e) {}
				}
				window.location.replace(data.targetUrl);
			} catch(err) {
				window.location.replace("/settings?sync_error=" + encodeURIComponent(err.message || "Failed to initialize local session"));
			}
		})();
	</script>
</body>
</html>`;

			return new NextResponse(html, {
				status: 200,
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
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
