import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@superset/ui/context-menu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@superset/ui/hover-card";
import { useState } from "react";
import {
	LuArrowRightLeft,
	LuFolderPlus,
	LuMinus,
	LuPencil,
	LuTrash2,
} from "react-icons/lu";

interface DashboardSidebarWorkspaceContextMenuProps {
	hoverCardContent?: React.ReactNode;
	sections: { id: string; name: string }[];
	onCreateSection: () => void;
	onMoveToSection: (sectionId: string | null) => void;
	onRemoveFromSidebar: () => void;
	onRename: () => void;
	onDelete: () => void;
	children: React.ReactNode;
}

export function DashboardSidebarWorkspaceContextMenu({
	sections,
	hoverCardContent,
	onCreateSection,
	onMoveToSection,
	onRemoveFromSidebar,
	onRename,
	onDelete,
	children,
}: DashboardSidebarWorkspaceContextMenuProps) {
	const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

	const menuContent = (
		<ContextMenuContent>
			<ContextMenuItem onSelect={onRename}>
				<LuPencil className="size-4 mr-2" />
				Rename
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<LuArrowRightLeft className="size-4 mr-2" />
					Move to Section
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<ContextMenuItem onSelect={onCreateSection}>
						<LuFolderPlus className="size-4 mr-2" />
						New Section
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onMoveToSection(null)}>
						<LuMinus className="size-4 mr-2" />
						Ungrouped
					</ContextMenuItem>
					{sections.map((section) => (
						<ContextMenuItem
							key={section.id}
							onSelect={() => onMoveToSection(section.id)}
						>
							{section.name}
						</ContextMenuItem>
					))}
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuItem onSelect={onRemoveFromSidebar}>
				<LuTrash2 className="size-4 mr-2" />
				Remove from Sidebar
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem
				onSelect={onDelete}
				className="text-destructive focus:text-destructive"
			>
				<LuTrash2 className="size-4 mr-2 text-destructive" />
				Delete
			</ContextMenuItem>
		</ContextMenuContent>
	);

	if (!hoverCardContent) {
		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				{menuContent}
			</ContextMenu>
		);
	}

	return (
		<HoverCard
			open={isContextMenuOpen ? false : undefined}
			openDelay={400}
			closeDelay={100}
		>
			<ContextMenu onOpenChange={setIsContextMenuOpen}>
				<HoverCardTrigger asChild>
					<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				</HoverCardTrigger>
				{menuContent}
			</ContextMenu>
			<HoverCardContent side="right" align="start" className="w-72">
				{hoverCardContent}
			</HoverCardContent>
		</HoverCard>
	);
}
