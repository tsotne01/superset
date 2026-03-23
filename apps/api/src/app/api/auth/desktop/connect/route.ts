import { auth } from "@superset/auth/server";
import { NextResponse } from "next/server";

import { env } from "@/env";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const provider = url.searchParams.get("provider");
	const state = url.searchParams.get("state");
	const protocol = url.searchParams.get("protocol");
	const localCallback = url.searchParams.get("local_callback");

	if (!provider || !state) {
		return new Response("Missing provider or state", { status: 400 });
	}

	if (provider !== "google" && provider !== "github") {
		return new Response("Invalid provider", { status: 400 });
	}

	// Use the API's finalize endpoint as the OAuth callbackURL so the session
	// cookie is still on the API domain when we create the desktop token.
	// The finalize endpoint then redirects to the web app with the token in the URL.
	const finalizeUrl = new URL(
		`${env.NEXT_PUBLIC_API_URL}/api/auth/desktop/finalize`,
	);
	finalizeUrl.searchParams.set("state", state);
	if (protocol) {
		finalizeUrl.searchParams.set("protocol", protocol);
	}
	if (localCallback) {
		try {
			const callbackUrl = new URL(localCallback);
			const isLoopback =
				callbackUrl.protocol === "http:" &&
				(callbackUrl.hostname === "127.0.0.1" ||
					callbackUrl.hostname === "localhost");
			if (isLoopback && callbackUrl.pathname === "/auth/callback") {
				finalizeUrl.searchParams.set("local_callback", callbackUrl.toString());
			}
		} catch {
			// Ignore invalid callback URLs and continue with deep-link flow.
		}
	}

	const result = await auth.api.signInSocial({
		body: {
			provider,
			callbackURL: finalizeUrl.toString(),
		},
		asResponse: true,
	});

	const cookies = result.headers.getSetCookie();
	const body = (await result.json()) as { url?: string; redirect?: boolean };

	if (!body.url) {
		return new Response(`Failed to initiate OAuth: ${JSON.stringify(body)}`, {
			status: 500,
		});
	}

	const response = NextResponse.redirect(body.url);
	for (const cookie of cookies) {
		response.headers.append("set-cookie", cookie);
	}

	return response;
}
