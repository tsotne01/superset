import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projects, workspaces, worktrees } from "@superset/local-db";
import { eq } from "drizzle-orm";

type TableName =
	| "projects"
	| "settings"
	| "workspaceSections"
	| "workspaces"
	| "worktrees";

const dbState: Record<TableName, Array<Record<string, unknown>>> = {
	projects: [],
	settings: [],
	workspaceSections: [],
	workspaces: [],
	worktrees: [],
};

let nextMockId = 0;

function resetMockDb(): void {
	for (const table of Object.values(dbState)) {
		table.length = 0;
	}
	nextMockId = 0;
}

function nextId(prefix: string): string {
	nextMockId += 1;
	return `${prefix}-${nextMockId}`;
}

function getTableName(table: unknown): TableName {
	const tableId =
		typeof table === "object" && table !== null && "id" in table
			? String((table as { id: unknown }).id)
			: "";

	if (tableId.startsWith("projects")) {
		return "projects";
	}
	if (tableId.startsWith("settings")) {
		return "settings";
	}
	if (tableId.startsWith("workspace_sections")) {
		return "workspaceSections";
	}
	if (tableId.startsWith("workspaces")) {
		return "workspaces";
	}
	if (tableId.startsWith("worktrees")) {
		return "worktrees";
	}

	throw new Error(`Unsupported table mock: ${tableId || String(table)}`);
}

function withDefaults(
	tableName: TableName,
	record: Record<string, unknown>,
): Record<string, unknown> {
	switch (tableName) {
		case "projects":
			return {
				id: nextId("project"),
				tabOrder: null,
				lastOpenedAt: null,
				workspaceBaseBranch: null,
				...record,
			};
		case "workspaces":
			return {
				id: nextId("workspace"),
				deletingAt: null,
				lastOpenedAt: Date.now(),
				...record,
			};
		case "worktrees":
			return {
				id: nextId("worktree"),
				gitStatus: null,
				createdBySuperset: true,
				...record,
			};
		case "settings":
			return {
				id: 1,
				...record,
			};
		case "workspaceSections":
			return {
				id: nextId("workspace-section"),
				...record,
			};
	}
}

const localDb = {
	select() {
		let tableName: TableName | null = null;
		const query = {
			from(table: unknown) {
				tableName = getTableName(table);
				return query;
			},
			where(_condition?: unknown) {
				return query;
			},
			innerJoin(_table: unknown, _condition?: unknown) {
				return query;
			},
			orderBy(_value?: unknown) {
				return query;
			},
			get() {
				return tableName ? dbState[tableName][0] : undefined;
			},
			all() {
				return tableName ? [...dbState[tableName]] : [];
			},
		};
		return query;
	},
	insert(table: unknown) {
		const tableName = getTableName(table);
		let pendingRows: Array<Record<string, unknown>> = [];
		let insertedRows: Array<Record<string, unknown>> | null = null;

		const commit = (): Array<Record<string, unknown>> => {
			if (insertedRows) {
				return insertedRows;
			}
			insertedRows = pendingRows.map((row) => withDefaults(tableName, row));
			dbState[tableName].push(...insertedRows);
			return insertedRows;
		};

		return {
			values(value: Record<string, unknown> | Array<Record<string, unknown>>) {
				pendingRows = Array.isArray(value) ? value : [value];
				return {
					returning() {
						return {
							get() {
								return commit()[0];
							},
						};
					},
					onConflictDoUpdate({
						set,
					}: {
						set: Record<string, unknown>;
						target?: unknown;
					}) {
						return {
							run() {
								if (tableName !== "settings") {
									const [record] = commit();
									if (record) {
										Object.assign(record, set);
									}
									return;
								}

								const record = withDefaults(tableName, pendingRows[0] ?? {});
								const existing = dbState.settings[0];
								if (existing) {
									Object.assign(existing, record, set);
								} else {
									dbState.settings.push({ ...record, ...set });
								}
							},
						};
					},
					run() {
						commit();
					},
				};
			},
		};
	},
	update(table: unknown) {
		const tableName = getTableName(table);
		let patch: Record<string, unknown> = {};
		return {
			set(nextPatch: Record<string, unknown>) {
				patch = nextPatch;
				return {
					where(_condition?: unknown) {
						return {
							run() {
								const target = dbState[tableName][0];
								if (target) {
									Object.assign(target, patch);
								}
							},
							returning() {
								return {
									get() {
										const target = dbState[tableName][0];
										if (target) {
											Object.assign(target, patch);
										}
										return target;
									},
								};
							},
						};
					},
				};
			},
		};
	},
	delete(table: unknown) {
		const tableName = getTableName(table);
		return {
			where(_condition?: unknown) {
				return {
					run() {
						dbState[tableName].length = 0;
					},
				};
			},
		};
	},
};

