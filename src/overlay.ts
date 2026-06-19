import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import {
	PACKAGE_INFO,
	PACKAGE_ISSUES_URL,
	PACKAGE_NAME,
	PACKAGE_NPM_URL,
	PACKAGE_REPO_URL,
	TASKLIGHT_DOCTOR_TIMEOUT_MS,
} from "./constants.ts";
import { DEFAULT_DOCTOR_OUTPUT_MAX_LINES, type DoctorDisplay, doctorDisplayFromResult, tasklightInfoPlainLines } from "./doctor.ts";
import { runTasklightCommand } from "./tasklight-cli.ts";

const ansi = (code: number, text: string) => `\x1b[38;5;${code}m${text}\x1b[39m`;
const purple = (text: string) => ansi(141, text);
const violet = (text: string) => ansi(99, text);
const pink = (text: string) => ansi(213, text);
const cyan = (text: string) => ansi(81, text);
const amber = (text: string) => ansi(215, text);
const CLOSE_TEXT_KEYS = new Set(["q", "Q"]);

type OverlayTheme = {
	bold(text: string): string;
	fg(color: string, text: string): string;
};

type OverlayTui = {
	requestRender(): void;
};

type OverlayContext = {
	mode?: string;
	hasUI?: boolean;
	ui: {
		custom(
			factory: (tui: OverlayTui, theme: OverlayTheme, keybindings: unknown, done: () => void) => TasklightInfoOverlay,
			options: {
				overlay: boolean;
				overlayOptions: Record<string, unknown>;
			},
		): Promise<void>;
		notify(message: string, kind: "info" | "warning" | "error"): void;
		setWidget(id: string, lines: string[], options: { placement: "belowEditor" }): void;
	};
};

export async function showTasklightInfo(ctx: OverlayContext): Promise<void> {
	if (ctx.mode === "tui" && ctx.hasUI) {
		await showTasklightInfoOverlay(ctx);
		return;
	}

	const result = await runTasklightCommand(["doctor"], TASKLIGHT_DOCTOR_TIMEOUT_MS);
	const lines = tasklightInfoPlainLines(doctorDisplayFromResult(result), PACKAGE_INFO);
	if (ctx.hasUI) {
		ctx.ui.setWidget("pi-tasklight-info", lines.slice(0, 40), { placement: "belowEditor" });
		ctx.ui.notify("Tasklight info shown", "info");
	} else {
		console.log(lines.join("\n"));
	}
}

async function showTasklightInfoOverlay(ctx: OverlayContext): Promise<void> {
	await ctx.ui.custom(
		(tui, theme, _keybindings, done) => {
			const overlay = new TasklightInfoOverlay(theme, done);

			void runTasklightCommand(["doctor"], TASKLIGHT_DOCTOR_TIMEOUT_MS)
				.then((result) => overlay.setDoctorDisplay(doctorDisplayFromResult(result)))
				.catch((error) => {
					overlay.setDoctorDisplay({
						status: "warning",
						headline: `Tasklight doctor failed: ${errorMessage(error)}`,
						lines: [],
					});
				})
				.finally(() => tui.requestRender());

			return overlay;
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "center",
				width: 84,
				minWidth: 64,
				maxHeight: "85%",
				margin: 2,
			},
		},
	);
}

class TasklightInfoOverlay {
	private doctorDisplay: DoctorDisplay = {
		status: "checking",
		headline: "Running tasklight doctor…",
		lines: [],
	};

	constructor(
		private readonly theme: OverlayTheme,
		private readonly done: () => void,
	) {}

	setDoctorDisplay(display: DoctorDisplay): void {
		this.doctorDisplay = display;
		this.invalidate();
	}

	handleInput(data: string): void {
		if (isCloseKey(data)) this.done();
	}

	render(width: number): string[] {
		if (width < 4) return [truncateToWidth("Pi Tasklight", width)];

		const rows = new OverlayRows(width, this.theme);
		rows.topBorder(buildHeaderTitle(this.doctorDisplay, this.theme));
		rows.wrapped("Tasklight notifications for Pi coding-agent sessions.");
		rows.frame(helpLine(this.theme));
		rows.separator();
		renderUsage(rows, this.theme);
		rows.frame();
		renderDoctor(rows, this.theme, this.doctorDisplay);
		rows.separator();
		renderLinks(rows, this.theme);
		rows.frame(`${pink("Contribute")} ${this.theme.fg("muted", "Ideas, issues, and PRs are welcome once the repo is public.")}`);
		rows.bottomBorder();
		return rows.lines;
	}

	invalidate(): void {}
	dispose(): void {}
}

class OverlayRows {
	readonly lines: string[] = [];
	private readonly innerWidth: number;

