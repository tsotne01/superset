import { auth } from "@superset/auth/server";
import { db } from "@superset/db/client";
import { sessions } from "@superset/db/schema/auth";
import { NextResponse } from "next/server";

import { env } from "@/env";

/**
 * Desktop OAuth finalization endpoint.
 *
 * Called by Better Auth after Google/GitHub OAuth completes on the API domain.
 * At this point the browser still has the API session cookie, so we can read
 * the session, create a long-lived desktop token, and redirect the browser to
 * the web app with the token embedded in the URL — avoiding the cross-domain
 * cookie problem that would occur if the web app tried to read the session.
 */
export async function GET(request: Request) {
	const url = new URL(request.url);
	const state = url.searchParams.get("state");
	const protocol = url.searchParams.get("protocol") ?? "superset";
	const localCallback = url.searchParams.get("local_callback");

	if (!state) {
		return NextResponse.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/auth/desktop/success?error=missing_state`,
		);
	}

	let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
	try {
		session = await auth.api.getSession({ headers: request.headers });
	} catch (error) {
		console.error("[desktop/finalize] Failed to get session:", error);
	}

	if (!session) {
		return NextResponse.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/auth/desktop/success?error=no_session`,
		);
	}

	const crypto = await import("node:crypto");
	const token = crypto.randomBytes(32).toString("base64url");
	const now = new Date();
	const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);

	const userAgent =
		request.headers.get("user-agent") || "Superset Desktop App";
	const ipAddress =
		request.headers.get("x-forwarded-for")?.split(",")[0] ||
		request.headers.get("x-real-ip") ||
		undefined;

	await db.insert(sessions).values({
		token,
		userId: session.user.id,
		expiresAt,
		ipAddress,
		userAgent,
		activeOrganizationId: session.session.activeOrganizationId,
		updatedAt: now,
	});

	const successUrl = new URL(
		`${env.NEXT_PUBLIC_WEB_URL}/auth/desktop/success`,
	);
	successUrl.searchParams.set("desktop_state", state);
	successUrl.searchParams.set("desktop_protocol", protocol);
	successUrl.searchParams.set("desktop_token", token);
	successUrl.searchParams.set("desktop_expires_at", expiresAt.toISOString());
	if (localCallback) {
		successUrl.searchParams.set("desktop_local_callback", localCallback);
	}

	return NextResponse.redirect(successUrl.toString());
}
