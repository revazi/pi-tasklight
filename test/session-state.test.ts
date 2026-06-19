import { describe, expect, it } from "vitest";
import { latestAlwaysEnabled, parseBooleanEnv } from "../src/session-state.ts";
import { formatDuration } from "../src/time.ts";

describe("session state helpers", () => {
	it("parses boolean environment values", () => {
		expect(parseBooleanEnv("1")).toBe(true);
		expect(parseBooleanEnv("YES")).toBe(true);
		expect(parseBooleanEnv("off")).toBe(false);
		expect(parseBooleanEnv("0")).toBe(false);
		expect(parseBooleanEnv("maybe")).toBeUndefined();
		expect(parseBooleanEnv(undefined)).toBeUndefined();
	});

	it("uses the latest matching normal-prompt notification entry", () => {
		const entries = [
			{ type: "custom", customType: "pi-tasklight", data: { alwaysEnabled: false } },
			{ type: "custom", customType: "other", data: { alwaysEnabled: true } },
			{ type: "custom", customType: "pi-tasklight", data: { alwaysEnabled: true } },
		];

		expect(latestAlwaysEnabled(entries, "pi-tasklight")).toBe(true);
		expect(latestAlwaysEnabled(entries, "missing")).toBeUndefined();
	});

	it("formats task durations", () => {
		expect(formatDuration(500)).toBe("<1s");
		expect(formatDuration(12_400)).toBe("12s");
		expect(formatDuration(65_000)).toBe("1m 5s");
		expect(formatDuration(3_665_000)).toBe("1h 1m 5s");
	});
});
