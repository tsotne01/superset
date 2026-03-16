import { cn } from "@superset/ui/utils";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import type { ActivePaneStatus } from "shared/tabs-types";
import { DashboardSidebarWorkspaceIcon } from "../DashboardSidebarWorkspaceIcon";

interface DashboardSidebarCollapsedWorkspaceButtonProps
	extends ComponentPropsWithoutRef<"button"> {
	isActive: boolean;
	isDragging: boolean;
	isUnread?: boolean;
	setDragHandle: (node: HTMLButtonElement | null) => void;
	workspaceStatus?: ActivePaneStatus | null;
}

export const DashboardSidebarCollapsedWorkspaceButton = forwardRef<
	HTMLButtonElement,
	DashboardSidebarCollapsedWorkspaceButtonProps
>(
	(
		{
			isActive,
			isDragging,
			isUnread = false,
			setDragHandle,
			workspaceStatus = null,
			className,
			...props
		},
		ref,
	) => {
		return (
			<button
				type="button"
				ref={(node) => {
					setDragHandle(node);
					if (typeof ref === "function") {
						ref(node);
					} else if (ref) {
						ref.current = node;
					}
				}}
				className={cn(
					"relative flex items-center justify-center size-8 rounded-md",
					"hover:bg-muted/50 transition-colors cursor-pointer",
					isActive && "bg-muted",
					isDragging && "opacity-30",
					className,
				)}
				{...props}
			>
				<DashboardSidebarWorkspaceIcon
					isActive={isActive}
					isUnread={isUnread}
					variant="collapsed"
					workspaceStatus={workspaceStatus}
				/>
			</button>
		);
	},
);
