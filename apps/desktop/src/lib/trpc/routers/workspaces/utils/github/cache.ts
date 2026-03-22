import type { GitHubStatus, PullRequestComment } from "@superset/local-db";
import type { RepoContext } from "./types";

const GITHUB_STATUS_CACHE_TTL_MS = 10_000;
const GITHUB_PR_COMMENTS_CACHE_TTL_MS = 30_000;
const GITHUB_REPO_CONTEXT_CACHE_TTL_MS = 300_000;

const MAX_GITHUB_STATUS_CACHE_ENTRIES = 256;
const MAX_GITHUB_PR_COMMENTS_CACHE_ENTRIES = 512;
const MAX_GITHUB_REPO_CONTEXT_CACHE_ENTRIES = 256;

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

interface CacheState<T> {
	value: T;
	isFresh: boolean;
}

interface InFlightEntry<T> {
	promise: Promise<T>;
	requestId: number;
}

const githubStatusCache = new Map<string, CacheEntry<GitHubStatus>>();
const githubStatusInFlight = new Map<
	string,
	InFlightEntry<GitHubStatus | null>
>();
const githubStatusRequestIds = new Map<string, number>();

const pullRequestCommentsCache = new Map<
	string,
	CacheEntry<PullRequestComment[]>
>();
const pullRequestCommentsInFlight = new Map<
	string,
	InFlightEntry<PullRequestComment[]>
>();
const pullRequestCommentsRequestIds = new Map<string, number>();

const repoContextCache = new Map<string, CacheEntry<RepoContext>>();
const repoContextInFlight = new Map<string, InFlightEntry<RepoContext | null>>();
const repoContextRequestIds = new Map<string, number>();

function getCachedValueState<T>(
	cache: Map<string, CacheEntry<T>>,
	cacheKey: string,
): CacheState<T> | null {
	const cached = cache.get(cacheKey);
	if (!cached) {
		return null;
	}

	return {
		value: cached.value,
		isFresh: cached.expiresAt > Date.now(),
	};
}

function getCachedValue<T>(
	cache: Map<string, CacheEntry<T>>,
	cacheKey: string,
): T | null {
	const cached = getCachedValueState(cache, cacheKey);
	return cached?.isFresh ? cached.value : null;
}

function setCachedValue<T>(
	cache: Map<string, CacheEntry<T>>,
	cacheKey: string,
	value: T,
	ttlMs: number,
	maxEntries: number,
): void {
	if (!cache.has(cacheKey) && cache.size >= maxEntries) {
		cache.clear();
	}

	cache.set(cacheKey, {
		value,
		expiresAt: Date.now() + ttlMs,
	});
}

function clearEntriesWithPrefix<T>(
	cache: Map<string, T>,
	cacheKeyPrefix: string,
): void {
	for (const cacheKey of cache.keys()) {
		if (cacheKey.startsWith(cacheKeyPrefix)) {
			cache.delete(cacheKey);
		}
	}
}

function createRequestId(
	requestIds: Map<string, number>,
	cacheKey: string,
): number {
	const requestId = (requestIds.get(cacheKey) ?? 0) + 1;
	requestIds.set(cacheKey, requestId);
	return requestId;
}

function isCurrentRequest(
	requestIds: Map<string, number>,
	cacheKey: string,
	requestId: number,
): boolean {
	return (requestIds.get(cacheKey) ?? 0) === requestId;
}

function invalidateRequest(
	requestIds: Map<string, number>,
	cacheKey: string,
): void {
	requestIds.set(cacheKey, (requestIds.get(cacheKey) ?? 0) + 1);
}

function invalidateRequestsWithPrefix(
	requestIds: Map<string, number>,
	cacheKeyPrefix: string,
): void {
	for (const cacheKey of requestIds.keys()) {
		if (cacheKey.startsWith(cacheKeyPrefix)) {
			invalidateRequest(requestIds, cacheKey);
		}
	}
}

function getInFlightValue<T>(
	inFlight: Map<string, InFlightEntry<T>>,
	cacheKey: string,
): Promise<T> | null {
	return inFlight.get(cacheKey)?.promise ?? null;
}

function setInFlightValue<T>(
	inFlight: Map<string, InFlightEntry<T>>,
	cacheKey: string,
	promise: Promise<T>,
	requestId: number,
): void {
	inFlight.set(cacheKey, { promise, requestId });
}

function clearInFlightValue<T>(
	inFlight: Map<string, InFlightEntry<T>>,
	cacheKey: string,
	requestId: number,
): void {
	const entry = inFlight.get(cacheKey);
	if (entry?.requestId === requestId) {
		inFlight.delete(cacheKey);
	}
}

export function getCachedGitHubStatus(
	worktreePath: string,
): GitHubStatus | null {
	return getCachedValue(githubStatusCache, worktreePath);
}

export function getCachedGitHubStatusState(
	worktreePath: string,
): CacheState<GitHubStatus> | null {
	return getCachedValueState(githubStatusCache, worktreePath);
}

export function setCachedGitHubStatus(
	worktreePath: string,
	value: GitHubStatus,
): void {
	setCachedValue(
		githubStatusCache,
		worktreePath,
		value,
		GITHUB_STATUS_CACHE_TTL_MS,
		MAX_GITHUB_STATUS_CACHE_ENTRIES,
	);
}

export function getInFlightGitHubStatus(
	worktreePath: string,
): Promise<GitHubStatus | null> | null {
	return getInFlightValue(githubStatusInFlight, worktreePath);
}

