import { rebuild } from "@electron/rebuild";
import pkg from "../package.json";

const electronVersion = (pkg.devDependencies as Record<string, string>).electron.replace(/^\^/, "");

console.log(`Rebuilding native modules for Electron ${electronVersion}...`);
console.log("Skipping @parcel/watcher (uses N-API platform package, no rebuild needed)");
console.log("Skipping node-pty (no Electron 40 prebuilts available; requires VS Build Tools for source compilation)");
console.log("Skipping macos-process-metrics (macOS-only workspace package, not needed on other platforms)");

await rebuild({
	buildPath: process.cwd(),
	electronVersion,
	arch: "x64",
	ignoreModules: ["@parcel/watcher", "node-pty", "macos-process-metrics"],
	buildFromSource: false,
	onlyModules: null,
});

console.log("Native rebuild complete.");
