import path from "node:path";
import { config } from "dotenv";
import type { ConfigContext, ExpoConfig } from "expo/config";

// Load .env file
config({
	path: path.resolve(__dirname, "../../.env"),
	override: true,
	quiet: true,
});

export default ({ config }: ConfigContext): ExpoConfig => ({
	...config,
	name: "Superset",
	slug: "superset",
	version: "1.0.0",
	orientation: "portrait",
	icon: "./assets/icon.png",
	userInterfaceStyle: "dark",
	scheme: "superset",
	splash: {
		image: "./assets/splash-icon.png",
		resizeMode: "contain",
		backgroundColor: "#09090b",
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: "sh.superset.mobile",
		infoPlist: {
			ITSAppUsesNonExemptEncryption: false,
		},
	},
	android: {
		adaptiveIcon: {
			foregroundImage: "./assets/adaptive-icon.png",
			backgroundColor: "#ffffff",
		},
		package: "sh.superset.mobile",
		predictiveBackGestureEnabled: false,
	},
	web: {
		favicon: "./assets/favicon.png",
		bundler: "metro",
	},
	plugins: ["expo-router", "expo-localization"],
	extra: {
		router: {},
		eas: {
			projectId: "f04c26d7-1117-441a-b125-103cd704cbc6",
		},
	},
	owner: "tsotne_01",
});
