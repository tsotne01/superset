import {
	normalizeExecutionMode,
	type TerminalPreset,
} from "@superset/local-db/schema/zod";
import { normalizePresetProjectIds } from "shared/preset-project-targeting";

export type PresetWithUnknownMode = Omit<TerminalPreset, "executionMode"> & {
	executionMode?: unknown;
};

export function normalizeTerminalPreset(
	preset: PresetWithUnknownMode,
): TerminalPreset {
	return {
		...preset,
		projectIds: normalizePresetProjectIds(preset.projectIds),
		executionMode: normalizeExecutionMode(preset.executionMode),
	};
}

export function normalizeTerminalPresets(
	presets: PresetWithUnknownMode[],
): TerminalPreset[] {
	return presets.map(normalizeTerminalPreset);
}

export function shouldPersistNormalizedPresetModes(
	presets: PresetWithUnknownMode[],
): boolean {
	return presets.some(
		(preset) =>
			preset.executionMode !== normalizeExecutionMode(preset.executionMode),
	);
}
