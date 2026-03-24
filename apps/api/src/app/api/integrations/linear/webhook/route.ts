import type {
	EntityWebhookPayloadWithCommentData,
	EntityWebhookPayloadWithIssueData,
} from "@linear/sdk/webhooks";
import {
	LINEAR_WEBHOOK_SIGNATURE_HEADER,
	LinearWebhookClient,
} from "@linear/sdk/webhooks";
import { db } from "@superset/db/client";
import type { SelectIntegrationConnection } from "@superset/db/schema";
import {
	integrationConnections,
	members,
	taskComments,
	taskRelations,
	taskStatuses,
	tasks,
	users,
	webhookEvents,
} from "@superset/db/schema";
import { mapPriorityFromLinear } from "@superset/trpc/integrations/linear";
import { and, eq, sql } from "drizzle-orm";
import { env } from "@/env";

const webhookClient = new LinearWebhookClient(env.LINEAR_WEBHOOK_SECRET);

// IssueRelation is not typed in the SDK's LinearWebhookEventTypeMap,
// so we define its data shape locally.
interface IssueRelationWebhookData {
	id: string;
	type: string;
	issueId: string;
	relatedIssueId: string;
	createdAt: string;
}

interface IssueRelationWebhookPayload {
	type: "IssueRelation";
	action: string;
	organizationId: string;
	webhookTimestamp: number;
	data: IssueRelationWebhookData;
}

export async function POST(request: Request) {
	const body = await request.text();
	const signature = request.headers.get(LINEAR_WEBHOOK_SIGNATURE_HEADER);

	if (!signature) {
		return Response.json({ error: "Missing signature" }, { status: 401 });
	}

	const payload = webhookClient.parseData(Buffer.from(body), signature);

	// Store event with idempotent handling
	const eventId = `${payload.organizationId}-${payload.webhookTimestamp}`;

	const [webhookEvent] = await db
		.insert(webhookEvents)
		.values({
			provider: "linear",
			eventId,
			eventType: `${payload.type}.${payload.action}`,
			payload,
			status: "pending",
		})
		.onConflictDoUpdate({
			target: [webhookEvents.provider, webhookEvents.eventId],
			set: {
				// Reset for reprocessing only if previously failed
				status: sql`CASE WHEN ${webhookEvents.status} = 'failed' THEN 'pending' ELSE ${webhookEvents.status} END`,
				retryCount: sql`CASE WHEN ${webhookEvents.status} = 'failed' THEN ${webhookEvents.retryCount} + 1 ELSE ${webhookEvents.retryCount} END`,
				error: sql`CASE WHEN ${webhookEvents.status} = 'failed' THEN NULL ELSE ${webhookEvents.error} END`,
			},
		})
		.returning();

	if (!webhookEvent) {
		return Response.json({ error: "Failed to store event" }, { status: 500 });
	}

	// Idempotent: skip if already processed or not ready for processing
	if (webhookEvent.status === "processed") {
		console.log("[linear/webhook] Event already processed:", eventId);
		return Response.json({ success: true, message: "Already processed" });
	}
	if (webhookEvent.status !== "pending") {
		console.log(
			`[linear/webhook] Event in ${webhookEvent.status} state:`,
			eventId,
		);
		return Response.json({ success: true, message: "Event not ready" });
	}

	const connection = await db.query.integrationConnections.findFirst({
		where: and(
			eq(integrationConnections.externalOrgId, payload.organizationId),
			eq(integrationConnections.provider, "linear"),
		),
	});

	if (!connection) {
		await db
			.update(webhookEvents)
			.set({ status: "skipped", error: "No connection found" })
			.where(eq(webhookEvents.id, webhookEvent.id));
		return Response.json({ error: "Unknown organization" }, { status: 404 });
	}

	try {
		let status: "processed" | "skipped" = "processed";

		if (payload.type === "Issue") {
			status = await processIssueEvent(
				payload as EntityWebhookPayloadWithIssueData,
				connection,
			);
		} else if (payload.type === "Comment") {
			status = await processCommentEvent(
				payload as EntityWebhookPayloadWithCommentData,
				connection,
			);
		} else if (payload.type === "IssueRelation") {
			status = await processRelationEvent(
				payload as unknown as IssueRelationWebhookPayload,
				connection,
			);
		}

		await db
			.update(webhookEvents)
			.set({
				status,
				processedAt: new Date(),
			})
			.where(eq(webhookEvents.id, webhookEvent.id));

		return Response.json({ success: true });
	} catch (error) {
		await db
			.update(webhookEvents)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				retryCount: webhookEvent.retryCount + 1,
			})
			.where(eq(webhookEvents.id, webhookEvent.id));

		return Response.json({ error: "Processing failed" }, { status: 500 });
	}
}

