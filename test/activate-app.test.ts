import { describe, expect, it } from "vitest";
import { detectActivateApp } from "../src/activate-app.ts";

describe("activate app helpers", () => {
	it("detects the activation target only by override or bundle id", () => {
		expect(detectActivateApp({ TASKLIGHT_ACTIVATE_APP: "My App" })).toBe("My App");
		expect(detectActivateApp({ __CFBundleIdentifier: "com.example.App" })).toBe("com.example.App");
		expect(detectActivateApp({})).toBeUndefined();
	});

	it("ignores empty activation targets", () => {
		expect(detectActivateApp({ TASKLIGHT_ACTIVATE_APP: " ", __CFBundleIdentifier: "com.example.App" })).toBe("com.example.App");
		expect(detectActivateApp({ TASKLIGHT_ACTIVATE_APP: " ", __CFBundleIdentifier: " " })).toBeUndefined();
	});
});
