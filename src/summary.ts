export const SUMMARY_OPEN = "<TASKLIGHT_SUMMARY>";
export const SUMMARY_CLOSE = "</TASKLIGHT_SUMMARY>";
const MAX_SUMMARY_LENGTH = 140;

export type SummaryMarkerResult = {
	message?: any;
	summary?: string;
};

export function stripSummaryMarker(message: any): SummaryMarkerResult {
	if (!Array.isArray(message.content)) return {};

	let summary: string | undefined;
	let changed = false;
	const pattern = new RegExp(`${escapeRegExp(SUMMARY_OPEN)}([\\s\\S]*?)${escapeRegExp(SUMMARY_CLOSE)}`, "g");

	const content = message.content.map((block: any) => {
		if (!block || block.type !== "text" || typeof block.text !== "string") {
			return block;
		}

		const text = block.text.replace(pattern, (_match: string, rawSummary: string) => {
			const clean = sanitizeSummary(rawSummary);
			if (clean) summary = clean;
			changed = true;
			return "";
		});

		if (text !== block.text) {
			return { ...block, text: text.trimEnd() };
		}
		return block;
	});

	if (!changed) return {};
	return { message: { ...message, content }, summary };
}

export function fallbackSummaryFromMessages(messages: any[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message?.role !== "assistant") continue;
		const summary = sanitizeSummary(firstUsefulLine(assistantText(message)));
		if (summary) return summary;
	}
	return undefined;
}

function assistantText(message: any): string {
	if (!Array.isArray(message.content)) return "";
	return message.content
		.filter((block: any) => block?.type === "text" && typeof block.text === "string")
		.map((block: any) => block.text)
		.join("\n");
}

function firstUsefulLine(text: string): string {
	return text
		.replace(new RegExp(`${escapeRegExp(SUMMARY_OPEN)}[\\s\\S]*?${escapeRegExp(SUMMARY_CLOSE)}`, "g"), "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line && !line.startsWith("```") && !line.startsWith("<")) ?? "";
}

function sanitizeSummary(value: string): string {
	const collapsed = value
		.replace(/\s+/g, " ")
		.replace(/^[-*•\s]+/, "")
		.replace(/^#+\s*/, "")
		.trim();

	if (collapsed.length <= MAX_SUMMARY_LENGTH) return collapsed;
	return `${collapsed.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`;
}

export function statusFromMessages(messages: any[]): { icon: string; text: string } {
	const lastAssistant = [...messages].reverse().find((message) => message?.role === "assistant");
	if (lastAssistant?.stopReason === "error") {
		return { icon: "❌", text: "Pi task failed" };
	}
	if (lastAssistant?.stopReason === "aborted") {
		return { icon: "⚠️", text: "Pi task stopped" };
	}
	return { icon: "✅", text: "Pi task finished" };
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
