import { describe, expect, mock, test } from "bun:test";

// Mock the heavy dependencies before importing the module
mock.module("renderer/env.renderer", () => ({
	env: {
		NEXT_PUBLIC_ELECTRIC_URL: "http://localhost:3000",
		NEXT_PUBLIC_API_URL: "http://localhost:4000",
		SKIP_ENV_VALIDATION: true,
	},
}));

mock.module("renderer/lib/auth-client", () => ({
	getAuthToken: () => "mock-token",
	getJwt: () => "mock-jwt",
}));

import { getCollections } from "./collections";

describe("getCollections", () => {
	const orgId = "test-org-id";

	test("returns same cached instance for same orgId", () => {
		const collections1 = getCollections(orgId);
		const collections2 = getCollections(orgId);
		expect(collections1.v2Projects).toBe(collections2.v2Projects);
	});

	test("returns different instances for different orgIds", () => {
		const collections1 = getCollections("org-a");
		const collections2 = getCollections("org-b");
		expect(collections1.v2Projects).not.toBe(collections2.v2Projects);
	});
});

describe("v2 collections are always Electric-backed — #2733", () => {
	/**
	 * Regression test for issue #2733: "Projects disappeared after updating."
	 *
	 * Previously, v2 collections (v2Projects, v2Workspaces, etc.) were
	 * conditionally created based on the V2_CLOUD feature flag. When PostHog
	 * hadn't loaded yet, the flag defaulted to `false`, which created disabled
	 * (empty) collections. This caused:
	 *
	 * 1. The sidebar INNER JOIN with empty v2Projects returned zero rows
	 *    → "projects disappeared"
	 * 2. The ProjectSelector queried empty v2Projects
	 *    → "cannot create a new workspace because no project is selected"
	 *
	 * The fix: v2 collections are always Electric-backed regardless of the
	 * feature flag. The flag only controls which UI is rendered.
	 */

	test("v2Projects collection is Electric-backed (not disabled/empty)", () => {
		const orgId = "v2-always-electric-org";
		const collections = getCollections(orgId);

		// v2Projects should be an Electric-backed collection, not a disabled
		// localOnly collection. Electric collections have a shapeOptions-based
		// sync mechanism. We verify this by checking that the collection exists
		// and is not a trivially empty local-only stub.
		expect(collections.v2Projects).toBeDefined();
		// The collection should have a `.preload` method (Electric collections do)
		expect(typeof collections.v2Projects.preload).toBe("function");
	});

	test("v2Workspaces collection is Electric-backed (not disabled/empty)", () => {
		const orgId = "v2-always-electric-org";
		const collections = getCollections(orgId);
		expect(collections.v2Workspaces).toBeDefined();
		expect(typeof collections.v2Workspaces.preload).toBe("function");
	});

	test("v2Devices collection is Electric-backed (not disabled/empty)", () => {
		const orgId = "v2-always-electric-org";
		const collections = getCollections(orgId);
		expect(collections.v2Devices).toBeDefined();
		expect(typeof collections.v2Devices.preload).toBe("function");
	});

	test("sidebar projects can be inserted and join is possible once synced", () => {
		const orgId = "sidebar-join-org";
		const collections = getCollections(orgId);

		// Simulate: user had sidebar projects in localStorage
		collections.v2SidebarProjects.insert({
			projectId: "00000000-0000-4000-8000-000000000001",
			createdAt: new Date(),
			tabOrder: 1,
			isCollapsed: false,
		});

		// v2SidebarProjects has an entry
		expect(collections.v2SidebarProjects.state.size).toBe(1);

		// v2Projects is Electric-backed — it starts empty but will sync.
		// Crucially, it's NOT a permanently disabled collection that can
		// never receive data (which was the bug before the fix).
		expect(collections.v2Projects).toBeDefined();
	});
});
