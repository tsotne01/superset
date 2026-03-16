import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useDashboardSidebarWorkspaceDnD } from "../../hooks/useDashboardSidebarWorkspaceDnD";
import { DashboardSidebarDeleteDialog } from "../DashboardSidebarDeleteDialog";
import { DashboardSidebarCollapsedWorkspaceButton } from "./components/DashboardSidebarCollapsedWorkspaceButton";
import { DashboardSidebarExpandedWorkspaceRow } from "./components/DashboardSidebarExpandedWorkspaceRow";
import { DashboardSidebarWorkspaceContextMenu } from "./components/DashboardSidebarWorkspaceContextMenu/DashboardSidebarWorkspaceContextMenu";
import { DashboardSidebarWorkspaceHoverCardContent } from "./components/DashboardSidebarWorkspaceHoverCardContent";
import { useDashboardSidebarWorkspaceItemActions } from "./hooks/useDashboardSidebarWorkspaceItemActions";
import { getWorkspaceRowMocks } from "./utils";

const EMPTY_SECTIONS: { id: string; name: string }[] = [];

interface DashboardSidebarWorkspaceItemProps {
	id: string;
	projectId: string;
	accentColor?: string | null;
	sectionId?: string | null;
	name: string;
	branch: string;
	index: number;
	workspaceIds: string[];
	sections?: { id: string; name: string }[];
	shortcutLabel?: string;
	isCollapsed?: boolean;
}

export function DashboardSidebarWorkspaceItem({
	id,
	projectId,
	accentColor = null,
	sectionId = null,
	name,
	branch,
	index,
	workspaceIds,
	sections = EMPTY_SECTIONS,
	shortcutLabel,
	isCollapsed = false,
}: DashboardSidebarWorkspaceItemProps) {
	const mockData = getWorkspaceRowMocks(id);
	const {
		cancelRename,
		handleClick,
		handleCreateSection,
		handleDelete,
		isActive,
		isDeleteDialogOpen,
		isDeleting,
		isRenaming,
		moveWorkspaceToSection,
		removeWorkspaceFromSidebar,
		renameValue,
		setIsDeleteDialogOpen,
		setRenameValue,
		startRename,
		submitRename,
	} = useDashboardSidebarWorkspaceItemActions({
		workspaceId: id,
		projectId,
		workspaceName: name,
	});

	const { isDragging, drag, drop } = useDashboardSidebarWorkspaceDnD({
		workspaceId: id,
		projectId,
		sectionId,
		index,
		workspaceIds,
	});

	if (isCollapsed) {
		const showBranch = !!name && name !== branch;

		return (
			<>
				<DashboardSidebarWorkspaceContextMenu
					hoverCardContent={
						<DashboardSidebarWorkspaceHoverCardContent
							name={name}
							branch={branch}
							mockData={mockData}
						/>
					}
					sections={sections}
					onCreateSection={handleCreateSection}
					onMoveToSection={(targetSectionId) =>
						moveWorkspaceToSection(id, projectId, targetSectionId)
					}
					onRemoveFromSidebar={() => removeWorkspaceFromSidebar(id)}
					onRename={startRename}
					onDelete={() => setIsDeleteDialogOpen(true)}
				>
					<Tooltip delayDuration={300}>
						<TooltipTrigger asChild>
							<DashboardSidebarCollapsedWorkspaceButton
								isActive={isActive}
								isDragging={isDragging}
								isUnread={mockData.isUnread}
								onClick={handleClick}
								setDragHandle={(node) => {
									drag(drop(node));
								}}
								workspaceStatus={mockData.workspaceStatus}
							/>
						</TooltipTrigger>
						<TooltipContent side="right" className="flex flex-col gap-0.5">
							<span className="font-medium">{name || branch}</span>
							{showBranch && (
								<span className="text-xs text-muted-foreground font-mono">
									{branch}
								</span>
							)}
						</TooltipContent>
					</Tooltip>
				</DashboardSidebarWorkspaceContextMenu>

				<DashboardSidebarDeleteDialog
					open={isDeleteDialogOpen}
					onOpenChange={setIsDeleteDialogOpen}
					onConfirm={handleDelete}
					title={`Delete "${name || branch}"?`}
					description="This will permanently delete the workspace."
					isPending={isDeleting}
				/>
			</>
		);
	}

	return (
		<>
			<DashboardSidebarWorkspaceContextMenu
				hoverCardContent={
					<DashboardSidebarWorkspaceHoverCardContent
						name={name}
						branch={branch}
						mockData={mockData}
					/>
				}
				sections={sections}
				onCreateSection={handleCreateSection}
				onMoveToSection={(targetSectionId) =>
					moveWorkspaceToSection(id, projectId, targetSectionId)
				}
				onRemoveFromSidebar={() => removeWorkspaceFromSidebar(id)}
				onRename={startRename}
				onDelete={() => setIsDeleteDialogOpen(true)}
			>
				<DashboardSidebarExpandedWorkspaceRow
					accentColor={accentColor}
					name={name}
					branch={branch}
					isActive={isActive}
					isDragging={isDragging}
					isRenaming={isRenaming}
					renameValue={renameValue}
					shortcutLabel={shortcutLabel}
					mockData={mockData}
					onClick={handleClick}
					onDoubleClick={startRename}
					onDeleteClick={() => setIsDeleteDialogOpen(true)}
					onRenameValueChange={setRenameValue}
					onSubmitRename={submitRename}
					onCancelRename={cancelRename}
					setDragHandle={(node) => {
						drag(drop(node));
					}}
				/>
			</DashboardSidebarWorkspaceContextMenu>

			<DashboardSidebarDeleteDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDelete}
				title={`Delete "${name || branch}"?`}
				description="This will permanently delete the workspace."
				isPending={isDeleting}
			/>
		</>
	);
}
