import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { ActivityItem } from "./components/ActivityItem";

interface ActivitySectionProps {
	taskId: string;
	createdAt: Date;
	creatorName: string;
	creatorAvatarUrl?: string | null;
}

export function ActivitySection({
	taskId,
	createdAt,
	creatorName,
	creatorAvatarUrl,
}: ActivitySectionProps) {
	const { data: comments } = useQuery({
		queryKey: ["task-comments", taskId],
		queryFn: () => apiTrpcClient.task.getComments.query(taskId),
	});

	return (
		<div className="space-y-4">
			<ActivityItem
				avatarUrl={creatorAvatarUrl}
				avatarFallback={creatorName.charAt(0).toUpperCase()}
				actorName={creatorName}
				action="created the issue"
				timestamp={createdAt}
			/>
			{comments?.map((comment) => (
				<div key={comment.id} className="flex items-start gap-3">
					{comment.authorAvatarUrl ? (
						<img
							src={comment.authorAvatarUrl}
							alt=""
							className="w-6 h-6 rounded-full shrink-0 mt-0.5"
						/>
					) : (
						<div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
							{(comment.authorName ?? "?").charAt(0).toUpperCase()}
						</div>
					)}
					<div className="flex-1 min-w-0">
						<div className="text-sm">
							<span className="font-medium text-foreground">
								{comment.authorName ?? "Unknown"}
							</span>
							<span className="text-muted-foreground">
								{" "}
								commented ·{" "}
								{formatDistanceToNow(new Date(comment.createdAt), {
									addSuffix: true,
								})}
							</span>
						</div>
						<div className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
							{comment.body}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
