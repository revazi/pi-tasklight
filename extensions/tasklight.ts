import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SUMMARY_OPEN = "<TASKLIGHT_SUMMARY>";
const SUMMARY_CLOSE = "</TASKLIGHT_SUMMARY>";
const MAX_SUMMARY_LENGTH = 140;
const CUSTOM_TYPE = "pi-tasklight";
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

type NotifyOptions = {
	title: string;
	subtitle: string;
	message: string;
};

type TasklightCommandResult = {
	code: number;
	stdout: string;
	stderr: string;
	error?: string;
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
		alwaysEnabled = latestAlwaysEnabled(ctx.sessionManager.getBranch()) ?? DEFAULT_ALWAYS_ENABLED;
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
				ctx.ui.notify("Usage: /tl <prompt>", "error");
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
			const result = await runTasklightCommand(["doctor"], 10000);
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
				title: notificationTitle(pi),
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
			title: notificationTitle(pi),
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

function latestAlwaysEnabled(entries: any[]): boolean | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type !== "custom" || entry.customType !== CUSTOM_TYPE) continue;
		if (typeof entry.data?.alwaysEnabled === "boolean") {
			return entry.data.alwaysEnabled;
		}
	}
	return undefined;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
	if (!value) return undefined;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return undefined;
}

function stripSummaryMarker(message: any): { message?: any; summary?: string } {
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

function fallbackSummaryFromMessages(messages: any[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message?.role !== "assistant") continue;
		const text = assistantText(message);
		const summary = sanitizeSummary(firstUsefulLine(text));
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

function statusFromMessages(messages: any[]): { icon: string; text: string } {
	const lastAssistant = [...messages].reverse().find((message) => message?.role === "assistant");
	if (lastAssistant?.stopReason === "error") {
		return { icon: "❌", text: "Pi task failed" };
	}
	if (lastAssistant?.stopReason === "aborted") {
		return { icon: "⚠️", text: "Pi task stopped" };
	}
	return { icon: "✅", text: "Pi task finished" };
}

function notificationTitle(pi: ExtensionAPI): string {
	const suffix = sanitizeTitlePart(pi.getSessionName() ?? detectAppDisplayName() ?? "");
	return suffix ? `Pi - ${suffix}` : "Pi";
}

function sanitizeTitlePart(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

async function sendTasklightNotification(options: NotifyOptions): Promise<{ ok: true } | { ok: false; error: string }> {
	const args = [
		"notify",
		"--title",
		options.title,
		"--subtitle",
		options.subtitle,
		"--message",
		options.message,
	];

	const activateApp = detectActivateApp();
	if (activateApp) {
		args.push("--activate-app", activateApp);
	}

	const result = await runTasklightCommand(args, 5000);
	if (result.code === 0) return { ok: true };
	return { ok: false, error: (result.stderr || result.error || `exit code ${result.code}`).trim() };
}

function runTasklightCommand(args: string[], timeout: number): Promise<TasklightCommandResult> {
	const tasklightBin = process.env.TASKLIGHT_BIN || "tasklight";
	return new Promise((resolve) => {
		execFile(tasklightBin, args, { timeout }, (error: any, stdout, stderr) => {
			resolve({
				code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
				stdout: stdout?.toString() ?? "",
				stderr: stderr?.toString() ?? "",
				error: error?.message,
			});
		});
	});
}

function formatCommandOutput(result: TasklightCommandResult): string {
	const parts = [];
	if (result.stdout.trim()) parts.push(result.stdout.trim());
	if (result.stderr.trim()) parts.push(result.stderr.trim());
	if (result.error && !result.stderr.trim()) parts.push(result.error);
	return parts.join("\n");
}

function detectActivateApp(): string | undefined {
	if (process.env.TASKLIGHT_ACTIVATE_APP) return process.env.TASKLIGHT_ACTIVATE_APP;
	if (process.env.__CFBundleIdentifier) return process.env.__CFBundleIdentifier;
	return detectTerminalAppName();
}

function detectAppDisplayName(): string | undefined {
	if (process.env.PI_TASKLIGHT_TITLE_SUFFIX) return process.env.PI_TASKLIGHT_TITLE_SUFFIX;
	if (process.env.__CFBundleIdentifier) {
		return bundleIDDisplayName(process.env.__CFBundleIdentifier);
	}
	return detectTerminalAppName();
}

function detectTerminalAppName(): string | undefined {
	const terminal = process.env.LC_TERMINAL || process.env.TERM_PROGRAM || "";
	switch (terminal.toLowerCase()) {
		case "terminal":
		case "apple_terminal":
			return "Terminal";
		case "iterm":
		case "iterm2":
			return "iTerm2";
		case "vscode":
			return "Visual Studio Code";
		case "wezterm":
			return "WezTerm";
		case "warpterminal":
		case "warp":
			return "Warp";
		case "kitty":
			return "kitty";
		case "ghostty":
			return "Ghostty";
		default:
			return undefined;
	}
}

function bundleIDDisplayName(bundleID: string): string | undefined {
	switch (bundleID) {
		case "com.apple.Terminal":
			return "Terminal";
		case "com.googlecode.iterm2":
			return "iTerm2";
		case "com.github.wez.wezterm":
			return "WezTerm";
		case "com.microsoft.VSCode":
			return "Visual Studio Code";
		case "com.microsoft.VSCodeInsiders":
			return "VS Code Insiders";
		case "com.todesktop.230313mzl4w4u92":
			return "Cursor";
		case "dev.warp.Warp-Stable":
			return "Warp";
		case "com.mitchellh.ghostty":
			return "Ghostty";
		case "net.kovidgoyal.kitty":
			return "kitty";
		case "org.alacritty":
			return "Alacritty";
		default:
			return undefined;
	}
}

function formatDuration(ms: number): string {
	if (ms < 1000) return "<1s";
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes === 0) return `${seconds}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	if (hours === 0) return `${minutes}m ${seconds}s`;
	return `${hours}h ${remainingMinutes}m ${seconds}s`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
