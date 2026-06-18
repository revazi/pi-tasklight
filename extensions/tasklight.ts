import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CUSTOM_TYPE, TASKLIGHT_DOCTOR_TIMEOUT_MS } from "../src/constants.ts";
import { formatCommandOutput } from "../src/doctor.ts";
import { showTasklightInfo } from "../src/overlay.ts";
import { latestAlwaysEnabled, parseBooleanEnv } from "../src/session-state.ts";
import {
	fallbackSummaryFromMessages,
	SUMMARY_CLOSE,
	SUMMARY_OPEN,
	statusFromMessages,
	stripSummaryMarker,
} from "../src/summary.ts";
import { runTasklightCommand, sendTasklightNotification } from "../src/tasklight-cli.ts";
import { notificationTitle } from "../src/title.ts";
import { formatDuration } from "../src/time.ts";

const DEFAULT_ALWAYS_ENABLED = parseBooleanEnv(process.env.PI_TASKLIGHT_ALWAYS) ?? false;

const TASKLIGHT_INSTRUCTION = `At the end of your final answer, append one hidden notification summary line: ${SUMMARY_OPEN}plain text outcome, max 120 chars${SUMMARY_CLOSE}. Do not mention this marker.`;

const TL_PROMPT_SUGGESTIONS = [
	{
		value: "run the tests and fix any failures",
		label: "run tests + fix failures",
		description: "Run the project tests and repair failures",
	},
	{
		value: "continue the implementation and notify me when done",
		label: "continue implementation",
		description: "Continue the current task and send a summary notification",
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
		value: "summarize what changed and what remains to do",
		label: "summarize progress",
		description: "Produce a short progress summary",
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
	summary?: string;
	notified: boolean;
};

let nextTaskId = 1;

export default function tasklightExtension(pi: ExtensionAPI) {
	let pendingTask: PendingTask | undefined;
	let warnedMissingTasklight = false;
	let alwaysEnabled = DEFAULT_ALWAYS_ENABLED;

	const updateStatus = (ctx: any) => {
		if (!ctx.hasUI) return;
		const label = alwaysEnabled ? "Tasklight: on" : "Tasklight: off";
		const color = alwaysEnabled ? "success" : "dim";
		ctx.ui.setStatus("pi-tasklight", ctx.ui.theme.fg(color, label));
	};

	const setAlwaysEnabled = (next: boolean, ctx: any) => {
		alwaysEnabled = next;
		pi.appendEntry(CUSTOM_TYPE, { alwaysEnabled });
		updateStatus(ctx);
		ctx.ui.notify(`Tasklight always-on ${alwaysEnabled ? "enabled" : "disabled"}`, "info");
	};

	pi.on("session_start", async (_event, ctx) => {
		alwaysEnabled = latestAlwaysEnabled(ctx.sessionManager.getBranch(), CUSTOM_TYPE) ?? DEFAULT_ALWAYS_ENABLED;
		updateStatus(ctx);
	});

	pi.registerCommand("tl", {
		description: "Run a Pi prompt and notify with a short Tasklight summary when done",
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

			pendingTask = {
				id: nextTaskId++,
				prompt,
				startedAt: Date.now(),
				notified: false,
			};

			try {
				pi.sendUserMessage(prompt);
			} catch (error) {
				pendingTask = undefined;
				ctx.ui.notify(`Failed to start /tl task: ${errorMessage(error)}`, "error");
			}
		},
	});

	pi.registerCommand("tl-toggle", {
		description: "Toggle Tasklight notifications for every Pi prompt in this session",
		handler: async (_args, ctx) => {
			setAlwaysEnabled(!alwaysEnabled, ctx);
		},
	});

	pi.registerCommand("tl-on", {
		description: "Enable Tasklight notifications for every Pi prompt in this session",
		handler: async (_args, ctx) => {
			setAlwaysEnabled(true, ctx);
		},
	});

	pi.registerCommand("tl-off", {
		description: "Disable Tasklight notifications for normal Pi prompts",
		handler: async (_args, ctx) => {
			setAlwaysEnabled(false, ctx);
		},
	});

	pi.registerCommand("tl-status", {
		description: "Show whether Tasklight always-on mode is enabled",
		handler: async (_args, ctx) => {
			updateStatus(ctx);
			ctx.ui.notify(`Tasklight always-on is ${alwaysEnabled ? "enabled" : "disabled"}`, "info");
		},
	});

	pi.registerCommand("tl-doctor", {
		description: "Run tasklight doctor and show diagnostics",
		handler: async (_args, ctx) => {
			const result = await runTasklightCommand(["doctor"], TASKLIGHT_DOCTOR_TIMEOUT_MS);
			const output = formatCommandOutput(result).trim() || "tasklight doctor produced no output";

			if (ctx.hasUI) {
				ctx.ui.setWidget("pi-tasklight-doctor", output.split("\n").slice(0, 40), { placement: "belowEditor" });
				ctx.ui.notify(result.code === 0 ? "Tasklight doctor passed" : "Tasklight doctor found issues", result.code === 0 ? "info" : "warning");
			} else {
				console.log(output);
			}
		},
	});

	pi.registerCommand("tl-test", {
		description: "Send a test Tasklight notification",
		handler: async (_args, ctx) => {
			const result = await sendTasklightNotification({
				title: notificationTitle(pi.getSessionName()),
				subtitle: "✅ Tasklight test",
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
		const prompt = event.prompt.trim();
		if (!pendingTask && alwaysEnabled && prompt) {
			pendingTask = {
				id: nextTaskId++,
				prompt,
				startedAt: Date.now(),
				notified: false,
			};
		}

		if (!pendingTask) return;
		if (prompt !== pendingTask.prompt) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${TASKLIGHT_INSTRUCTION}`,
		};
	});

	pi.on("message_end", async (event) => {
		if (!pendingTask) return;
		if (event.message.role !== "assistant") return;

		const stripped = stripSummaryMarker(event.message);
		if (stripped.summary) {
			pendingTask.summary = stripped.summary;
		}
		if (stripped.message) {
			return { message: stripped.message };
		}
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!pendingTask || pendingTask.notified) return;
		pendingTask.notified = true;

		const status = statusFromMessages(event.messages);
		const summary =
			pendingTask.summary ?? fallbackSummaryFromMessages(event.messages) ?? "Pi is ready for input.";
		const result = await sendTasklightNotification({
			title: notificationTitle(pi.getSessionName()),
			subtitle: `${status.icon} ${status.text} in ${formatDuration(Date.now() - pendingTask.startedAt)}`,
			message: summary,
		});

		if (!result.ok && !warnedMissingTasklight) {
			warnedMissingTasklight = true;
			ctx.ui.notify(`Tasklight notification failed: ${result.error}`, "warning");
		}

		pendingTask = undefined;
	});

	pi.on("session_shutdown", async () => {
		pendingTask = undefined;
	});
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

