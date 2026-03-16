import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useDashboardSidebarState } from "renderer/routes/_authenticated/hooks/useDashboardSidebarState";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { DashboardSidebarProject } from "../../types";
import { buildDashboardSidebarProjects } from "./utils";

export function useDashboardSidebarData() {
	const collections = useCollections();
	const { toggleProjectCollapsed } = useDashboardSidebarState();
	const { data: deviceInfo } = electronTrpc.auth.getDeviceInfo.useQuery();

	const { data: sidebarProjects = [] } = useLiveQuery(
		(q) => q.from({ sidebarProjects: collections.v2SidebarProjects }),
		[collections],
	);

	const { data: sidebarWorkspaces = [] } = useLiveQuery(
		(q) => q.from({ sidebarWorkspaces: collections.v2SidebarWorkspaces }),
		[collections],
	);

	const { data: sidebarSections = [] } = useLiveQuery(
		(q) => q.from({ sidebarSections: collections.v2SidebarSections }),
		[collections],
	);

	const { data: projects = [] } = useLiveQuery(
		(q) => q.from({ v2Projects: collections.v2Projects }),
		[collections],
	);

	const { data: workspaces = [] } = useLiveQuery(
		(q) => q.from({ v2Workspaces: collections.v2Workspaces }),
		[collections],
	);

	const { data: devices = [] } = useLiveQuery(
		(q) =>
			q.from({ v2Devices: collections.v2Devices }).select(({ v2Devices }) => ({
				id: v2Devices.id,
				clientId: v2Devices.clientId,
				type: v2Devices.type,
			})),
		[collections],
	);

	const currentDeviceId =
		devices.find((device) => device.clientId === deviceInfo?.deviceId)?.id ??
		null;

	const { data: githubRepos = [] } = useLiveQuery(
		(q) =>
			q.from({ repos: collections.githubRepositories }).select(({ repos }) => ({
				id: repos.id,
				owner: repos.owner,
			})),
		[collections],
	);

	const groups = useMemo<DashboardSidebarProject[]>(() => {
		return buildDashboardSidebarProjects({
			currentDeviceId,
			devices,
			githubRepos,
			projects,
			sidebarProjects,
			sidebarSections,
			sidebarWorkspaces,
			workspaces,
		});
	}, [
		githubRepos,
		currentDeviceId,
		devices,
		projects,
		sidebarProjects,
		sidebarSections,
		sidebarWorkspaces,
		workspaces,
	]);

	return {
		groups,
		toggleProjectCollapsed,
	};
}
