import { toast } from "@superset/ui/sonner";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { useDashboardSidebarState } from "renderer/routes/_authenticated/hooks/useDashboardSidebarState";
import { useOpenNewWorkspaceModal } from "renderer/stores/new-workspace-modal";
import type { DashboardSidebarProject } from "../../../../types";
import { getProjectChildrenWorkspaces } from "../../../../utils/projectChildren";

interface UseDashboardSidebarProjectSectionActionsOptions {
	project: DashboardSidebarProject;
}

export function useDashboardSidebarProjectSectionActions({
	project,
}: UseDashboardSidebarProjectSectionActionsOptions) {
	const openModal = useOpenNewWorkspaceModal();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const {
		createSection,
		deleteSection,
		removeProjectFromSidebar,
		renameSection,
		toggleSectionCollapsed,
	} = useDashboardSidebarState();

	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(project.name);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const startRename = () => {
		setRenameValue(project.name);
		setIsRenaming(true);
	};

	const cancelRename = () => {
		setIsRenaming(false);
		setRenameValue(project.name);
	};

	const submitRename = async () => {
		setIsRenaming(false);
		const trimmed = renameValue.trim();
		if (!trimmed || trimmed === project.name) return;
		try {
			await apiTrpcClient.v2Project.update.mutate({
				id: project.id,
				name: trimmed,
				slug: trimmed.toLowerCase().replace(/\s+/g, "-"),
			});
		} catch (error) {
			toast.error(
				`Failed to rename: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await apiTrpcClient.v2Project.delete.mutate({ id: project.id });
			removeProjectFromSidebar(project.id);
			setIsDeleteDialogOpen(false);
			toast.success("Project deleted");

			const isInProject = getProjectChildrenWorkspaces(project.children).some(
				(workspace) =>
					!!matchRoute({
						to: "/v2-workspace/$workspaceId",
						params: { workspaceId: workspace.id },
						fuzzy: true,
					}),
			);
			if (isInProject) {
				navigate({ to: "/" });
			}
		} catch (error) {
			toast.error(
				`Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleNewWorkspace = () => {
		openModal(project.id);
	};

	const handleNewSection = () => {
		createSection(project.id);
	};

	return {
		cancelRename,
		deleteSection,
		handleDelete,
		handleNewSection,
		handleNewWorkspace,
		isDeleteDialogOpen,
		isDeleting,
		isRenaming,
		removeProjectFromSidebar,
		renameSection,
		renameValue,
		setIsDeleteDialogOpen,
		setRenameValue,
		startRename,
		submitRename,
		toggleSectionCollapsed,
	};
}
