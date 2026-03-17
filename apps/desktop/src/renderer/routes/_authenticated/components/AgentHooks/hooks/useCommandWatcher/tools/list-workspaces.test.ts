import { describe, expect, it } from "bun:test";
import type { SelectProject, SelectWorkspace } from "@superset/local-db";
import { buildWorkspaceList } from "./list-workspaces.utils";
import type { WorkspaceListGroup } from "./types";

describe("buildWorkspaceList", () => {
	it("returns compact workspace summaries with resolved paths and active state", () => {
		const workspaces = [
			{
				id: "workspace-worktree",
				projectId: "project-1",
				worktreeId: "worktree-1",
				type: "worktree",
				branch: "feature/mcp-fix",
				name: "MCP Fix",
				tabOrder: 1,
				createdAt: 1,
				updatedAt: 1,
				lastOpenedAt: 1,
				isUnread: false,
				isUnnamed: false,
				deletingAt: null,
				portBase: null,
				sectionId: null,
			},
			{
				id: "workspace-branch",
				projectId: "project-1",
				worktreeId: null,
				type: "branch",
				branch: "main",
				name: "Main",
				tabOrder: 2,
				createdAt: 2,
				updatedAt: 2,
				lastOpenedAt: 2,
				isUnread: false,
				isUnnamed: false,
				deletingAt: null,
				portBase: null,
				sectionId: null,
			},
		] satisfies SelectWorkspace[];

		const projects = [
			{
				id: "project-1",
				name: "Superset",
				mainRepoPath: "/repos/superset",
				defaultBranch: "main",
				workspaceBaseBranch: null,
				color: "#000000",
				tabOrder: 1,
				lastOpenedAt: 1,
				githubOwner: null,
				iconUrl: null,
				hideImage: false,
				createdAt: 1,
			},
		] as unknown as SelectProject[];

		const groupedWorkspaces = [
			{
				project: {
					id: "project-1",
					mainRepoPath: "/repos/superset",
				},
				workspaces: [
					{
						id: "workspace-worktree",
						worktreePath: "/repos/superset-feature-mcp-fix",
					},
				],
				sections: [],
			},
		] satisfies WorkspaceListGroup[];

		expect(
			buildWorkspaceList({
				workspaces,
				projects,
				groupedWorkspaces,
				activeWorkspaceId: "workspace-worktree",
			}),
		).toEqual([
			{
				id: "workspace-worktree",
				name: "MCP Fix",
				path: "/repos/superset-feature-mcp-fix",
				branch: "feature/mcp-fix",
				isActive: true,
				projectId: "project-1",
				type: "worktree",
			},
			{
				id: "workspace-branch",
				name: "Main",
				path: "/repos/superset",
				branch: "main",
				isActive: false,
				projectId: "project-1",
				type: "branch",
			},
		]);
	});

	it("falls back to an empty path when a worktree path is unavailable", () => {
		const workspaces = [
			{
				id: "workspace-worktree",
				projectId: "project-1",
				worktreeId: "worktree-1",
				type: "worktree",
				branch: "feature/missing-path",
				name: "Missing Path",
				tabOrder: 1,
				createdAt: 1,
				updatedAt: 1,
				lastOpenedAt: 1,
				isUnread: false,
				isUnnamed: false,
				deletingAt: null,
				portBase: null,
				sectionId: null,
			},
		] satisfies SelectWorkspace[];

		expect(
			buildWorkspaceList({
				workspaces,
				activeWorkspaceId: null,
			}),
		).toEqual([
			{
				id: "workspace-worktree",
				name: "Missing Path",
				path: "",
				branch: "feature/missing-path",
				isActive: false,
				projectId: "project-1",
				type: "worktree",
			},
		]);
	});
});
