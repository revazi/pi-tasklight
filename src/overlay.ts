import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { PACKAGE_INFO, PACKAGE_ISSUES_URL, PACKAGE_NAME, PACKAGE_NPM_URL, PACKAGE_REPO_URL, TASKLIGHT_DOCTOR_TIMEOUT_MS } from "./constants.ts";
import { DEFAULT_DOCTOR_OUTPUT_MAX_LINES, doctorDisplayFromResult, tasklightInfoPlainLines, type DoctorDisplay } from "./doctor.ts";
import { runTasklightCommand } from "./tasklight-cli.ts";

export async function showTasklightInfo(ctx: any): Promise<void> {
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

async function showTasklightInfoOverlay(ctx: any): Promise<void> {
	await ctx.ui.custom(
		(tui: any, theme: any, _keybindings: any, done: () => void) => {
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
		private readonly theme: any,
		private readonly done: () => void,
	) {}

	setDoctorDisplay(display: DoctorDisplay): void {
		this.doctorDisplay = display;
		this.invalidate();
	}

	handleInput(data: string): void {
		if (isCloseKey(data)) {
			this.done();
		}
	}

	render(width: number): string[] {
		if (width < 4) return [truncateToWidth("Tasklight for Pi", width)];

		const rows = new OverlayRows(width, this.theme);
		rows.borderTop();
		rows.row(` ${this.theme.fg("accent", this.theme.bold("Tasklight for Pi"))}`);
		rows.row(` ${this.theme.fg("dim", PACKAGE_NAME)}`);
		rows.row();
		rows.wrapped("Run Pi tasks and get a desktop notification with a short outcome summary when Pi finishes. No second summarization model call is needed.");
		rows.row();
		renderUsage(rows, this.theme);
		rows.row();
		renderDoctor(rows, this.theme, this.doctorDisplay);
		rows.row();
		renderLinks(rows, this.theme);
		rows.row();
		rows.wrapped(this.theme.fg("success", "Contributions welcome — open issues, suggest improvements, or send PRs."));
		rows.row(` ${this.theme.fg("dim", "Enter / Esc / q to close")}`);
		rows.borderBottom();
		return rows.lines;
	}

	invalidate(): void {}
	dispose(): void {}
}

class OverlayRows {
	readonly lines: string[] = [];
	private readonly innerWidth: number;

	constructor(width: number, private readonly theme: any) {
		this.innerWidth = Math.max(1, width - 2);
	}

	borderTop(): void {
		this.lines.push(this.border(`╭${"─".repeat(this.innerWidth)}╮`));
	}

	borderBottom(): void {
		this.lines.push(this.border(`╰${"─".repeat(this.innerWidth)}╯`));
	}

	row(content = ""): void {
		this.lines.push(`${this.border("│")}${padVisible(truncateToWidth(content, this.innerWidth), this.innerWidth)}${this.border("│")}`);
	}

	wrapped(content: string, prefix = " "): void {
		const wrapWidth = Math.max(1, this.innerWidth - visibleWidth(prefix));
		for (const line of wrapTextWithAnsi(content, wrapWidth)) {
			this.row(`${prefix}${line}`);
		}
	}

	private border(value: string): string {
		return this.theme.fg("border", value);
	}
}

function renderUsage(rows: OverlayRows, theme: any): void {
	rows.row(` ${theme.fg("accent", "Usage")}`);
	rows.row("   /tl <prompt>   Run one Tasklight-notified Pi task");
	rows.row("   /tl-on         Notify after every normal Pi prompt");
	rows.row("   /tl-doctor     Run Tasklight diagnostics");
}

function renderDoctor(rows: OverlayRows, theme: any, doctorDisplay: DoctorDisplay): void {
	const { color, icon } = doctorStatusStyle(doctorDisplay.status);
	rows.row(` ${theme.fg("accent", "Doctor")}: ${theme.fg(color, `${icon} ${doctorDisplay.headline}`)}`);
	for (const line of doctorDisplay.lines.slice(0, DEFAULT_DOCTOR_OUTPUT_MAX_LINES)) {
		rows.row(`   ${theme.fg("dim", line.trim())}`);
	}
}

function renderLinks(rows: OverlayRows, theme: any): void {
	rows.row(` ${theme.fg("accent", "Repository")}: ${PACKAGE_REPO_URL}`);
	rows.row(` ${theme.fg("accent", "Issues")}:     ${PACKAGE_ISSUES_URL}`);
	rows.row(` ${theme.fg("accent", "NPM")}:        ${PACKAGE_NPM_URL}`);
}

function doctorStatusStyle(status: DoctorDisplay["status"]): { color: "success" | "warning" | "dim"; icon: string } {
	if (status === "success") return { color: "success", icon: "✓" };
	if (status === "warning") return { color: "warning", icon: "⚠" };
	return { color: "dim", icon: "…" };
}

function isCloseKey(data: string): boolean {
	return matchesKey(data, "escape") || matchesKey(data, "return") || matchesKey(data, "enter") || data === "q" || data === "Q";
}

function padVisible(value: string, width: number): string {
	return `${value}${" ".repeat(Math.max(0, width - visibleWidth(value)))}`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
