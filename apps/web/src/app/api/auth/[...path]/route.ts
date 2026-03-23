import { type NextRequest, NextResponse } from "next/server";

/**
 * Auth proxy — forwards all /api/auth/* requests to the real API and
 * explicitly copies Set-Cookie headers back to the browser.
 *
 * Next.js rewrites silently drop Set-Cookie from upstream responses, which
 * breaks session persistence. A real route handler forwards all headers.
 */
const API_BASE =
	process.env.AUTH_PROXY_TARGET ?? "https://superset-api-beryl.vercel.app";

async function proxy(
	request: NextRequest,
	path: string[],
): Promise<NextResponse> {
	const url = new URL(request.url);
	const destination = `${API_BASE}/api/auth/${path.join("/")}${url.search}`;

	const headers = new Headers(request.headers);
	headers.delete("host");

	const body =
		request.method !== "GET" && request.method !== "HEAD"
			? await request.arrayBuffer()
			: null;

	const upstream = await fetch(destination, {
		method: request.method,
		headers,
		body,
		redirect: "manual",
	});

	return new NextResponse(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: new Headers(upstream.headers),
	});
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	return proxy(request, path);
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	return proxy(request, path);
}