mock.module("main/lib/local-db", () => ({ localDb }));

const TEST_DIR = join(
	realpathSync(tmpdir()),
	`superset-test-create-${process.pid}`,
);

function createTestRepo(name: string): string {
	const repoPath = join(TEST_DIR, name);
	mkdirSync(repoPath, { recursive: true });
	execSync("git init", { cwd: repoPath, stdio: "ignore" });
	execSync("git config user.email 'test@test.com'", {
		cwd: repoPath,
		stdio: "ignore",
	});
	execSync("git config user.name 'Test'", { cwd: repoPath, stdio: "ignore" });
	return repoPath;
}

function seedCommit(repoPath: string, message = "init"): void {
	writeFileSync(join(repoPath, "README.md"), `# test\n${message}\n`);
	execSync(`git add . && git commit -m '${message}'`, {
		cwd: repoPath,
		stdio: "ignore",
	});
}

function createExternalWorktree(
	mainRepoPath: string,
	branch: string,
	worktreePath: string,
): void {
	mkdirSync(worktreePath, { recursive: true });
	execSync(`git worktree add "${worktreePath}" -b ${branch}`, {
		cwd: mainRepoPath,
		stdio: "ignore",
	});
	// Add a commit to the worktree to make it real
	writeFileSync(join(worktreePath, "test.txt"), "external worktree content\n");
	execSync("git add . && git commit -m 'external work'", {
		cwd: worktreePath,
		stdio: "ignore",
	});
}

