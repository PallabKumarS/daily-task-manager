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
			const redirectUri = `${url.origin}/api/v1/sync/google/callback`;
			const isOnboardingRestore =
				state === "restore_onboarding" || state === "login_restore" || state.startsWith("restore");

			let profile: { id: string; email: string; name?: string } | null = null;
			let tokens: { accessToken: string; refreshToken?: string; expiresIn: number } | null = null;
			let prismaHandled = false;

			try {
				const prisma = getPrismaClient();
				if (prisma) {
					const processed = await processGoogleOAuthCode(prisma, code, state, redirectUri);
					profile = processed.profile;
					tokens = processed.tokens;
					prismaHandled = true;
				}
			} catch (prismaErr) {
				console.warn("[DayPulse Google Sync] Prisma processing notice:", prismaErr);
			}

			if (!tokens || !profile) {
				tokens = await exchangeCodeForTokens(code, redirectUri);
				profile = await getGoogleProfile(tokens.accessToken);
			}

			if (prismaHandled) {
				const html = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>DayPulse - Google Drive Connected</title>
</head>
<body style="background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
	<div style="background:#18181b;padding:48px;border-radius:20px;border:1px solid #27272a;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
		<h2 style="color:#10b981;margin:0 0 12px;font-size:22px;">${isOnboardingRestore ? "Workspace Restored" : "Google Account Connected"}</h2>
		<p style="color:#a1a1aa;font-size:14px;margin:8px 0;line-height:1.5;">${isOnboardingRestore ? `Your Google Drive data for ${profile.email} has been restored into DayPulse.` : `Your Google Drive connection is now active for ${profile.email}.`}</p>
		<p style="color:#71717a;font-size:13px;margin:12px 0 0;">Returning to DayPulse...</p>
		<div style="display:inline-block;background:rgba(16,185,129,0.1);color:#34d399;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;margin-top:20px;border:1px solid rgba(16,185,129,0.2);">${isOnboardingRestore ? "Restore Complete" : "Connection Active"}</div>
		<div style="margin-top:24px;">
			<button onclick="try{if(window.opener&&window.opener!==window){window.opener.postMessage({type:'daypulse:google_connected',email:'${profile.email}'},'*');window.close();}}catch(e){}window.location.href='${isOnboardingRestore ? "/dashboard" : "/settings"}';" style="background:#10b981;color:#022c22;font-weight:600;border:none;border-radius:10px;padding:9px 20px;cursor:pointer;font-size:13px;">Return to DayPulse</button>
		</div>
	</div>
	<script>
		try {
			if (window.opener && window.opener !== window) {
				window.opener.postMessage({ type: "daypulse:google_connected", email: "${profile.email}" }, "*");
				setTimeout(function() { window.close(); }, 1200);
			} else {
				setTimeout(function() { window.location.href = "${isOnboardingRestore ? "/dashboard" : "/settings"}?sync_status=connected&email=${encodeURIComponent(profile.email)}"; }, 1400);
			}
		} catch(e) {
			setTimeout(function() { window.location.href = "${isOnboardingRestore ? "/dashboard" : "/settings"}"; }, 1500);
		}
	</script>
</body>
</html>`;
				return new NextResponse(html, {
					status: 200,
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

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
					var prevTokens = null;
					try { prevTokens = JSON.parse(localStorage.getItem("daypulse_google_tokens")); } catch(e) {}
					var savedTokens = Object.assign({}, prevTokens || {}, data.tokens);
					if (!data.tokens.refreshToken && prevTokens && prevTokens.refreshToken) {
						savedTokens.refreshToken = prevTokens.refreshToken;
					}
					localStorage.setItem("daypulse_google_tokens", JSON.stringify(savedTokens));
					localStorage.setItem("daypulse_google_sync_status", JSON.stringify({
						lastSyncAt: new Date().toISOString(),
						email: savedTokens.email || data.tokens.email
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
						setTimeout(function() { window.close(); }, 1200);
						return;
					} catch(e) {}
				}
				setTimeout(function() {
					window.location.replace(data.targetUrl);
				}, 1000);
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
