import { rebuild } from "@electron/rebuild";
import pkg from "../package.json";

const electronVersion = (pkg.devDependencies as Record<string, string>).electron.replace(/^\^/, "");

console.log(`Rebuilding native modules for Electron ${electronVersion}...`);
console.log("Skipping @parcel/watcher (uses N-API platform package, no rebuild needed)");

await rebuild({
	buildPath: process.cwd(),
	electronVersion,
	arch: "x64",
	ignoreModules: ["@parcel/watcher"],
	buildFromSource: false,
	onlyModules: null,
});

console.log("Native rebuild complete.");