async function processIssueEvent(
	payload: EntityWebhookPayloadWithIssueData,
	connection: SelectIntegrationConnection,
): Promise<"processed" | "skipped"> {
	const issue = payload.data;

	if (payload.action === "create" || payload.action === "update") {
		const taskStatus = await db.query.taskStatuses.findFirst({
			where: and(
				eq(taskStatuses.organizationId, connection.organizationId),
				eq(taskStatuses.externalProvider, "linear"),
				eq(taskStatuses.externalId, issue.state.id),
			),
		});

		if (!taskStatus) {
			// TODO(SUPER-237): Handle new workflow states in webhooks by triggering syncWorkflowStates
			// Currently webhooks silently fail when Linear has new statuses that aren't synced yet.
			// Should either: (1) trigger workflow state sync and retry, (2) queue for retry, or (3) keep periodic sync only
			console.warn(
				`[webhook] Status not found for state ${issue.state.id}, skipping update`,
			);
			return "skipped";
		}

		let assigneeId: string | null = null;
		if (issue.assignee?.email) {
			const matchedMember = await db
				.select({ userId: users.id })
				.from(users)
				.innerJoin(members, eq(members.userId, users.id))
				.where(
					and(
						eq(users.email, issue.assignee.email),
						eq(members.organizationId, connection.organizationId),
					),
				)
				.limit(1)
				.then((rows) => rows[0]);
			assigneeId = matchedMember?.userId ?? null;
		}

		let assigneeExternalId: string | null = null;
		let assigneeDisplayName: string | null = null;
		let assigneeAvatarUrl: string | null = null;

		if (issue.assignee && !assigneeId) {
			assigneeExternalId = issue.assignee.id;
			assigneeDisplayName = issue.assignee.name ?? null;
			assigneeAvatarUrl = issue.assignee.avatarUrl ?? null;
		}

		const taskData = {
			slug: issue.identifier,
			title: issue.title,
			description: issue.description ?? null,
			statusId: taskStatus.id,
			priority: mapPriorityFromLinear(issue.priority),
			assigneeId,
			assigneeExternalId,
			assigneeDisplayName,
			assigneeAvatarUrl,
			estimate: issue.estimate ?? null,
			dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
			labels: issue.labels.map((l) => l.name),
			startedAt: issue.startedAt ? new Date(issue.startedAt) : null,
			completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
			externalProvider: "linear" as const,
			externalId: issue.id,
			externalKey: issue.identifier,
			externalUrl: issue.url,
			lastSyncedAt: new Date(),
			parentExternalId: issue.parentId ?? null,
			cycleId: issue.cycle?.id ?? null,
			cycleName: issue.cycle?.name ?? null,
			cycleNumber: issue.cycle?.number ?? null,
		};

		const [upsertedTask] = await db
			.insert(tasks)
			.values({
				...taskData,
				organizationId: connection.organizationId,
				creatorId: connection.connectedByUserId,
				createdAt: new Date(issue.createdAt),
			})
			.onConflictDoUpdate({
				target: [
					tasks.organizationId,
					tasks.externalProvider,
					tasks.externalId,
				],
				set: { ...taskData, syncError: null },
			})
			.returning({ id: tasks.id, parentExternalId: tasks.parentExternalId });

		// Attempt to resolve parentId if parentExternalId is set
		if (upsertedTask?.parentExternalId) {
			const parentTask = await db.query.tasks.findFirst({
				where: and(
					eq(tasks.organizationId, connection.organizationId),
					eq(tasks.externalProvider, "linear"),
					eq(tasks.externalId, upsertedTask.parentExternalId),
				),
				columns: { id: true },
			});
			if (parentTask) {
				await db
					.update(tasks)
					.set({ parentId: parentTask.id })
					.where(eq(tasks.id, upsertedTask.id));
			}
		}
	} else if (payload.action === "remove") {
		await db
			.update(tasks)
			.set({ deletedAt: new Date() })
			.where(
				and(
					eq(tasks.externalProvider, "linear"),
					eq(tasks.externalId, issue.id),
				),
			);
	}

	return "processed";
}

