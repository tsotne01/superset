import { execGitWithShellPath } from "../../workspaces/utils/git-client";
import {
	getPRForBranch,
	getPullRequestRepoArgs,
	getRepoContext,
} from "../../workspaces/utils/github";
import { execWithShellEnv } from "../../workspaces/utils/shell-env";
import { isNoPullRequestFoundMessage } from "../git-utils";
import { clearWorktreeStatusCaches } from "./worktree-status-caches";

export type ReviewEvent = "approve" | "request-changes" | "comment";

export interface SubmitReviewInput {
	worktreePath: string;
	event: ReviewEvent;
	body?: string;
}

const GH_EVENT_FLAGS: Record<ReviewEvent, string> = {
	approve: "--approve",
	"request-changes": "--request-changes",
	comment: "--comment",
};

export async function submitReview({
	worktreePath,
	event,
	body,
}: SubmitReviewInput): Promise<{ success: boolean }> {
	const eventFlag = GH_EVENT_FLAGS[event];

	const buildArgs = (prNumber?: number, repoArgs?: string[]): string[] => {
		const args = ["pr", "review"];
		if (prNumber) {
			args.push(String(prNumber));
		}
		args.push(eventFlag);
		if (body) {
			args.push("--body", body);
		}
		if (repoArgs) {
			args.push(...repoArgs);
		}
		return args;
	};

	const runReview = async (args: string[]): Promise<{ success: boolean }> => {
		await execWithShellEnv("gh", args, { cwd: worktreePath });
		clearWorktreeStatusCaches(worktreePath);
		return { success: true };
	};

	const repoContext = await getRepoContext(worktreePath);
	if (!repoContext) {
		return runReview(buildArgs());
	}

	let pr: Awaited<ReturnType<typeof getPRForBranch>> = null;
	try {
		const [{ stdout: branchOutput }, { stdout: headOutput }] =
			await Promise.all([
				execGitWithShellPath(["rev-parse", "--abbrev-ref", "HEAD"], {
					cwd: worktreePath,
				}),
				execGitWithShellPath(["rev-parse", "HEAD"], { cwd: worktreePath }),
			]);
		pr = await getPRForBranch(
			worktreePath,
			branchOutput.trim(),
			repoContext,
			headOutput.trim(),
		);
	} catch (error) {
		console.warn("[git/submitReview] PR resolution failed; falling back.", {
			worktreePath,
			error: error instanceof Error ? error.message : String(error),
		});
		return runReview(buildArgs());
	}

	if (!pr) {
		return runReview(buildArgs());
	}

	try {
		return await runReview(
			buildArgs(pr.number, getPullRequestRepoArgs(repoContext)),
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (isNoPullRequestFoundMessage(message)) {
			return runReview(buildArgs());
		}
		throw error;
	}
}
