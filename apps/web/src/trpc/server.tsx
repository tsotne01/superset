import "server-only";

import type { AppRouter } from "@superset/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { headers } from "next/headers";
import { cache } from "react";
import SuperJSON from "superjson";

import { env } from "../env";

export const api = cache(async () => {
	const incoming = await headers();
	const heads = new Headers();

	// Forward only the headers the API actually needs.
	// Crucially, do NOT forward `host` — that tells Vercel's edge which
	// project to serve, and forwarding the web app's host would route the
	// request back to the web project instead of the API.
	const forwardHeaders = ["cookie", "authorization", "accept-language"];
	for (const name of forwardHeaders) {
		const value = incoming.get(name);
		if (value) heads.set(name, value);
	}
	heads.set("x-trpc-source", "rsc");

	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				transformer: SuperJSON,
				url: `${env.NEXT_PUBLIC_API_URL}/api/trpc`,
				headers() {
					return Object.fromEntries(heads.entries());
				},
			}),
		],
	});
});
