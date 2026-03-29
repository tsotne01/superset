import { Button } from "@superset/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";

interface CommentInputProps {
	taskId: string;
}

export function CommentInput({ taskId }: CommentInputProps) {
	const queryClient = useQueryClient();
	const [text, setText] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!text.trim() || submitting) return;
		setSubmitting(true);
		try {
			await apiTrpcClient.task.addComment.mutate({ taskId, body: text.trim() });
			setText("");
			queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="border border-border rounded-lg p-3 focus-within:border-muted-foreground/50 transition-colors">
			<textarea
				className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground"
				placeholder="Leave a comment... (Ctrl+Enter to save)"
				value={text}
				rows={text ? 3 : 1}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
						e.preventDefault();
						handleSubmit();
					}
				}}
			/>
			{text.trim() && (
				<div className="flex justify-end mt-2">
					<Button size="sm" onClick={handleSubmit} disabled={submitting}>
						{submitting ? "Saving..." : "Save"}
					</Button>
				</div>
			)}
		</div>
	);
}
