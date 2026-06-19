import { describe, expect, it } from "vitest";
import { statusFromMessages } from "../src/status.ts";

describe("status helpers", () => {
	it("derives task status from the last assistant stop reason", () => {
		expect(statusFromMessages([{ role: "assistant", stopReason: "error" }])).toEqual({ icon: "×", text: "Failed" });
		expect(statusFromMessages([{ role: "assistant", stopReason: "aborted" }])).toEqual({ icon: "–", text: "Stopped" });
		expect(statusFromMessages([{ role: "assistant", stopReason: "stop" }])).toEqual({ icon: "✓", text: "Finished" });
	});
});
