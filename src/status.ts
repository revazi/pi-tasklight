type AssistantStatusMessage = {
	role?: unknown;
	stopReason?: unknown;
};

export function statusFromMessages(messages: readonly unknown[]): { icon: string; text: string } {
	const lastAssistant = [...messages].reverse().find(isAssistantStatusMessage);
	if (lastAssistant?.stopReason === "error") return { icon: "×", text: "Failed" };
	if (lastAssistant?.stopReason === "aborted") return { icon: "–", text: "Stopped" };
	return { icon: "✓", text: "Finished" };
}

function isAssistantStatusMessage(message: unknown): message is AssistantStatusMessage {
	return isRecord(message) && message.role === "assistant";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
