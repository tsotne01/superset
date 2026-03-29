import { db } from "@superset/db/client";
import { integrationConnections, taskComments } from "@superset/db/schema";
import { Client } from "@upstash/qstash";
import { eq } from "drizzle-orm";
import { env } from "../../../env";

const qstash = new Client({ token: env.QSTASH_TOKEN });

const PROVIDER_ENDPOINTS: Record<string, string> = {
	linear: "/api/integrations/linear/jobs/sync-comment",
};

export async function syncComment(commentId: string) {
	const comment = await db.query.taskComments.findFirst({
		where: eq(taskComments.id, commentId),
		columns: { organizationId: true },
	});

	if (!comment) {
		throw new Error("Comment not found");
	}

	const connections = await db.query.integrationConnections.findMany({
		where: eq(integrationConnections.organizationId, comment.organizationId),
		columns: { provider: true },
	});

	const qstashBaseUrl = env.NEXT_PUBLIC_API_URL;

	const results = await Promise.allSettled(
		connections.map(async (conn) => {
			const endpoint = PROVIDER_ENDPOINTS[conn.provider];
			if (!endpoint) {
				return { provider: conn.provider, skipped: true };
			}

			await qstash.publishJSON({
				url: `${qstashBaseUrl}${endpoint}`,
				body: { commentId },
				retries: 3,
			});

			return { provider: conn.provider, queued: true };
		}),
	);

	return results;
}
