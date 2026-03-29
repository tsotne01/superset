import { Button } from "@superset/ui/button";
import { Textarea } from "@superset/ui/textarea";
import { toast } from "@superset/ui/sonner";
import { useState } from "react";
import { LuCheck, LuMessageSquare, LuX } from "react-icons/lu";
import { VscLoading } from "react-icons/vsc";
import { electronTrpc } from "renderer/lib/electron-trpc";

type ReviewEvent = "approve" | "request-changes" | "comment";

interface ReviewActionsProps {
  worktreePath: string;
  onSuccess: () => void;
}

export function ReviewActions({ worktreePath, onSuccess }: ReviewActionsProps) {
  const [body, setBody] = useState("");

  const submitReviewMutation = electronTrpc.changes.submitReview.useMutation({
    onSuccess: (_data, variables) => {
      const labels: Record<ReviewEvent, string> = {
        approve: "PR approved",
        "request-changes": "Changes requested",
        comment: "Review comment submitted",
      };
      toast.success(labels[variables.event]);
      setBody("");
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Review failed: ${error.message}`);
    },
  });

  const isPending = submitReviewMutation.isPending;

  const handleSubmit = (event: ReviewEvent) => {
    if (event === "request-changes" && !body.trim()) {
      toast.error("A comment is required when requesting changes.");
      return;
    }
    submitReviewMutation.mutate({
      worktreePath,
      event,
      body: body.trim() || undefined,
    });
  };

  return (
    <div className="border-t border-border/70 px-2 py-2">
      <Textarea
        placeholder="Leave a review comment..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[60px] resize-none text-xs"
        disabled={isPending}
      />
      <div className="mt-1.5 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => handleSubmit("comment")}
          disabled={isPending || !body.trim()}
        >
          {isPending ? (
            <VscLoading className="size-3 animate-spin" />
          ) : (
            <LuMessageSquare className="size-3" />
          )}
          Comment
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300"
          onClick={() => handleSubmit("request-changes")}
          disabled={isPending}
        >
          {isPending ? (
            <VscLoading className="size-3 animate-spin" />
          ) : (
            <LuX className="size-3" />
          )}
          Request Changes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300"
          onClick={() => handleSubmit("approve")}
          disabled={isPending}
        >
          {isPending ? (
            <VscLoading className="size-3 animate-spin" />
          ) : (
            <LuCheck className="size-3" />
          )}
          Approve
        </Button>
      </div>
    </div>
  );
}
