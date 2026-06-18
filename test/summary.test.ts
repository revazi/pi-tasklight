import { describe, expect, it } from "vitest";
import {
	fallbackSummaryFromMessages,
	statusFromMessages,
	stripSummaryMarker,
	SUMMARY_CLOSE,
	SUMMARY_OPEN,
} from "../src/summary.ts";

describe("summary helpers", () => {
	it("extracts and strips the hidden summary marker", () => {
		const message = {
			role: "assistant",
			content: [
				{ type: "text", text: `Done.\n${SUMMARY_OPEN}Fixed auth setup.${SUMMARY_CLOSE}` },
				{ type: "tool_use", id: "x" },
			],
		};

		const result = stripSummaryMarker(message);

		expect(result.summary).toBe("Fixed auth setup.");
		expect(result.message?.content[0].text).toBe("Done.");
		expect(result.message?.content[1]).toEqual({ type: "tool_use", id: "x" });
	});

	it("returns an empty result when no marker exists", () => {
		expect(stripSummaryMarker({ role: "assistant", content: [{ type: "text", text: "Done." }] })).toEqual({});
	});

	it("falls back to the last useful assistant line", () => {
		const messages = [
			{ role: "assistant", content: [{ type: "text", text: "Older summary" }] },
			{ role: "user", content: [{ type: "text", text: "ignored" }] },
			{ role: "assistant", content: [{ type: "text", text: "```\n<TASKLIGHT_SUMMARY>ignored</TASKLIGHT_SUMMARY>\nUseful final line" }] },
		];

		expect(fallbackSummaryFromMessages(messages)).toBe("Useful final line");
	});

	it("sanitizes bullets, headings, whitespace, and long marker summaries", () => {
		const long = `# ${"a".repeat(160)}`;
		const bulletResult = stripSummaryMarker({ content: [{ type: "text", text: `${SUMMARY_OPEN}  -   Fixed\n\n auth   setup ${SUMMARY_CLOSE}` }] });
		const longResult = stripSummaryMarker({ content: [{ type: "text", text: `${SUMMARY_OPEN}${long}${SUMMARY_CLOSE}` }] });

		expect(bulletResult.summary).toBe("Fixed auth setup");
		expect(longResult.summary).toHaveLength(140);
		expect(longResult.summary?.endsWith("…")).toBe(true);
	});

	it("derives task status from the last assistant stop reason", () => {
		expect(statusFromMessages([{ role: "assistant", stopReason: "error" }])).toEqual({ icon: "❌", text: "Pi task failed" });
		expect(statusFromMessages([{ role: "assistant", stopReason: "aborted" }])).toEqual({ icon: "⚠️", text: "Pi task stopped" });
		expect(statusFromMessages([{ role: "assistant", stopReason: "stop" }])).toEqual({ icon: "✅", text: "Pi task finished" });
	});
});
