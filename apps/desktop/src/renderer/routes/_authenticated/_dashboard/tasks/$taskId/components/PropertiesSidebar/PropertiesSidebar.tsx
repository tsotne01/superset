import { Badge } from "@superset/ui/badge";
import { ScrollArea } from "@superset/ui/scroll-area";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { TaskWithStatus } from "../../../components/TasksView/hooks/useTasksTable";
import { AssigneeProperty } from "./components/AssigneeProperty";
import { DueDateProperty } from "./components/DueDateProperty";
import { EstimateProperty } from "./components/EstimateProperty";
import { OpenInWorkspace } from "./components/OpenInWorkspace";
import { PriorityProperty } from "./components/PriorityProperty";
import { StatusProperty } from "./components/StatusProperty";

interface PropertiesSidebarProps {
	task: TaskWithStatus;
}

export function PropertiesSidebar({ task }: PropertiesSidebarProps) {
	const collections = useCollections();
	const labels = task.labels ?? [];
	const [addingLabel, setAddingLabel] = useState(false);
	const [labelInput, setLabelInput] = useState("");
	const labelInputRef = useRef<HTMLInputElement>(null);

	const handleAddLabel = () => {
		const trimmed = labelInput.trim();
		if (trimmed && !labels.includes(trimmed)) {
			collections.tasks.update(task.id, (draft) => {
				draft.labels = [...(draft.labels ?? []), trimmed];
			});
		}
		setLabelInput("");
		setAddingLabel(false);
	};

	const handleRemoveLabel = (label: string) => {
		collections.tasks.update(task.id, (draft) => {
			draft.labels = (draft.labels ?? []).filter((l) => l !== label);
		});
	};

	return (
		<div className="w-64 border-l border-border shrink-0">
			<ScrollArea className="h-full">
				<div className="p-4 space-y-6">
					<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
						Properties
					</h3>

					<div className="space-y-3">
						<StatusProperty task={task} />
						<PriorityProperty task={task} />
						<AssigneeProperty task={task} />
						<EstimateProperty task={task} />
						<DueDateProperty task={task} />
					</div>

					{/* Labels */}
					<div className="flex flex-col gap-2">
						<span className="text-xs text-muted-foreground">Labels</span>
						<div className="flex flex-wrap gap-1">
							{labels.map((label) => (
								<Badge
									key={label}
									variant="outline"
									className="text-xs gap-1 pr-1"
								>
									{label}
									<button
										type="button"
										onClick={() => handleRemoveLabel(label)}
										className="hover:text-foreground text-muted-foreground transition-colors"
									>
										<X className="w-3 h-3" />
									</button>
								</Badge>
							))}
							{addingLabel ? (
								<input
									ref={labelInputRef}
									value={labelInput}
									onChange={(e) => setLabelInput(e.target.value)}
									onBlur={handleAddLabel}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleAddLabel();
										if (e.key === "Escape") {
											setLabelInput("");
											setAddingLabel(false);
										}
									}}
									className="text-xs bg-transparent border border-border rounded px-2 py-0.5 outline-none focus:border-muted-foreground/50 w-24"
									placeholder="Label..."
									autoFocus
								/>
							) : (
								<button
									type="button"
									onClick={() => setAddingLabel(true)}
									className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded px-2 py-0.5 hover:border-muted-foreground/50"
								>
									+ Add
								</button>
							)}
						</div>
					</div>

					<OpenInWorkspace task={task} />
				</div>
			</ScrollArea>
		</div>
	);
}
