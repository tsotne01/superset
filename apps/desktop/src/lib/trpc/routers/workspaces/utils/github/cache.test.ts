import { describe, expect, test } from "bun:test";
import type { GitHubStatus, PullRequestComment } from "@superset/local-db";
import {
	clearInFlightGitHubStatus,
	clearGitHubCachesForWorktree,
	createGitHubStatusRequestId,
	createPullRequestCommentsRequestId,
	createRepoContextRequestId,
	getCachedGitHubStatus,
	getCachedGitHubStatusState,
	getInFlightGitHubStatus,
	getCachedPullRequestComments,
	getCachedRepoContext,
	isCurrentGitHubStatusRequest,
	isCurrentPullRequestCommentsRequest,
	isCurrentRepoContextRequest,
	makePullRequestCommentsCacheKey,
	setInFlightGitHubStatus,
	setCachedGitHubStatus,
	setCachedPullRequestComments,
	setCachedRepoContext,
} from "./cache";

describe("clearGitHubCachesForWorktree", () => {
	test("clears status, repo context, and comment entries for one worktree", () => {
		const worktreePath = "/tmp/worktrees/review-cache-test";
		const otherWorktreePath = "/tmp/worktrees/review-cache-test-other";

		const status: GitHubStatus = {
			pr: null,
			repoUrl: "https://github.com/superset-sh/superset",
			upstreamUrl: "https://github.com/superset-sh/superset",
			isFork: false,
			branchExistsOnRemote: true,
			lastRefreshed: Date.now(),
		};
		const comments: PullRequestComment[] = [
			{
				id: "review-1",
				authorLogin: "octocat",
				body: "Looks good",
				kind: "review",
			},
		];

		setCachedGitHubStatus(worktreePath, status);
		setCachedRepoContext(worktreePath, {
			repoUrl: "https://github.com/superset-sh/superset",
			upstreamUrl: "https://github.com/superset-sh/superset",
			isFork: false,
		});

		const commentsCacheKey = makePullRequestCommentsCacheKey({
			worktreePath,
			repoNameWithOwner: "superset-sh/superset",
			pullRequestNumber: 2681,
		});
		const otherCommentsCacheKey = makePullRequestCommentsCacheKey({
			worktreePath: otherWorktreePath,
			repoNameWithOwner: "superset-sh/superset",
			pullRequestNumber: 2682,
		});

		setCachedPullRequestComments(commentsCacheKey, comments);
		setCachedPullRequestComments(otherCommentsCacheKey, comments);

		clearGitHubCachesForWorktree(worktreePath);

		expect(getCachedGitHubStatus(worktreePath)).toBeNull();
		expect(getCachedRepoContext(worktreePath)).toBeNull();
		expect(getCachedPullRequestComments(commentsCacheKey)).toBeNull();
		expect(getCachedPullRequestComments(otherCommentsCacheKey)).toEqual(
			comments,
		);

		clearGitHubCachesForWorktree(otherWorktreePath);
	});
});

describe("getCachedGitHubStatusState", () => {
	test("returns stale cache entries without treating them as fresh", () => {
		const worktreePath = "/tmp/worktrees/review-cache-stale-test";
		const status: GitHubStatus = {
			pr: null,
			repoUrl: "https://github.com/superset-sh/superset",
			upstreamUrl: "https://github.com/superset-sh/superset",
			isFork: false,
			branchExistsOnRemote: true,
			lastRefreshed: 1000,
		};

		const originalDateNow = Date.now;
		Date.now = () => 1000;

		try {
			setCachedGitHubStatus(worktreePath, status);

			Date.now = () => 1000 + 10_001;

			expect(getCachedGitHubStatus(worktreePath)).toBeNull();
			expect(getCachedGitHubStatusState(worktreePath)).toEqual({
				value: status,
				isFresh: false,
			});
		} finally {
			Date.now = originalDateNow;
			clearGitHubCachesForWorktree(worktreePath);
		}
	});
});

describe("request invalidation", () => {
	test("invalidates status, repo context, and comments requests on cache clear", () => {
		const worktreePath = "/tmp/worktrees/review-cache-invalidation-test";
		const commentsCacheKey = makePullRequestCommentsCacheKey({
			worktreePath,
			repoNameWithOwner: "superset-sh/superset",
			pullRequestNumber: 2724,
		});

		const statusRequestId = createGitHubStatusRequestId(worktreePath);
		const repoContextRequestId = createRepoContextRequestId(worktreePath);
		const commentsRequestId = createPullRequestCommentsRequestId(commentsCacheKey);

		expect(isCurrentGitHubStatusRequest(worktreePath, statusRequestId)).toBe(
			true,
		);
		expect(
			isCurrentRepoContextRequest(worktreePath, repoContextRequestId),
		).toBe(true);
		expect(
			isCurrentPullRequestCommentsRequest(commentsCacheKey, commentsRequestId),
		).toBe(true);

		clearGitHubCachesForWorktree(worktreePath);

		expect(isCurrentGitHubStatusRequest(worktreePath, statusRequestId)).toBe(
			false,
		);
		expect(
			isCurrentRepoContextRequest(worktreePath, repoContextRequestId),
		).toBe(false);
		expect(
			isCurrentPullRequestCommentsRequest(commentsCacheKey, commentsRequestId),
		).toBe(false);
	});

	test("does not let an older status refresh clear a newer in-flight request", () => {
		const worktreePath = "/tmp/worktrees/review-cache-request-order-test";
		const olderPromise = Promise.resolve<GitHubStatus | null>(null);
		const newerPromise = Promise.resolve<GitHubStatus | null>({
			pr: null,
			repoUrl: "https://github.com/superset-sh/superset",
			upstreamUrl: "https://github.com/superset-sh/superset",
			isFork: false,
			branchExistsOnRemote: true,
			lastRefreshed: Date.now(),
		});

		const olderRequestId = createGitHubStatusRequestId(worktreePath);
		setInFlightGitHubStatus(worktreePath, olderPromise, olderRequestId);

		const newerRequestId = createGitHubStatusRequestId(worktreePath);
		setInFlightGitHubStatus(worktreePath, newerPromise, newerRequestId);

		clearInFlightGitHubStatus(worktreePath, olderRequestId);

		expect(getInFlightGitHubStatus(worktreePath)).toBe(newerPromise);

		clearInFlightGitHubStatus(worktreePath, newerRequestId);
		clearGitHubCachesForWorktree(worktreePath);
	});
});