describe("Workspace creation with external worktree auto-import", () => {
	let mainRepoPath: string;
	let projectId: string;
	let externalWorktreePath: string;

	beforeEach(() => {
		resetMockDb();

		// Clean test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });

		// Create test repository
		mainRepoPath = createTestRepo("main-repo");
		seedCommit(mainRepoPath, "initial commit");

		// Create project in DB
		const project = localDb
			.insert(projects)
			.values({
				mainRepoPath,
				name: "Test Project",
				color: "#000000",
				defaultBranch: "main",
			})
			.returning()
			.get() as { id: string };
		projectId = project.id;

		// Create external worktree
		externalWorktreePath = join(TEST_DIR, "external-worktree");
	});

	afterEach(() => {
		// Clean up database
		if (projectId) {
			localDb
				.delete(workspaces)
				.where(eq(workspaces.projectId, projectId))
				.run();
			localDb.delete(worktrees).where(eq(worktrees.projectId, projectId)).run();
			localDb.delete(projects).where(eq(projects.id, projectId)).run();
		}

		// Clean test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	test("should auto-import external worktree when creating workspace for existing branch", async () => {
		// Create external worktree manually
		createExternalWorktree(
			mainRepoPath,
			"feature-external",
			externalWorktreePath,
		);

		// Import the utility function
		const { createWorkspaceFromExternalWorktree } = await import(
			"../utils/workspace-creation"
		);

		// Try to create a workspace for the branch that has an external worktree
		const result = await createWorkspaceFromExternalWorktree({
			projectId,
			branch: "feature-external",
			name: "Test Workspace",
		});

		// Verify workspace was created
		expect(result).toBeDefined();
		expect(result?.workspace).toBeDefined();
		expect(result?.workspace.branch).toBe("feature-external");
		expect(result?.wasExisting).toBe(true);

		// Verify worktree was imported with correct flag
		const importedWorktree = localDb
			.select()
			.from(worktrees)
			.where(eq(worktrees.id, result?.workspace.worktreeId as string))
			.get();

		expect(importedWorktree).toBeDefined();
		expect(importedWorktree?.createdBySuperset).toBe(false); // External worktree
		expect(importedWorktree?.path).toBe(externalWorktreePath);

		// Verify worktree still exists on disk
		expect(existsSync(externalWorktreePath)).toBe(true);
	});

	test("should return undefined when no external worktree exists for branch", async () => {
		// Import the utility function
		const { createWorkspaceFromExternalWorktree } = await import(
			"../utils/workspace-creation"
		);

		// Try to create a workspace for a branch with no external worktree
		const result = await createWorkspaceFromExternalWorktree({
			projectId,
			branch: "feature-nonexistent",
			name: "Test Workspace",
		});

		// Should return undefined (no external worktree found)
		expect(result).toBeUndefined();
	});

	test("should preserve external worktree on disk when removing the workspace record", async () => {
		// Create external worktree
		createExternalWorktree(
			mainRepoPath,
			"feature-preserve",
			externalWorktreePath,
		);

		// Import and create workspace (auto-import)
		const { createWorkspaceFromExternalWorktree } = await import(
			"../utils/workspace-creation"
		);

		const createResult = await createWorkspaceFromExternalWorktree({
			projectId,
			branch: "feature-preserve",
			name: "Preserve Test",
		});

		expect(createResult).toBeDefined();
		const workspaceId = createResult?.workspace.id as string;
		const worktreeId = createResult?.workspace.worktreeId as string;

		// Verify worktree is marked as external
		const worktree = localDb
			.select()
			.from(worktrees)
			.where(eq(worktrees.id, worktreeId))
			.get();
		expect(worktree?.createdBySuperset).toBe(false);

		// Now delete the workspace using the delete utility
		const { deleteWorkspace } = await import("../utils/db-helpers");

		deleteWorkspace(workspaceId);

		// Verify workspace was deleted from DB
		const deletedWorkspace = localDb
			.select()
			.from(workspaces)
			.where(eq(workspaces.id, workspaceId))
			.get();
		expect(deletedWorkspace).toBeUndefined();

		// The full delete procedure removes the worktree record separately.
		// This helper only deletes the workspace row and should leave the
		// external worktree intact on disk.
		const remainingWorktree = localDb
			.select()
			.from(worktrees)
			.where(eq(worktrees.id, worktreeId))
			.get();
		expect(remainingWorktree).toBeDefined();
		expect(remainingWorktree?.createdBySuperset).toBe(false);

		// CRITICAL: Verify worktree still exists on disk (not deleted)
		expect(existsSync(externalWorktreePath)).toBe(true);
		expect(existsSync(join(externalWorktreePath, "test.txt"))).toBe(true);
	});
});

describe("External worktree import via openExternalWorktree", () => {
	let mainRepoPath: string;
	let projectId: string;
	let externalWorktreePath: string;

	beforeEach(() => {
		resetMockDb();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });

		mainRepoPath = createTestRepo("main-repo");
		seedCommit(mainRepoPath, "initial commit");

		const project = localDb
			.insert(projects)
			.values({
				mainRepoPath,
				name: "Test Project",
				color: "#000000",
				defaultBranch: "main",
			})
			.returning()
			.get() as { id: string };
		projectId = project.id;

		externalWorktreePath = join(TEST_DIR, "external-worktree");
	});

	afterEach(() => {
		if (projectId) {
			localDb
				.delete(workspaces)
				.where(eq(workspaces.projectId, projectId))
				.run();
			localDb.delete(worktrees).where(eq(worktrees.projectId, projectId)).run();
			localDb.delete(projects).where(eq(projects.id, projectId)).run();
		}

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	test("should mark worktree as external when using openExternalWorktree", async () => {
		// Create external worktree
		createExternalWorktree(
			mainRepoPath,
			"feature-manual",
			externalWorktreePath,
		);

		const { openExternalWorktree } = await import(
			"../utils/workspace-creation"
		);

		// Explicitly import external worktree
		const result = await openExternalWorktree({
			projectId,
			worktreePath: externalWorktreePath,
			branch: "feature-manual",
		});

		// Verify worktree was marked as external
		const importedWorktree = localDb
			.select()
			.from(worktrees)
			.where(eq(worktrees.id, result.workspace.worktreeId as string))
			.get();

		expect(importedWorktree).toBeDefined();
		expect(importedWorktree?.createdBySuperset).toBe(false);
	});
});
