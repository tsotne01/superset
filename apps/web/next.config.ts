import { join } from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import { config as dotenvConfig } from "dotenv";
import type { NextConfig } from "next";

// Load .env from monorepo root during development
if (process.env.NODE_ENV !== "production") {
	dotenvConfig({
		path: join(process.cwd(), "../../.env"),
		override: true,
		quiet: true,
	});
}

const config: NextConfig = {
	reactCompiler: true,
	typescript: { ignoreBuildErrors: true },

	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.public.blob.vercel-storage.com",
			},
		],
	},

	async rewrites() {
		const apiUrl = process.env.NEXT_PUBLIC_API_URL;
		return [
			// /api/auth/* is handled by the real route handler at
			// app/api/auth/[...path]/route.ts which properly forwards Set-Cookie.

			// Proxy tRPC through the web domain so the browser can send the
			// session cookie (which lives on the web domain, not the API domain).
			// Next.js rewrites are server-side and forward all request headers
			// including cookies, so the API receives the session cookie correctly.
			{
				source: "/api/trpc/:path*",
				destination: `${apiUrl}/api/trpc/:path*`,
			},

			// PostHog ingestion proxy (avoids ad-blocker interference).
			{
				source: "/ingest/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/ingest/:path*",
				destination: "https://us.i.posthog.com/:path*",
			},
			{
				source: "/ingest/decide",
				destination: "https://us.i.posthog.com/decide",
			},
		];
	},

	skipTrailingSlashRedirect: true,
};

export default withSentryConfig(config, {
	org: "superset-sh",
	project: "web",
	silent: !process.env.CI,
	authToken: process.env.SENTRY_AUTH_TOKEN,
	widenClientFileUpload: true,
	tunnelRoute: "/monitoring",
	disableLogger: true,
	automaticVercelMonitors: true,
});
