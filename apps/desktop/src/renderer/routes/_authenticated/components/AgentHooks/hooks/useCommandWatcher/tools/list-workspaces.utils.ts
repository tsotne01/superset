import type { SelectProject, SelectWorkspace } from "@superset/local-db";
import type { WorkspaceListGroup } from "./types";

export interface ListedWorkspace {
	id: string;
	name: string;
	path: string;
	branch: string;
	isActive: boolean;
	projectId: string;
	type: "worktree" | "branch";
}

export function buildWorkspaceList({
	workspaces,
	projects,
	groupedWorkspaces,
	activeWorkspaceId,
}: {
	workspaces: SelectWorkspace[];
	projects?: SelectProject[];
	groupedWorkspaces?: WorkspaceListGroup[];
	activeWorkspaceId: string | null;
}): ListedWorkspace[] {
	const mainRepoPathByProjectId = new Map(
		(projects ?? []).map((project) => [project.id, project.mainRepoPath]),
	);
	const worktreePathByWorkspaceId = new Map<string, string>();

	for (const group of groupedWorkspaces ?? []) {
		for (const workspace of group.workspaces) {
			worktreePathByWorkspaceId.set(workspace.id, workspace.worktreePath);
		}

		for (const section of group.sections) {
			for (const workspace of section.workspaces) {
				worktreePathByWorkspaceId.set(workspace.id, workspace.worktreePath);
			}
		}
	}

	return workspaces.map((workspace) => ({
		id: workspace.id,
		name: workspace.name,
		path:
			workspace.type === "branch"
				? (mainRepoPathByProjectId.get(workspace.projectId) ?? "")
				: (worktreePathByWorkspaceId.get(workspace.id) ?? ""),
		branch: workspace.branch,
		isActive: workspace.id === activeWorkspaceId,
		projectId: workspace.projectId,
		type: workspace.type as "worktree" | "branch",
	}));
}
