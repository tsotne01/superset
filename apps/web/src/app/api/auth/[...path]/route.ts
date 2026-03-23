import { auth } from "@superset/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Serve Better Auth directly from the web app domain so cookies are
 * set on superset-web-umber.vercel.app natively — no proxy required.
 *
 * Both web and API share the same DB and BETTER_AUTH_SECRET, so sessions
 * created here are fully compatible with the API auth instance.
 */
export const { GET, POST } = toNextJsHandler(auth);
