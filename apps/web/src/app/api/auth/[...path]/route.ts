import { type NextRequest, NextResponse } from "next/server";

/**
 * Auth proxy — forwards all /api/auth/* requests to the real API and
 * explicitly copies Set-Cookie headers back to the browser.
 *
 * Next.js rewrites silently drop Set-Cookie from upstream responses, which
 * breaks session persistence. A real route handler forwards all headers.
 *
 * OAuth callbacks use redirect:"manual" so the browser handles the final
 * navigation. All other requests use redirect:"follow" so the server
 * follows any internal API redirects (e.g. cookie-cache refresh 307s)
 * and returns the final JSON response — preventing the browser from
 * following redirects directly to the API domain where it has no cookies.
 */
const API_BASE =
	process.env.AUTH_PROXY_TARGET ?? "https://superset-api-beryl.vercel.app";

async function proxy(
	request: NextRequest,
	path: string[],
): Promise<NextResponse> {
	const url = new URL(request.url);
	const pathStr = path.join("/");
	const destination = `${API_BASE}/api/auth/${pathStr}${url.search}`;

	const reqHeaders = new Headers(request.headers);
	reqHeaders.delete("host");

	const body =
		request.method !== "GET" && request.method !== "HEAD"
			? await request.arrayBuffer()
			: null;

	// OAuth callbacks: pass 302/307 through to the browser so it follows
	// the redirect to the callbackURL (web app). Everything else: follow
	// redirects on the server so 307 cookie-refresh responses are resolved
	// before the browser sees them (prevents redirect to API domain).
	const isCallback = pathStr.startsWith("callback/");
	const upstream = await fetch(destination, {
		method: request.method,
		headers: reqHeaders,
		body,
		redirect: isCallback ? "manual" : "follow",
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
