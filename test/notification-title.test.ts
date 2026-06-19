import { describe, expect, it } from "vitest";
import { notificationTitle } from "../src/notification-title.ts";

describe("notification title helpers", () => {
	it("uses Pi, directory, and session name for notification titles", () => {
		expect(notificationTitle("Auth cleanup", { PWD: "/work/pi-tasklight" })).toBe("Pi · pi-tasklight · Auth cleanup");
	});

	it("falls back to the directory when the session has no name", () => {
		expect(notificationTitle(undefined, { PWD: "/Users/me/auth-service" })).toBe("Pi · auth-service");
	});

	it("sanitizes and de-duplicates title parts", () => {
		const long = ` ${"x".repeat(100)} `;
		expect(notificationTitle("  My\n\tSession  ", { PWD: "/work/repo" })).toBe("Pi · repo · My Session");
		expect(notificationTitle("repo", { PWD: "/work/repo" })).toBe("Pi · repo");
		expect(notificationTitle(long, { PWD: "/work/repo" })).toHaveLength("Pi · repo · ".length + 80);
	});

	it("allows overriding the directory/repo title part", () => {
		expect(notificationTitle("Auth cleanup", { PI_TASKLIGHT_TITLE_SUFFIX: "Work", PWD: "/work/repo" })).toBe("Pi · Work · Auth cleanup");
	});

	it("falls back from an empty title override and handles Windows-style paths", () => {
		expect(notificationTitle(undefined, { PI_TASKLIGHT_TITLE_SUFFIX: " ", PWD: "C:\\work\\repo" })).toBe("Pi · repo");
	});
});
