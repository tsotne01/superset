import { rebuild } from "@electron/rebuild";
import pkg from "../package.json";

const electronVersion = (pkg.devDependencies as Record<string, string>).electron.replace(/^\^/, "");

console.log(`Rebuilding native modules for Electron ${electronVersion}...`);
console.log("Rebuilding only better-sqlite3 (other native modules either have JS fallbacks or platform-specific prebuilts)");

await rebuild({
	buildPath: process.cwd(),
	electronVersion,
	arch: "x64",
	onlyModules: ["better-sqlite3"],
	buildFromSource: false,
});

console.log("Native rebuild complete.");
