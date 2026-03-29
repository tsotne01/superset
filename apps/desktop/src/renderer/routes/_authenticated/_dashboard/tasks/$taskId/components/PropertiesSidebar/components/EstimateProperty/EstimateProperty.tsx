import { Hash } from "lucide-react";
import { useState } from "react";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { TaskWithStatus } from "../../../../../components/TasksView/hooks/useTasksTable";

interface EstimatePropertyProps {
	task: TaskWithStatus;
}

export function EstimateProperty({ task }: EstimatePropertyProps) {
	const collections = useCollections();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState("");

	const startEditing = () => {
		setValue(task.estimate?.toString() ?? "");
		setEditing(true);
	};

	const handleSave = () => {
		const num = Number.parseInt(value, 10);
		collections.tasks.update(task.id, (draft) => {
			draft.estimate = !Number.isNaN(num) && num > 0 ? num : null;
		});
		setEditing(false);
	};

	if (editing) {
		return (
			<div className="flex items-center gap-2 px-1">
				<Hash className="w-4 h-4 text-muted-foreground shrink-0" />
				<input
					type="number"
					min="1"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onBlur={handleSave}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSave();
						if (e.key === "Escape") setEditing(false);
					}}
					className="text-sm bg-transparent border border-border rounded px-2 py-0.5 w-20 outline-none focus:border-muted-foreground/50"
					autoFocus
				/>
				<span className="text-xs text-muted-foreground">points</span>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={startEditing}
			className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors w-full"
		>
			<Hash className="w-4 h-4 text-muted-foreground shrink-0" />
			<span className={`text-sm ${task.estimate ? "text-foreground" : "text-muted-foreground"}`}>
				{task.estimate ? `${task.estimate} points` : "No estimate"}
			</span>
		</button>
	);
}
