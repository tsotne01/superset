import { auth } from "@superset/auth/server";
import { findOrgMembership } from "@superset/db/utils";

import { env } from "@/env";
import { createSignedState } from "@/lib/oauth-state";

/**
 * Desktop-friendly Linear connect initiation.
 *
 * The desktop app calls this endpoint with its Bearer token to get a
 * pre-authenticated URL that the system browser can open directly —
 * no browser-based sign-in required.
 *
 * Returns JSON: { url: string }
 */
export async function GET(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const organizationId = url.searchParams.get("organizationId");

	if (!organizationId) {
		return Response.json(
			{ error: "Missing organizationId parameter" },
			{ status: 400 },
		);
	}

	const membership = await findOrgMembership({
		userId: session.user.id,
		organizationId,
	});

	if (!membership) {
		return Response.json(
			{ error: "User is not a member of this organization" },
			{ status: 403 },
		);
	}

	// Create a short-lived signed token embedding userId + organizationId.
	// The connect endpoint will verify this token instead of a session cookie.
	const preAuth = createSignedState({
		organizationId,
		userId: session.user.id,
	});

	const connectUrl = new URL(
		`${env.NEXT_PUBLIC_API_URL}/api/integrations/linear/connect`,
	);
	connectUrl.searchParams.set("pre_auth", preAuth);

	return Response.json({ url: connectUrl.toString() });
}
