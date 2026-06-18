import { describe, expect, it } from "vitest";
import { detectActivateApp, notificationTitle } from "../src/title.ts";

describe("title helpers", () => {
	it("uses the Pi session name for notification titles", () => {
		expect(notificationTitle("Auth cleanup", { TERM_PROGRAM: "iTerm.app" })).toBe("Pi - Auth cleanup");
	});

	it("falls back to detected app display names", () => {
		expect(notificationTitle(undefined, { TERM_PROGRAM: "iTerm2" })).toBe("Pi - iTerm2");
		expect(notificationTitle(undefined, {})).toBe("Pi");
	});

	it("sanitizes title suffixes", () => {
		const long = ` ${"x".repeat(100)} `;
		expect(notificationTitle("  My\n\tTerminal  ")).toBe("Pi - My Terminal");
		expect(notificationTitle(long)).toHaveLength("Pi - ".length + 80);
	});

	it("detects the activation target by override, bundle id, then terminal", () => {
		expect(detectActivateApp({ TASKLIGHT_ACTIVATE_APP: "Terminal", TERM_PROGRAM: "iTerm2" })).toBe("Terminal");
		expect(detectActivateApp({ __CFBundleIdentifier: "com.apple.Terminal", TERM_PROGRAM: "iTerm2" })).toBe("com.apple.Terminal");
		expect(detectActivateApp({ TERM_PROGRAM: "vscode" })).toBe("Visual Studio Code");
	});

	it("detects display names from overrides, bundle ids, and terminals", () => {
		expect(notificationTitle(undefined, { PI_TASKLIGHT_TITLE_SUFFIX: "Work" })).toBe("Pi - Work");
		expect(notificationTitle(undefined, { __CFBundleIdentifier: "com.googlecode.iterm2" })).toBe("Pi - iTerm2");
		expect(notificationTitle(undefined, { LC_TERMINAL: "ghostty" })).toBe("Pi - Ghostty");
		expect(notificationTitle(undefined, { __CFBundleIdentifier: "com.microsoft.VSCodeInsiders" })).toBe("Pi - VS Code Insiders");
		expect(notificationTitle(undefined, { __CFBundleIdentifier: "unknown.bundle" })).toBe("Pi");
	});
});
