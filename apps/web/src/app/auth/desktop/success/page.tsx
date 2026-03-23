import { DesktopRedirect } from "./components/DesktopRedirect";

/**
 * Desktop OAuth success page.
 *
 * Receives the desktop session token from the API's /api/auth/desktop/finalize
 * endpoint (embedded in the URL) and redirects the browser to the desktop app
 * via deep link (superset://auth/callback) or localhost callback.
 *
 * The token is created on the API side (where the session cookie lives) to
 * avoid cross-domain cookie issues between the API and web domains.
 */
export default async function DesktopSuccessPage({
	searchParams,
}: {
	searchParams: Promise<{
		desktop_state?: string;
		desktop_protocol?: string;
		desktop_local_callback?: string;
		desktop_token?: string;
		desktop_expires_at?: string;
		error?: string;
	}>;
}) {
	const {
		desktop_state: state,
		desktop_protocol = "superset",
		desktop_local_callback: localCallbackBase,
		desktop_token: token,
		desktop_expires_at: expiresAtStr,
		error,
	} = await searchParams;

	if (error || !state || !token || !expiresAtStr) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
				<p className="text-xl text-muted-foreground">Authentication failed</p>
				<p className="text-muted-foreground/70">
					Please try signing in again from the desktop app.
				</p>
			</div>
		);
	}

	const desktopUrl = `${desktop_protocol}://auth/callback?token=${encodeURIComponent(token)}&expiresAt=${encodeURIComponent(expiresAtStr)}&state=${encodeURIComponent(state)}`;
	const localCallbackUrl = localCallbackBase
		? `${localCallbackBase}?token=${encodeURIComponent(token)}&expiresAt=${encodeURIComponent(expiresAtStr)}&state=${encodeURIComponent(state)}`
		: undefined;

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
			<DesktopRedirect url={desktopUrl} localCallbackUrl={localCallbackUrl} />
		</div>
	);
}
