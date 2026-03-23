import { type NextRequest, NextResponse } from "next/server";

/**
 * Auth proxy — forwards all /api/auth/* requests to the real API and
 * explicitly copies Set-Cookie headers back to the browser.
 *
 * Next.js rewrites silently drop Set-Cookie from upstream responses, which
 * breaks session persistence. A real route handler forwards all headers.
 *
 * Uses getSetCookie() to correctly handle multiple Set-Cookie headers
 * (the Headers constructor merges them with commas which breaks cookie parsing).
 */
const API_BASE =
	process.env.AUTH_PROXY_TARGET ?? "https://superset-api-beryl.vercel.app";

async function proxy(
	request: NextRequest,
	path: string[],
): Promise<NextResponse> {
	const url = new URL(request.url);
	const destination = `${API_BASE}/api/auth/${path.join("/")}${url.search}`;

	const reqHeaders = new Headers(request.headers);
	reqHeaders.delete("host");
	// Tell the API the real origin so trusted-origins check passes
	reqHeaders.set("x-forwarded-host", new URL(request.url).host);

	const body =
		request.method !== "GET" && request.method !== "HEAD"
			? await request.arrayBuffer()
			: null;

	const upstream = await fetch(destination, {
		method: request.method,
		headers: reqHeaders,
		body,
		redirect: "manual", // Pass redirects straight to the browser
	});

	// Build response headers, handling Set-Cookie individually so they
	// are not merged (which would break multi-cookie responses)
	const resHeaders = new Headers();
	upstream.headers.forEach((value, key) => {
		if (key.toLowerCase() === "set-cookie") return; // handled below
		if (key.toLowerCase() === "content-encoding") return; // avoid decode mismatch
		if (key.toLowerCase() === "content-length") return; // length may change
		resHeaders.set(key, value);
	});

	// getSetCookie() returns each Set-Cookie as a separate string (Node 18.10+)
	const setCookies =
		typeof upstream.headers.getSetCookie === "function"
			? upstream.headers.getSetCookie()
			: [];
	for (const cookie of setCookies) {
		resHeaders.append("set-cookie", cookie);
	}

	return new NextResponse(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: resHeaders,
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
