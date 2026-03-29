import { db } from "@superset/db/client";
import { taskComments, tasks } from "@superset/db/schema";
import { getLinearClient } from "@superset/trpc/integrations/linear";
import { Receiver } from "@upstash/qstash";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";

const receiver = new Receiver({
	currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

const payloadSchema = z.object({
	commentId: z.string().min(1),
});

export async function POST(request: Request) {
	const body = await request.text();
	const signature = request.headers.get("upstash-signature");

	if (!signature) {
		return Response.json({ error: "Missing signature" }, { status: 401 });
	}

	try {
		const isValid = await receiver.verify({
			body,
			signature,
			url: `${env.NEXT_PUBLIC_API_URL}/api/integrations/linear/jobs/sync-comment`,
		});

		if (!isValid) {
			return Response.json({ error: "Invalid signature" }, { status: 401 });
		}
	} catch (verifyError) {
		console.error("[sync-comment] Signature verification failed:", verifyError);
		return Response.json(
			{ error: "Signature verification failed" },
			{ status: 401 },
		);
	}

	const parsed = payloadSchema.safeParse(JSON.parse(body));
	if (!parsed.success) {
		return Response.json({ error: "Invalid payload" }, { status: 400 });
	}

	const { commentId } = parsed.data;

	const comment = await db.query.taskComments.findFirst({
		where: eq(taskComments.id, commentId),
	});

	if (!comment) {
		return Response.json({ error: "Comment not found", skipped: true });
	}

	// Only sync comments that haven't been pushed to Linear yet
	if (comment.externalProvider === "linear") {
		return Response.json({ success: true, skipped: true, reason: "already synced" });
	}

	const task = await db.query.tasks.findFirst({
		where: and(
			eq(tasks.id, comment.taskId),
			eq(tasks.externalProvider, "linear"),
		),
		columns: { externalId: true, organizationId: true },
	});

	if (!task?.externalId) {
		return Response.json({ error: "Task not linked to Linear", skipped: true });
	}

	const client = await getLinearClient(task.organizationId);
	if (!client) {
		return Response.json({ error: "No Linear connection found" }, { status: 500 });
	}

	try {
		const result = await client.createComment({
			issueId: task.externalId,
			body: comment.body,
		});

		if (!result.success) {
			return Response.json({ error: "Failed to create Linear comment" }, { status: 500 });
		}

		const linearComment = await result.comment;
		if (!linearComment) {
			return Response.json({ error: "Comment not returned from Linear" }, { status: 500 });
		}

		// Update local comment to reflect it's now in Linear
		await db
			.update(taskComments)
			.set({
				externalId: linearComment.id,
				externalProvider: "linear",
				updatedAt: new Date(),
			})
			.where(eq(taskComments.id, commentId));

		return Response.json({ success: true, externalId: linearComment.id });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("[sync-comment] Failed to create comment in Linear:", errorMessage);
		return Response.json({ error: errorMessage }, { status: 500 });
	}
}
