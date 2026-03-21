import type { GitHubStatus } from "@superset/local-db";
import { Avatar, AvatarFallback } from "@superset/ui/avatar";
import { cn } from "@superset/ui/utils";
import {
	LuArrowUpRight,
	LuCheck,
	LuLoaderCircle,
	LuMessageSquareText,
	LuMinus,
	LuX,
} from "react-icons/lu";
import { PRIcon } from "renderer/screens/main/components/PRIcon";

interface ReviewPanelProps {
	pr: GitHubStatus["pr"] | null;
}

const reviewDecisionConfig = {
	approved: {
		label: "Approved",
		className:
			"border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	},
	changes_requested: {
		label: "Changes requested",
		className:
			"border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
	},
	pending: {
		label: "Review pending",
		className:
			"border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	},
} as const;

const checkIconConfig = {
	success: {
		icon: LuCheck,
		className: "text-emerald-600 dark:text-emerald-400",
		label: "Passed",
	},
	failure: {
		icon: LuX,
		className: "text-red-600 dark:text-red-400",
		label: "Failed",
	},
	pending: {
		icon: LuLoaderCircle,
		className: "text-amber-600 dark:text-amber-400",
		label: "Pending",
	},
	skipped: {
		icon: LuMinus,
		className: "text-muted-foreground",
		label: "Skipped",
	},
	cancelled: {
		icon: LuMinus,
		className: "text-muted-foreground",
		label: "Cancelled",
	},
} as const;

const checkSummaryIconConfig = {
	success: checkIconConfig.success,
	failure: checkIconConfig.failure,
	pending: checkIconConfig.pending,
	none: {
		icon: LuMinus,
		className: "text-muted-foreground",
		label: "No checks",
	},
} as const;

const prStateLabel = {
	open: "Open",
	draft: "Draft",
	merged: "Merged",
	closed: "Closed",
} as const;

function getCommentPreview(body: string): string {
	return (
		body
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find(Boolean)
			?.replace(/\s+/g, " ") ?? "No preview available"
	);
}

function getAvatarFallback(authorLogin: string): string {
	return authorLogin.slice(0, 2).toUpperCase();
}

function formatShortAge(timestamp?: number): string | null {
	if (!timestamp || Number.isNaN(timestamp)) {
		return null;
	}

	const deltaMs = Math.max(0, Date.now() - timestamp);
	const deltaSeconds = Math.round(deltaMs / 1000);

	if (deltaSeconds < 60) {
		return `${Math.max(1, deltaSeconds)}s`;
	}

	const deltaMinutes = Math.round(deltaSeconds / 60);
	if (deltaMinutes < 60) {
		return `${deltaMinutes}m`;
	}

	const deltaHours = Math.round(deltaMinutes / 60);
	if (deltaHours < 24) {
		return `${deltaHours}h`;
	}

	return `${Math.round(deltaHours / 24)}d`;
}

export function ReviewPanel({ pr }: ReviewPanelProps) {
	if (!pr) {
		return (
			<div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
				Open a pull request to view review status, checks, and comments.
			</div>
		);
	}

	const requestedReviewers = pr.requestedReviewers ?? [];
	const reviewLabel =
		pr.reviewDecision === "pending" && requestedReviewers.length > 0
			? `Awaiting ${requestedReviewers.join(", ")}`
			: reviewDecisionConfig[pr.reviewDecision].label;

	const relevantChecks = pr.checks.filter(
		(check) => check.status !== "skipped" && check.status !== "cancelled",
	);
	const passingChecks = relevantChecks.filter(
		(check) => check.status === "success",
	).length;
	const checksSummary =
		relevantChecks.length > 0
			? `${passingChecks}/${relevantChecks.length} checks passing`
			: "No checks reported";
	const checksStatusConfig = checkSummaryIconConfig[pr.checksStatus];
	const ChecksStatusIcon = checksStatusConfig.icon;
	const comments = pr.comments ?? [];

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<div className="border-b border-border/70 px-2 py-2.5">
				<div className="flex items-center gap-2">
					<PRIcon state={pr.state} className="size-4 shrink-0" />
					<a
						href={pr.url}
						target="_blank"
						rel="noopener noreferrer"
						className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
						title={pr.title}
					>
						{pr.title}
					</a>
					<span className="shrink-0 font-mono text-xs text-muted-foreground">
						#{pr.number}
					</span>
				</div>

				<div className="mt-2 flex items-center gap-2">
					<span
						className={cn(
							"shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
							reviewDecisionConfig[pr.reviewDecision].className,
						)}
					>
						{reviewDecisionConfig[pr.reviewDecision].label}
					</span>
					<span className="truncate text-xs text-muted-foreground">
						{requestedReviewers.length > 0
							? reviewLabel
							: prStateLabel[pr.state]}
					</span>
				</div>
			</div>

			<div className="px-2 pt-3">
				<div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
					<span>Checks</span>
					<div
						className={cn(
							"flex items-center gap-1.5",
							checksStatusConfig.className,
						)}
					>
						<ChecksStatusIcon
							className={cn(
								"size-3.5",
								pr.checksStatus === "pending" && "animate-spin",
							)}
						/>
						<span className="normal-case">{checksSummary}</span>
					</div>
				</div>
			</div>

			<div className="px-1 pt-1">
				{relevantChecks.length === 0 ? (
					<div className="px-2 py-2 text-sm text-muted-foreground">
						No active checks reported for this pull request yet.
					</div>
				) : (
					relevantChecks.map((check) => {
						const { icon: CheckIcon, className } =
							checkIconConfig[check.status];

						return check.url ? (
							<a
								key={check.name}
								href={check.url}
								target="_blank"
								rel="noopener noreferrer"
								className="block"
							>
								<div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/35">
									<CheckIcon
										className={cn(
											"size-3.5 shrink-0",
											className,
											check.status === "pending" && "animate-spin",
										)}
									/>
									<span className="min-w-0 flex-1 truncate">{check.name}</span>
									{check.durationText && (
										<span className="shrink-0 text-muted-foreground">
											{check.durationText}
										</span>
									)}
									<LuArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/70" />
								</div>
							</a>
						) : (
							<div
								key={check.name}
								className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm"
							>
								<CheckIcon
									className={cn(
										"size-3.5 shrink-0",
										className,
										check.status === "pending" && "animate-spin",
									)}
								/>
								<span className="min-w-0 flex-1 truncate">{check.name}</span>
								{check.durationText && (
									<span className="shrink-0 text-muted-foreground">
										{check.durationText}
									</span>
								)}
							</div>
						);
					})
				)}
			</div>

			<div className="px-2 pt-4">
				<div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
					<div className="flex items-center gap-1.5">
						<LuMessageSquareText className="size-3.5" />
						<span>Comments</span>
					</div>
					<span className="normal-case">{comments.length}</span>
				</div>
			</div>

			<div className="px-1 py-1">
				{comments.length === 0 ? (
					<div className="px-2 py-2 text-sm text-muted-foreground">
						No comments yet.
					</div>
				) : (
					comments.map((comment) => (
						<a
							key={comment.id}
							href={comment.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent/35"
						>
							<Avatar className="size-5">
								<AvatarFallback className="text-[10px] font-medium">
									{getAvatarFallback(comment.authorLogin)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="truncate text-sm font-medium text-foreground">
										{comment.authorLogin}
									</span>
									{formatShortAge(comment.createdAt) && (
										<span className="shrink-0 text-xs text-muted-foreground">
											{formatShortAge(comment.createdAt)}
										</span>
									)}
								</div>
								<p className="truncate text-xs text-muted-foreground">
									{getCommentPreview(comment.body)}
								</p>
							</div>
							<LuArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/70" />
						</a>
					))
				)}
			</div>
		</div>
	);
}