export function createGitHubStatusRequestId(worktreePath: string): number {
	return createRequestId(githubStatusRequestIds, worktreePath);
}

export function isCurrentGitHubStatusRequest(
	worktreePath: string,
	requestId: number,
): boolean {
	return isCurrentRequest(githubStatusRequestIds, worktreePath, requestId);
}

export function setInFlightGitHubStatus(
	worktreePath: string,
	promise: Promise<GitHubStatus | null>,
	requestId: number,
): void {
	setInFlightValue(githubStatusInFlight, worktreePath, promise, requestId);
}

export function clearInFlightGitHubStatus(
	worktreePath: string,
	requestId: number,
): void {
	clearInFlightValue(githubStatusInFlight, worktreePath, requestId);
}

export function makePullRequestCommentsCachePrefix(
	worktreePath: string,
): string {
	return `${worktreePath}::comments::`;
}

export function makePullRequestCommentsCacheKey({
	worktreePath,
	repoNameWithOwner,
	pullRequestNumber,
}: {
	worktreePath: string;
	repoNameWithOwner: string;
	pullRequestNumber: number;
}): string {
	return `${makePullRequestCommentsCachePrefix(worktreePath)}${repoNameWithOwner}#${pullRequestNumber}`;
}

export function getCachedPullRequestComments(
	cacheKey: string,
): PullRequestComment[] | null {
	return getCachedValue(pullRequestCommentsCache, cacheKey);
}

export function getCachedPullRequestCommentsState(
	cacheKey: string,
): CacheState<PullRequestComment[]> | null {
	return getCachedValueState(pullRequestCommentsCache, cacheKey);
}

export function setCachedPullRequestComments(
	cacheKey: string,
	value: PullRequestComment[],
): void {
	setCachedValue(
		pullRequestCommentsCache,
		cacheKey,
		value,
		GITHUB_PR_COMMENTS_CACHE_TTL_MS,
		MAX_GITHUB_PR_COMMENTS_CACHE_ENTRIES,
	);
}

export function getInFlightPullRequestComments(
	cacheKey: string,
): Promise<PullRequestComment[]> | null {
	return getInFlightValue(pullRequestCommentsInFlight, cacheKey);
}

export function createPullRequestCommentsRequestId(cacheKey: string): number {
	return createRequestId(pullRequestCommentsRequestIds, cacheKey);
}

export function isCurrentPullRequestCommentsRequest(
	cacheKey: string,
	requestId: number,
): boolean {
	return isCurrentRequest(pullRequestCommentsRequestIds, cacheKey, requestId);
}

export function setInFlightPullRequestComments(
	cacheKey: string,
	promise: Promise<PullRequestComment[]>,
	requestId: number,
): void {
	setInFlightValue(pullRequestCommentsInFlight, cacheKey, promise, requestId);
}

export function clearInFlightPullRequestComments(
	cacheKey: string,
	requestId: number,
): void {
	clearInFlightValue(pullRequestCommentsInFlight, cacheKey, requestId);
}

export function getCachedRepoContext(worktreePath: string): RepoContext | null {
	return getCachedValue(repoContextCache, worktreePath);
}

export function getCachedRepoContextState(
	worktreePath: string,
): CacheState<RepoContext> | null {
	return getCachedValueState(repoContextCache, worktreePath);
}

export function setCachedRepoContext(
	worktreePath: string,
	value: RepoContext,
): void {
	setCachedValue(
		repoContextCache,
		worktreePath,
		value,
		GITHUB_REPO_CONTEXT_CACHE_TTL_MS,
		MAX_GITHUB_REPO_CONTEXT_CACHE_ENTRIES,
	);
}

export function getInFlightRepoContext(
	worktreePath: string,
): Promise<RepoContext | null> | null {
	return getInFlightValue(repoContextInFlight, worktreePath);
}

export function createRepoContextRequestId(worktreePath: string): number {
	return createRequestId(repoContextRequestIds, worktreePath);
}

export function isCurrentRepoContextRequest(
	worktreePath: string,
	requestId: number,
): boolean {
	return isCurrentRequest(repoContextRequestIds, worktreePath, requestId);
}

export function setInFlightRepoContext(
	worktreePath: string,
	promise: Promise<RepoContext | null>,
	requestId: number,
): void {
	setInFlightValue(repoContextInFlight, worktreePath, promise, requestId);
}

export function clearInFlightRepoContext(
	worktreePath: string,
	requestId: number,
): void {
	clearInFlightValue(repoContextInFlight, worktreePath, requestId);
}

export function clearGitHubCachesForWorktree(worktreePath: string): void {
	githubStatusCache.delete(worktreePath);
	githubStatusInFlight.delete(worktreePath);
	invalidateRequest(githubStatusRequestIds, worktreePath);
	repoContextCache.delete(worktreePath);
	repoContextInFlight.delete(worktreePath);
	invalidateRequest(repoContextRequestIds, worktreePath);

	const commentsCachePrefix = makePullRequestCommentsCachePrefix(worktreePath);
	clearEntriesWithPrefix(pullRequestCommentsCache, commentsCachePrefix);
	clearEntriesWithPrefix(pullRequestCommentsInFlight, commentsCachePrefix);
	invalidateRequestsWithPrefix(
		pullRequestCommentsRequestIds,
		commentsCachePrefix,
	);
}
