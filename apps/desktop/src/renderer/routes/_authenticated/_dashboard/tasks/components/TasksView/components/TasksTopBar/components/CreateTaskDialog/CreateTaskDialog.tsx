import { authClient } from "@superset/auth/client";
import type { TaskPriority } from "@superset/db/enums";
import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Kbd } from "@superset/ui/kbd";
import { toast } from "@superset/ui/sonner";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useRef, useState } from "react";
import { HiChevronRight, HiOutlinePaperClip, HiXMark } from "react-icons/hi2";
import { TaskMarkdownRenderer } from "renderer/routes/_authenticated/_dashboard/tasks/$taskId/components/TaskMarkdownRenderer";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { compareStatusesForDropdown } from "../../../../utils/sorting";
import { CreateTaskAssigneePicker } from "./components/CreateTaskAssigneePicker";
import { CreateTaskPriorityPicker } from "./components/CreateTaskPriorityPicker";
import { CreateTaskStatusPicker } from "./components/CreateTaskStatusPicker";

interface CreateTaskDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({
	open,
	onOpenChange,
}: CreateTaskDialogProps) {
	const collections = useCollections();
	const { data: session } = authClient.useSession();
	const titleInputRef = useRef<HTMLInputElement>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [statusId, setStatusId] = useState<string | null>(null);
	const [priority, setPriority] = useState<TaskPriority>("none");
	const [assigneeId, setAssigneeId] = useState<string | null>(null);

	const { data: statusData } = useLiveQuery(
		(q) =>
			q
				.from({ taskStatuses: collections.taskStatuses })
				.select(({ taskStatuses }) => ({ ...taskStatuses })),
		[collections],
	);

	const { data: userData } = useLiveQuery(
		(q) =>
			q
				.from({ users: collections.users })
				.select(({ users }) => ({ ...users })),
		[collections],
	);
	const { data: organizationData } = useLiveQuery(
		(q) =>
			q
				.from({ organizations: collections.organizations })
				.select(({ organizations }) => ({ ...organizations })),
		[collections],
	);

	const statuses = useMemo(() => statusData ?? [], [statusData]);
	const users = useMemo(() => userData ?? [], [userData]);
	const activeOrganizationId = session?.session?.activeOrganizationId ?? null;
	const organizationLabel = useMemo(() => {
		const organization = organizationData?.find(
			(org) => org.id === activeOrganizationId,
		);
		return organization?.name ?? "Task";
	}, [activeOrganizationId, organizationData]);

	const defaultStatusId = useMemo(() => {
		const sortedStatuses = [...statuses].sort(compareStatusesForDropdown);
		return (
			sortedStatuses.find((status) => status.type === "backlog")?.id ??
			sortedStatuses[0]?.id ??
			null
		);
	}, [statuses]);

	useEffect(() => {
		if (open && statusId === null && defaultStatusId) {
			setStatusId(defaultStatusId);
		}
	}, [defaultStatusId, open, statusId]);

	useEffect(() => {
		if (open) return;

		setTitle("");
		setDescription("");
		setStatusId(defaultStatusId);
		setPriority("none");
		setAssigneeId(null);
	}, [defaultStatusId, open]);

	const handleCreate = () => {
		if (!title.trim()) return;

		toast.info("Create task persistence is next", {
			description:
				"The desktop create surface is in place; submit wiring is not yet connected.",
		});
	};

	const currentStatusType = useMemo(
		() => statuses.find((status) => status.id === statusId)?.type,
		[statusId, statuses],
	);
	const handleAttachmentClick = () => {
		toast.info("Attachments are not wired yet");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="!top-[calc(50%-min(35vh,320px))] !-translate-y-0 flex max-h-[min(72vh,640px)] flex-col gap-0 overflow-hidden bg-popover p-0 text-popover-foreground sm:max-w-[720px]"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					titleInputRef.current?.focus();
				}}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Create Task</DialogTitle>
					<DialogDescription>
						Create a new task from the desktop tasks view.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between border-b px-4 py-2.5">
					<div className="flex min-w-0 items-center gap-2 text-sm">
						<div className="max-w-40 truncate rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-medium text-muted-foreground">
							{organizationLabel}
						</div>
						<HiChevronRight className="size-3.5 text-muted-foreground" />
						<span className="font-medium">New issue</span>
					</div>

					<DialogClose asChild>
						<button
							type="button"
							className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							aria-label="Close"
						>
							<HiXMark className="size-4" />
						</button>
					</DialogClose>
				</div>

				<div className="flex min-h-0 flex-1 flex-col px-4 py-4">
					<input
						ref={titleInputRef}
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="Task title"
						className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
					/>

					<div className="mt-5 flex-1">
						<TaskMarkdownRenderer
							content={description}
							onChange={setDescription}
							placeholder="Add description..."
							editorClassName="min-h-[240px] text-base leading-relaxed"
							onModEnter={handleCreate}
						/>
					</div>

					<div className="mt-4 flex flex-wrap items-center gap-2">
						<CreateTaskStatusPicker
							statuses={statuses}
							value={statusId}
							onChange={setStatusId}
						/>
						<CreateTaskPriorityPicker
							value={priority}
							statusType={currentStatusType}
							onChange={setPriority}
						/>
						<CreateTaskAssigneePicker
							users={users}
							value={assigneeId}
							onChange={setAssigneeId}
						/>
					</div>
				</div>

				<DialogFooter className="flex-row items-center justify-between border-t px-4 py-3">
					<Button
						variant="ghost"
						size="icon"
						className="h-10 w-10 rounded-full text-muted-foreground"
						onClick={handleAttachmentClick}
					>
						<HiOutlinePaperClip className="size-4" />
					</Button>

					<div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
						<Kbd>Ctrl/⌘</Kbd>
						<span>+</span>
						<Kbd>Enter</Kbd>
						<span>to create</span>
					</div>

					<div className="ml-auto flex items-center gap-3">
						<Button
							onClick={handleCreate}
							disabled={!title.trim()}
							className="h-10 rounded-full px-5"
						>
							Create task
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
