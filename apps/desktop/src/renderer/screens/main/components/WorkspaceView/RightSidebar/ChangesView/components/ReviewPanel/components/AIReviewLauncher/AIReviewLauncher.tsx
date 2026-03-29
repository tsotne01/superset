import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { useMemo, useState } from "react";
import { VscLoading, VscRobot } from "react-icons/vsc";
import { AgentSelect } from "renderer/components/AgentSelect";
import { launchAgentSession } from "renderer/lib/agent-session-orchestrator";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { buildPromptAgentLaunchRequest } from "shared/utils/agent-launch-request";
import {
	type AgentDefinitionId,
	getEnabledAgentConfigs,
	getFallbackAgentId,
	indexResolvedAgentConfigs,
} from "shared/utils/agent-settings";

type SelectedAgent = AgentDefinitionId | "none";

interface AIReviewLauncherProps {
	workspaceId: string;
	worktreePath: string;
	baseBranch: string;
	prTitle: string;
	prNumber: number;
}

function buildReviewPrompt({
	diff,
	prTitle,
	prNumber,
}: {
	diff: string;
	prTitle: string;
	prNumber: number;
}): string {
	return `You are reviewing Pull Request #${prNumber}: "${prTitle}".

Analyze the following diff and provide a thorough code review. Focus on:
- Bugs, logic errors, and edge cases
- Security vulnerabilities
- Performance issues
- Code quality and readability
- Missing error handling
- Suggestions for improvement

Be specific: reference file names and line numbers. Be constructive.

---

${diff}`;
}

export function AIReviewLauncher({
	workspaceId,
	worktreePath,
	baseBranch,
	prTitle,
	prNumber,
}: AIReviewLauncherProps) {
	const [isLaunching, setIsLaunching] = useState(false);

	const agentPresetsQuery = electronTrpc.settings.getAgentPresets.useQuery();
	const agentPresets = agentPresetsQuery.data ?? [];
	const enabledAgents = useMemo(
		() => getEnabledAgentConfigs(agentPresets),
		[agentPresets],
	);
	const agentConfigsById = useMemo(
		() => indexResolvedAgentConfigs(agentPresets),
		[agentPresets],
	);
	const fallbackAgentId = useMemo(
		() => getFallbackAgentId(agentPresets),
		[agentPresets],
	);
	const [selectedAgent, setSelectedAgent] = useState<SelectedAgent>(
		fallbackAgentId ?? "none",
	);

	const trpcUtils = electronTrpc.useUtils();
	const terminalCreateOrAttach =
		electronTrpc.terminal.createOrAttach.useMutation();
	const terminalWrite = electronTrpc.terminal.write.useMutation();

	const handleLaunchReview = async () => {
		if (selectedAgent === "none") {
			toast.error("Select an agent first.");
			return;
		}

		setIsLaunching(true);
		try {
			// 1. Fetch diff imperatively
			const { diff } = await trpcUtils.changes.getPRDiff.fetch({
				worktreePath,
				baseBranch,
			});

			if (!diff.trim()) {
				toast.error("No changes found against the base branch.");
				return;
			}

			// 2. Build prompt
			const prompt = buildReviewPrompt({ diff, prTitle, prNumber });

			// 3. Build launch request (same pattern as OpenInWorkspace)
			const launchRequest = buildPromptAgentLaunchRequest({
				workspaceId,
				source: "open-in-workspace",
				selectedAgent,
				prompt,
				configsById: agentConfigsById,
			});

			if (!launchRequest) {
				toast.error("Failed to build agent launch request.");
				return;
			}

			// 4. Launch agent in terminal pane
			const result = await launchAgentSession(launchRequest, {
				source: "open-in-workspace",
				createOrAttach: (input) => terminalCreateOrAttach.mutateAsync(input),
				write: (input) => terminalWrite.mutateAsync(input),
			});

			if (result.status === "failed") {
				toast.error(result.error ?? "Failed to launch agent.");
				return;
			}

			toast.success("AI review agent launched.");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`Failed to launch AI review: ${message}`);
		} finally {
			setIsLaunching(false);
		}
	};

	if (enabledAgents.length === 0) {
		return null;
	}

	return (
		<div className="border-t border-border/70 px-2 py-2">
			<div className="flex items-center gap-1.5">
				<AgentSelect<SelectedAgent>
					agents={enabledAgents}
					value={selectedAgent}
					placeholder="Select agent"
					onValueChange={setSelectedAgent}
					allowNone
					noneLabel="No agent"
					noneValue="none"
					triggerClassName="h-6 flex-1 text-[11px] min-w-0"
					contentClassName="text-xs"
					iconClassName="size-3 object-contain"
				/>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 gap-1 shrink-0 px-2 text-[11px]"
					onClick={() => void handleLaunchReview()}
					disabled={isLaunching || selectedAgent === "none"}
				>
					{isLaunching ? (
						<VscLoading className="size-3 animate-spin" />
					) : (
						<VscRobot className="size-3" />
					)}
					AI Review
				</Button>
			</div>
		</div>
	);
}