async function processCommentEvent(
	payload: EntityWebhookPayloadWithCommentData,
	connection: SelectIntegrationConnection,
): Promise<"processed" | "skipped"> {
	const comment = payload.data;

	if (payload.action === "create" || payload.action === "update") {
		// Comments without an issueId (e.g. project update comments) are not relevant
		if (!comment.issueId) {
			return "skipped";
		}

		const task = await db.query.tasks.findFirst({
			where: and(
				eq(tasks.organizationId, connection.organizationId),
				eq(tasks.externalProvider, "linear"),
				eq(tasks.externalId, comment.issueId),
			),
			columns: { id: true },
		});

		if (!task) {
			console.warn(
				`[webhook] Task not found for issue ${comment.issueId}, skipping comment`,
			);
			return "skipped";
		}

		const user = comment.user as
			| { id: string; name: string; avatarUrl?: string | null }
			| null
			| undefined;

		await db
			.insert(taskComments)
			.values({
				taskId: task.id,
				organizationId: connection.organizationId,
				externalId: comment.id,
				externalProvider: "linear",
				body: comment.body,
				authorExternalId: user?.id ?? null,
				authorName: user?.name ?? null,
				authorAvatarUrl: user?.avatarUrl ?? null,
				createdAt: new Date(comment.createdAt),
				updatedAt: new Date(comment.updatedAt),
				editedAt: comment.editedAt ? new Date(comment.editedAt) : null,
			})
			.onConflictDoUpdate({
				target: [
					taskComments.organizationId,
					taskComments.externalProvider,
					taskComments.externalId,
				],
				set: {
					body: sql`excluded.body`,
					authorExternalId: sql`excluded.author_external_id`,
					authorName: sql`excluded.author_name`,
					authorAvatarUrl: sql`excluded.author_avatar_url`,
					updatedAt: sql`excluded.updated_at`,
					editedAt: sql`excluded.edited_at`,
					deletedAt: null,
				},
			});
	} else if (payload.action === "remove") {
		await db
			.update(taskComments)
			.set({ deletedAt: new Date() })
			.where(
				and(
					eq(taskComments.organizationId, connection.organizationId),
					eq(taskComments.externalProvider, "linear"),
					eq(taskComments.externalId, comment.id),
				),
			);
	}

	return "processed";
}

async function processRelationEvent(
	payload: IssueRelationWebhookPayload,
	connection: SelectIntegrationConnection,
): Promise<"processed" | "skipped"> {
	const relation = payload.data;

	if (payload.action === "create") {
		const [sourceTask, relatedTask] = await Promise.all([
			db.query.tasks.findFirst({
				where: and(
					eq(tasks.organizationId, connection.organizationId),
					eq(tasks.externalProvider, "linear"),
					eq(tasks.externalId, relation.issueId),
				),
				columns: { id: true },
			}),
			db.query.tasks.findFirst({
				where: and(
					eq(tasks.organizationId, connection.organizationId),
					eq(tasks.externalProvider, "linear"),
					eq(tasks.externalId, relation.relatedIssueId),
				),
				columns: { id: true },
			}),
		]);

		if (!sourceTask) {
			console.warn(
				`[webhook] Source task not found for issue ${relation.issueId}, skipping relation`,
			);
			return "skipped";
		}

		const relatedTaskId = relatedTask?.id ?? null;

		await db
			.insert(taskRelations)
			.values({
				organizationId: connection.organizationId,
				taskId: sourceTask.id,
				relatedTaskId,
				relatedExternalId: relatedTaskId ? null : relation.relatedIssueId,
				type: relation.type,
				externalId: relation.id,
				externalProvider: "linear",
				createdAt: new Date(relation.createdAt),
			})
			.onConflictDoUpdate({
				target: [
					taskRelations.organizationId,
					taskRelations.externalProvider,
					taskRelations.externalId,
				],
				set: {
					taskId: sql`excluded.task_id`,
					relatedTaskId: sql`excluded.related_task_id`,
					relatedExternalId: sql`excluded.related_external_id`,
					type: sql`excluded.type`,
				},
			});
	} else if (payload.action === "remove") {
		await db
			.delete(taskRelations)
			.where(
				and(
					eq(taskRelations.organizationId, connection.organizationId),
					eq(taskRelations.externalProvider, "linear"),
					eq(taskRelations.externalId, relation.id),
				),
			);
	}

	return "processed";
}
