import { buildConflictUpdateColumns, db } from "@superset/db";
import { taskComments, tasks } from "@superset/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { LinearIssue } from "./utils";

const BATCH_SIZE = 100;

export async function syncComments(
	issues: LinearIssue[],
	organizationId: string,
): Promise<void> {
	// Collect all issue IDs that have comments
	const issueIdsWithComments = issues
		.filter((i) => i.comments.nodes.length > 0)
		.map((i) => i.id);

	if (issueIdsWithComments.length === 0) {
		return;
	}

	// Look up local task UUIDs by externalId
	const localTasks = await db
		.select({ id: tasks.id, externalId: tasks.externalId })
		.from(tasks)
		.where(
			and(
				eq(tasks.organizationId, organizationId),
				eq(tasks.externalProvider, "linear"),
				inArray(tasks.externalId, issueIdsWithComments),
			),
		);

	const taskIdByExternalId = new Map(
		localTasks.map((t) => [t.externalId, t.id]),
	);

	const commentValues: (typeof taskComments.$inferInsert)[] = [];

	for (const issue of issues) {
		const taskId = taskIdByExternalId.get(issue.id);
		if (!taskId) continue;

		for (const comment of issue.comments.nodes) {
			commentValues.push({
				taskId,
				organizationId,
				externalId: comment.id,
				externalProvider: "linear",
				body: comment.body,
				authorExternalId: comment.user?.id ?? null,
				authorName: comment.user?.name ?? null,
				authorAvatarUrl: comment.user?.avatarUrl ?? null,
				createdAt: new Date(comment.createdAt),
				updatedAt: new Date(comment.updatedAt),
				editedAt: comment.editedAt ? new Date(comment.editedAt) : null,
			});
		}
	}

	if (commentValues.length === 0) {
		return;
	}

	for (let i = 0; i < commentValues.length; i += BATCH_SIZE) {
		const batch = commentValues.slice(i, i + BATCH_SIZE);
		await db
			.insert(taskComments)
			.values(batch)
			.onConflictDoUpdate({
				target: [
					taskComments.organizationId,
					taskComments.externalProvider,
					taskComments.externalId,
				],
				set: {
					...buildConflictUpdateColumns(taskComments, [
						"body",
						"authorExternalId",
						"authorName",
						"authorAvatarUrl",
						"updatedAt",
						"editedAt",
					]),
					deletedAt: null,
				},
			});
	}
}
