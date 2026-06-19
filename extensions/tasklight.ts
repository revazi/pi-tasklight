import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CUSTOM_TYPE } from "../src/constants.ts";
import { notificationTitle } from "../src/notification-title.ts";
import { showTasklightInfo } from "../src/overlay.ts";
import { latestAlwaysEnabled, parseBooleanEnv } from "../src/session-state.ts";
import { statusFromMessages } from "../src/status.ts";
import { sendTasklightNotification } from "../src/tasklight-cli.ts";
import { formatDuration } from "../src/time.ts";

const DEFAULT_ALWAYS_ENABLED = parseBooleanEnv(process.env.PI_TASKLIGHT_ALWAYS) ?? false;
const MAX_NOTIFICATION_MESSAGE_LENGTH = 140;

const TL_PROMPT_SUGGESTIONS = [
	{
		value: "run the tests and fix any failures",
		label: "run tests + fix failures",
		description: "Run the project tests and repair failures",
	},
	{
		value: "continue the implementation and notify me when done",
		label: "continue implementation",
		description: "Continue the current task and send a notification",
	},
	{
		value: "review the recent changes for bugs and regressions",
		label: "review recent changes",
		description: "Check the current diff for issues",
	},
	{
		value: "run lint, typecheck, and tests, then fix any issues",
		label: "lint + typecheck + tests",
		description: "Run common validation commands and fix problems",
	},
	{
		value: "inspect the codebase and propose the next implementation step",
		label: "plan next step",
		description: "Look around and suggest what to do next",
	},
];

type PendingTask = {
	id: number;
	prompt: string;
	startedAt: number;
	notified: boolean;
};

type TasklightNotificationResult = Awaited<ReturnType<typeof sendTasklightNotification>>;

type NotificationKind = "info" | "warning" | "error";

type NotifyContext = {
	ui: {
		notify(message: string, kind: NotificationKind): void;
	};
};

let nextTaskId = 1;

export default function tasklightExtension(pi: ExtensionAPI) {
	let pendingTask: PendingTask | undefined;
	let warnedMissingTasklight = false;
	let alwaysEnabled = DEFAULT_ALWAYS_ENABLED;

	const setAlwaysEnabled = (next: boolean, ctx: NotifyContext) => {
		alwaysEnabled = next;
		pi.appendEntry(CUSTOM_TYPE, { alwaysEnabled });
		ctx.ui.notify(`Tasklight notifications for normal prompts ${settingState(alwaysEnabled)}`, "info");
	};

	pi.on("session_start", async (_event, ctx) => {
		alwaysEnabled = latestAlwaysEnabled(ctx.sessionManager.getBranch(), CUSTOM_TYPE) ?? DEFAULT_ALWAYS_ENABLED;
	});

	pi.registerCommand("tl", {
		description: "Run a Pi prompt and notify when done",
		getArgumentCompletions: (prefix) => {
			const normalized = prefix.trim().toLowerCase();
			const matches = TL_PROMPT_SUGGESTIONS.filter((item) => {
				if (!normalized) return true;
				return (
					item.value.toLowerCase().includes(normalized) ||
					item.label.toLowerCase().includes(normalized) ||
					item.description.toLowerCase().includes(normalized)
				);
			});
			return matches.length > 0 ? matches : null;
		},
		handler: async (args, ctx) => {
			const prompt = args.trim();
			if (!prompt) {
				await showTasklightInfo(ctx);
				return;
			}

			pendingTask = createPendingTask(prompt);

			try {
				pi.sendUserMessage(prompt);
			} catch (error) {
				pendingTask = undefined;
				ctx.ui.notify(`Failed to start /tl task: ${errorMessage(error)}`, "error");
			}
		},
	});

	pi.registerCommand("tl-toggle", {
		description: "Toggle Tasklight notifications for normal Pi prompts in this session",
		handler: async (_args, ctx) => {
			setAlwaysEnabled(!alwaysEnabled, ctx);
		},
	});

	pi.registerCommand("tl-test", {
		description: "Send a test Tasklight notification",
		handler: async (_args, ctx) => {
			const result = await sendTasklightNotification({
				title: notificationTitle(pi.getSessionName()),
				subtitle: "✓ Tasklight test",
				message: "Pi can call tasklight notify.",
			});
			if (result.ok) {
				ctx.ui.notify("Tasklight notification sent", "info");
			} else {
				ctx.ui.notify(`Tasklight notification failed: ${result.error}`, "error");
			}
		},
	});

	pi.on("before_agent_start", async (event) => {
		pendingTask = pendingTaskForPrompt(pendingTask, event.prompt.trim(), alwaysEnabled);
	});

	pi.on("agent_end", async (event, ctx) => {
		const task = taskToNotify(pendingTask);
		if (!task) return;

		const result = await notifyCompletedTask(pi.getSessionName(), task, event.messages);
		warnedMissingTasklight = warnOnceOnNotificationFailure(result, warnedMissingTasklight, ctx);
		pendingTask = undefined;
	});

	pi.on("session_shutdown", async () => {
		pendingTask = undefined;
	});
}

function createPendingTask(prompt: string): PendingTask {
	return {
		id: nextTaskId++,
		prompt,
		startedAt: Date.now(),
		notified: false,
	};
}

function pendingTaskForPrompt(current: PendingTask | undefined, prompt: string, alwaysEnabled: boolean): PendingTask | undefined {
	if (current || !alwaysEnabled || !prompt) return current;
	return createPendingTask(prompt);
}

function taskToNotify(task: PendingTask | undefined): PendingTask | undefined {
	if (!task || task.notified) return undefined;
	task.notified = true;
	return task;
}

async function notifyCompletedTask(
	sessionName: string | undefined,
	task: PendingTask,
	messages: readonly unknown[],
): Promise<TasklightNotificationResult> {
	const status = statusFromMessages(messages);
	return sendTasklightNotification({
		title: notificationTitle(sessionName),
		subtitle: `${status.icon} ${status.text} in ${formatDuration(Date.now() - task.startedAt)}`,
		message: notificationMessage(task),
	});
}

function notificationMessage(task: PendingTask): string {
	return truncateMessage(compactPrompt(task.prompt) || "Finished.");
}

function compactPrompt(prompt: string): string {
	return prompt.replace(/\s+/g, " ").trim();
}

function truncateMessage(value: string): string {
	if (value.length <= MAX_NOTIFICATION_MESSAGE_LENGTH) return value;
	return `${value.slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH - 1).trimEnd()}…`;
}

function warnOnceOnNotificationFailure(result: TasklightNotificationResult, warned: boolean, ctx: NotifyContext): boolean {
	if (result.ok || warned) return warned;
	ctx.ui.notify(`Tasklight notification failed: ${result.error}`, "warning");
	return true;
}

function settingState(value: boolean): "enabled" | "disabled" {
	return value ? "enabled" : "disabled";
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
