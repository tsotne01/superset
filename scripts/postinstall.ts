import { execSync } from "node:child_process";

// Prevent infinite recursion during postinstall
// electron-builder install-app-deps can trigger nested bun installs
// which would re-run postinstall, spawning hundreds of processes
if (process.env.SUPERSET_POSTINSTALL_RUNNING) process.exit(0);
process.env.SUPERSET_POSTINSTALL_RUNNING = "1";

// Run sherif for workspace validation
execSync("sherif", { stdio: "inherit" });

// GitHub CI / Vercel / EAS runs do not need desktop native rebuilds.
if (process.env.CI || process.env.VERCEL) process.exit(0);

// Install native dependencies for desktop app.
// Non-fatal: requires Visual Studio Build Tools on Windows. Without it, dev mode
// (bun dev) still works — only packaging (bun run build) needs native rebuilds.
try {
	execSync("bun run --filter=@superset/desktop install:deps", { stdio: "inherit" });
} catch {
	console.warn(
		"\nWarning: install:deps failed — native modules not rebuilt for Electron.",
		"\nDev mode (bun dev) still works.",
		"\nTo enable packaging, install VS Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/\n",
	);
}
