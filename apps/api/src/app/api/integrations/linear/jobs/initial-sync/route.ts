import { LinearClient } from "@linear/sdk";
import { buildConflictUpdateColumns, db } from "@superset/db";
import {
	integrationConnections,
	members,
	taskRelations,
	taskStatuses,
	tasks,
	users,
} from "@superset/db/schema";
import { Receiver } from "@upstash/qstash";
import { and, eq, inArray, isNull } from "drizzle-orm";
import chunk from "lodash.chunk";
import { z } from "zod";
import { env } from "@/env";
import { syncComments } from "./syncComments";
import { syncWorkflowStates } from "./syncWorkflowStates";
import { fetchAllIssues, mapIssueToTask } from "./utils";

const BATCH_SIZE = 100;

const receiver = new Receiver({
	currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

const payloadSchema = z.object({
	organizationId: z.string().min(1),
	creatorUserId: z.string().min(1),
});

export async function POST(request: Request) {
	const body = await request.text();
	const signature = request.headers.get("upstash-signature");

	// Skip signature verification in development (QStash can't reach localhost)
	const isDev = env.NODE_ENV === "development";

	if (!isDev) {
		if (!signature) {
			return Response.json({ error: "Missing signature" }, { status: 401 });
		}

		const isValid = await receiver.verify({
			body,
			signature,
			url: `${env.NEXT_PUBLIC_API_URL}/api/integrations/linear/jobs/initial-sync`,
		});

		if (!isValid) {
			return Response.json({ error: "Invalid signature" }, { status: 401 });
		}
	}

	const parsed = payloadSchema.safeParse(JSON.parse(body));
	if (!parsed.success) {
		return Response.json({ error: "Invalid payload" }, { status: 400 });
	}

	const { organizationId, creatorUserId } = parsed.data;

	const connection = await db.query.integrationConnections.findFirst({
		where: and(
			eq(integrationConnections.organizationId, organizationId),
			eq(integrationConnections.provider, "linear"),
		),
	});

	if (!connection) {
		return Response.json({ error: "No connection found", skipped: true });
	}

	const client = new LinearClient({ accessToken: connection.accessToken });
	await performInitialSync(client, organizationId, creatorUserId);

	return Response.json({ success: true });
}

async function performInitialSync(
	client: LinearClient,
	organizationId: string,
	creatorUserId: string,
) {
	await syncWorkflowStates({ client, organizationId });

	// Remap existing local tasks from default statuses to Linear statuses
	const allStatuses = await db.query.taskStatuses.findMany({
		where: eq(taskStatuses.organizationId, organizationId),
	});

	const linearStatusByType = new Map<string, string>();
	const defaultStatusIds: string[] = [];

	for (const status of allStatuses) {
		if (status.externalProvider === "linear" && status.type) {
			// Pick the first Linear status per type (lowest position)
			if (!linearStatusByType.has(status.type)) {
				linearStatusByType.set(status.type, status.id);
			}
		}
		if (!status.externalProvider) {
			defaultStatusIds.push(status.id);
		}
	}

	// Remap tasks from default statuses to matching Linear statuses
	if (defaultStatusIds.length > 0 && linearStatusByType.size > 0) {
		for (const status of allStatuses) {
			if (!status.externalProvider && status.type) {
				const linearStatusId = linearStatusByType.get(status.type);
				if (linearStatusId) {
					await db
						.update(tasks)
						.set({ statusId: linearStatusId })
						.where(
							and(
								eq(tasks.organizationId, organizationId),
								eq(tasks.statusId, status.id),
							),
						);
				}
			}
		}

		// Delete now-unused default statuses
		await db
			.delete(taskStatuses)
			.where(
				and(
					eq(taskStatuses.organizationId, organizationId),
					isNull(taskStatuses.externalProvider),
				),
			);
	}

	const statusByExternalId = new Map<string, string>();
	const linearStatuses = allStatuses.filter(
		(s) => s.externalProvider === "linear",
	);
	for (const status of linearStatuses) {
		if (status.externalId) {
			statusByExternalId.set(status.externalId, status.id);
		}
	}

	const issues = await fetchAllIssues(client);

	if (issues.length === 0) {
		return;
	}

	const assigneeEmails = [
		...new Set(
			issues.map((i) => i.assignee?.email).filter((e): e is string => !!e),
		),
	];

	const matchedUsers =
		assigneeEmails.length > 0
			? await db
					.select({ id: users.id, email: users.email })
					.from(users)
					.innerJoin(members, eq(members.userId, users.id))
					.where(
						and(
							inArray(users.email, assigneeEmails),
							eq(members.organizationId, organizationId),
						),
					)
			: [];

	const userByEmail = new Map(matchedUsers.map((u) => [u.email, u.id]));

	const taskValues = issues.map((issue) =>
		mapIssueToTask(
			issue,
			organizationId,
			creatorUserId,
			userByEmail,
			statusByExternalId,
		),
	);

	const batches = chunk(taskValues, BATCH_SIZE);

	for (const batch of batches) {
		await db
			.insert(tasks)
			.values(batch)
			.onConflictDoUpdate({
				target: [
					tasks.organizationId,
					tasks.externalProvider,
					tasks.externalId,
				],
				set: {
					...buildConflictUpdateColumns(tasks, [
						"slug",
						"title",
						"description",
						"statusId",
						"priority",
						"assigneeId",
						"assigneeExternalId",
						"assigneeDisplayName",
						"assigneeAvatarUrl",
						"estimate",
						"dueDate",
						"labels",
						"startedAt",
						"completedAt",
						"externalKey",
						"externalUrl",
						"lastSyncedAt",
						"parentExternalId",
						"cycleId",
						"cycleName",
						"cycleNumber",
					]),
					syncError: null,
				},
			});
	}

	// Second pass: resolve parentId from parentExternalId
	const issuesWithParent = issues.filter((i) => i.parent?.id);
	if (issuesWithParent.length > 0) {
		const parentExternalIds = [
			...new Set(issuesWithParent.map((i) => i.parent?.id)),
		];

		const parentTasks = await db
			.select({ id: tasks.id, externalId: tasks.externalId })
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, organizationId),
					eq(tasks.externalProvider, "linear"),
					inArray(tasks.externalId, parentExternalIds),
				),
			);

		const parentIdByExternalId = new Map(
			parentTasks.map((t) => [t.externalId, t.id]),
		);

		for (const issue of issuesWithParent) {
			const parentId = parentIdByExternalId.get(issue.parent?.id);
			if (!parentId) continue;
			await db
				.update(tasks)
				.set({ parentId })
				.where(
					and(
						eq(tasks.organizationId, organizationId),
						eq(tasks.externalProvider, "linear"),
						eq(tasks.externalId, issue.id),
					),
				);
		}
	}

	// Sync comments
	await syncComments(issues, organizationId);

	// Sync relations
	const issuesWithRelations = issues.filter(
		(i) => i.relations.nodes.length > 0,
	);
	if (issuesWithRelations.length > 0) {
		const allExternalIds = [
			...new Set([
				...issuesWithRelations.map((i) => i.id),
				...issuesWithRelations.flatMap((i) =>
					i.relations.nodes.map((r) => r.relatedIssue.id),
				),
			]),
		];

		const relatedTasks = await db
			.select({ id: tasks.id, externalId: tasks.externalId })
			.from(tasks)
			.where(
				and(
					eq(tasks.organizationId, organizationId),
					eq(tasks.externalProvider, "linear"),
					inArray(tasks.externalId, allExternalIds),
				),
			);

		const taskIdByExternalId = new Map(
			relatedTasks.map((t) => [t.externalId, t.id]),
		);

		const relationValues: (typeof taskRelations.$inferInsert)[] = [];

		for (const issue of issuesWithRelations) {
			const taskId = taskIdByExternalId.get(issue.id);
			if (!taskId) continue;

			for (const relation of issue.relations.nodes) {
				const relatedTaskId =
					taskIdByExternalId.get(relation.relatedIssue.id) ?? null;
				relationValues.push({
					organizationId,
					taskId,
					relatedTaskId,
					relatedExternalId: relatedTaskId ? null : relation.relatedIssue.id,
					type: relation.type,
					externalId: relation.id,
					externalProvider: "linear",
					createdAt: new Date(),
				});
			}
		}

		if (relationValues.length > 0) {
			const relationBatches = chunk(relationValues, BATCH_SIZE);
			for (const batch of relationBatches) {
				await db
					.insert(taskRelations)
					.values(batch)
					.onConflictDoUpdate({
						target: [
							taskRelations.organizationId,
							taskRelations.externalProvider,
							taskRelations.externalId,
						],
						set: buildConflictUpdateColumns(taskRelations, [
							"taskId",
							"relatedTaskId",
							"relatedExternalId",
							"type",
						]),
					});
			}
		}
	}
}
