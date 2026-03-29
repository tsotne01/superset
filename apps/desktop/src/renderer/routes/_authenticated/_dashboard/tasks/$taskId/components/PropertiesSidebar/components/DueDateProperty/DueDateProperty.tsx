import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { TaskWithStatus } from "../../../../../components/TasksView/hooks/useTasksTable";

interface DueDatePropertyProps {
	task: TaskWithStatus;
}

export function DueDateProperty({ task }: DueDatePropertyProps) {
	const collections = useCollections();

	const dueDate = task.dueDate ? new Date(task.dueDate) : null;
	const isOverdue = dueDate && dueDate < new Date();

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const date = e.target.value ? new Date(e.target.value) : null;
		collections.tasks.update(task.id, (draft) => {
			draft.dueDate = date;
		});
	};

	return (
		<div className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors w-full group">
			<Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
			<div className="flex-1 relative">
				<span
					className={`text-sm pointer-events-none ${
						isOverdue
							? "text-red-500"
							: dueDate
								? "text-foreground"
								: "text-muted-foreground"
					}`}
				>
					{dueDate ? format(dueDate, "MMM d, yyyy") : "No due date"}
				</span>
				<input
					type="date"
					value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
					onChange={handleChange}
					className="absolute inset-0 opacity-0 cursor-pointer w-full"
				/>
			</div>
		</div>
	);
}