	constructor(
		private readonly width: number,
		private readonly theme: OverlayTheme,
	) {
		this.innerWidth = Math.max(0, width - 4);
	}

	topBorder(title: string): void {
		const safeTitle = truncateToWidth(title, Math.max(0, this.width - 2));
		const fill = Math.max(0, this.width - visibleWidth(safeTitle) - 2);
		this.lines.push(`${purple("╭")}${safeTitle}${purple(`${"─".repeat(fill)}╮`)}`);
	}

	separator(): void {
		this.lines.push(purple(`├${"─".repeat(Math.max(0, this.width - 2))}┤`));
	}

	bottomBorder(): void {
		this.lines.push(purple(`╰${"─".repeat(Math.max(0, this.width - 2))}╯`));
	}

	frame(content = ""): void {
		const text = truncateToWidth(content, this.innerWidth);
		const padding = " ".repeat(Math.max(0, this.innerWidth - visibleWidth(text)));
		this.lines.push(purple("│ ") + text + padding + purple(" │"));
	}

	wrapped(content: string, prefix = "  "): void {
		const wrapWidth = Math.max(1, this.innerWidth - visibleWidth(prefix));
		for (const line of wrapTextWithAnsi(content, wrapWidth)) {
			this.frame(`${prefix}${line}`);
		}
	}
}

function buildHeaderTitle(doctorDisplay: DoctorDisplay, theme: OverlayTheme): string {
	const status = headerStatus(doctorDisplay.status);
	return `${purple(" ✦ ")}${theme.fg(status.themeColor, theme.bold("Pi Tasklight"))}${theme.fg("dim", " · ")}${pill(status.label, status.pillColor)} `;
}

function headerStatus(status: DoctorDisplay["status"]): {
	label: string;
	pillColor: (value: string) => string;
	themeColor: "success" | "warning" | "dim";
} {
	if (status === "success") return { label: "ready", pillColor: cyan, themeColor: "success" };
	if (status === "warning") return { label: "issues", pillColor: pink, themeColor: "warning" };
	return { label: "checking", pillColor: amber, themeColor: "dim" };
}

function renderUsage(rows: OverlayRows, theme: OverlayTheme): void {
	rows.frame(`  ${violet("●")} ${theme.fg("accent", theme.bold("Usage"))}`);
	rows.frame(`    ${pill("/tl <prompt>", violet)} ${theme.fg("muted", "run one Tasklight-notified Pi task")}`);
	rows.frame(`    ${pill("/tl-toggle", violet)}   ${theme.fg("muted", "toggle notifications for normal prompts")}`);
	rows.frame(`    ${pill("/tl-doctor", violet)}   ${theme.fg("muted", "run Tasklight diagnostics")}`);
}

function renderDoctor(rows: OverlayRows, theme: OverlayTheme, doctorDisplay: DoctorDisplay): void {
	const { color, icon } = doctorStatusStyle(doctorDisplay.status);
	rows.frame(`  ${violet("●")} ${theme.fg("accent", theme.bold("Doctor"))} ${theme.fg(color, `${icon} ${doctorDisplay.headline}`)}`);
	for (const line of doctorDisplay.lines.slice(0, DEFAULT_DOCTOR_OUTPUT_MAX_LINES)) {
		rows.frame(`    ${theme.fg("dim", line.trim())}`);
	}
}

function renderLinks(rows: OverlayRows, theme: OverlayTheme): void {
	rows.frame(`${violet("Repository")} ${theme.fg("muted", PACKAGE_REPO_URL)}`);
	rows.frame(`${cyan("Issues")}     ${theme.fg("muted", PACKAGE_ISSUES_URL)}`);
	rows.frame(`${amber("NPM")}        ${theme.fg("muted", PACKAGE_NPM_URL)}`);
}

function doctorStatusStyle(status: DoctorDisplay["status"]): { color: "success" | "warning" | "dim"; icon: string } {
	if (status === "success") return { color: "success", icon: "✓" };
	if (status === "warning") return { color: "warning", icon: "⚠" };
	return { color: "dim", icon: "…" };
}

function helpLine(theme: OverlayTheme): string {
	return `${pill("Enter", violet)} ${theme.fg("muted", "close")}  ${pill("Esc", violet)} ${theme.fg("muted", "close")}  ${pill("q", violet)} ${theme.fg("muted", "close")}`;
}

function pill(text: string, color: (value: string) => string): string {
	return color(` ${text} `);
}

function isCloseKey(data: string): boolean {
	return CLOSE_TEXT_KEYS.has(data) || (["escape", "return", "enter"] as const).some((key) => matchesKey(data, key));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
