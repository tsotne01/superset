import { cn } from "@superset/ui/utils";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { HiChevronRight } from "react-icons/hi2";
import { LuPencil } from "react-icons/lu";
import { RenameInput } from "renderer/screens/main/components/WorkspaceSidebar/RenameInput";
import type { DashboardSidebarSection } from "../../../../types";

interface DashboardSidebarSectionHeaderProps
	extends ComponentPropsWithoutRef<"div"> {
	section: DashboardSidebarSection;
	isRenaming: boolean;
	renameValue: string;
	onRenameValueChange: (value: string) => void;
	onSubmitRename: () => void;
	onCancelRename: () => void;
	onStartRename: () => void;
	onToggleCollapse: () => void;
}

export const DashboardSidebarSectionHeader = forwardRef<
	HTMLDivElement,
	DashboardSidebarSectionHeaderProps
>(
	(
		{
			section,
			isRenaming,
			renameValue,
			onRenameValueChange,
			onSubmitRename,
			onCancelRename,
			onStartRename,
			onToggleCollapse,
			className,
			...props
		},
		ref,
	) => {
		return (
			<div
				ref={ref}
				className={cn(
					"group flex min-h-10 w-full items-center pl-2 pr-2 py-2 text-[11px] font-medium uppercase tracking-wider",
					"text-muted-foreground hover:bg-muted/50 transition-colors",
					className,
				)}
				{...props}
			>
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					<button
						type="button"
						onClick={onToggleCollapse}
						className="flex shrink-0 items-center text-left cursor-pointer"
						aria-label={
							section.isCollapsed ? "Expand section" : "Collapse section"
						}
					>
						<HiChevronRight
							className={cn(
								"size-3 shrink-0 transition-transform duration-150",
								!section.isCollapsed && "rotate-90",
							)}
						/>
					</button>
					{isRenaming ? (
						<RenameInput
							value={renameValue}
							onChange={onRenameValueChange}
							onSubmit={onSubmitRename}
							onCancel={onCancelRename}
							className="-ml-1 h-6 w-full min-w-0 px-1 py-0 text-[11px] tracking-wider font-medium bg-transparent border-none outline-none text-muted-foreground"
						/>
					) : (
						<button
							type="button"
							onClick={onToggleCollapse}
							className="flex min-w-0 max-w-full items-center text-left cursor-pointer"
						>
							<span className="truncate">{section.name}</span>
						</button>
					)}

					<div className="grid shrink-0 items-center [&>*]:col-start-1 [&>*]:row-start-1">
						{!isRenaming && (
							<span className="text-[10px] font-normal tabular-nums transition-all duration-150 group-hover:scale-95 group-hover:opacity-0 group-focus-within:scale-95 group-focus-within:opacity-0">
								({section.workspaces.length})
							</span>
						)}
						{!isRenaming && (
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									onStartRename();
								}}
								className="flex items-center justify-center opacity-0 scale-90 text-muted-foreground transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 hover:text-foreground"
								aria-label="Rename section"
							>
								<LuPencil className="size-3.5 transition-transform duration-150 group-hover:rotate-[-8deg] group-focus-within:rotate-[-8deg]" />
							</button>
						)}
					</div>
				</div>
			</div>
		);
	},
);
