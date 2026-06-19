export const DEFAULT_DOCTOR_OUTPUT_MAX_LINES = 8;

export type TasklightCommandResult = {
	code: number;
	stdout: string;
	stderr: string;
	error?: string;
	errorCode?: string | number;
};

export type DoctorDisplay = {
	status: "checking" | "success" | "warning";
	headline: string;
	lines: string[];
};

export type TasklightPackageInfo = {
	name: string;
	repoUrl: string;
	issuesUrl: string;
	npmUrl: string;
};

export function doctorDisplayFromResult(result: TasklightCommandResult, maxLines = DEFAULT_DOCTOR_OUTPUT_MAX_LINES): DoctorDisplay {
	const output = formatCommandOutput(result).trim();
	const lines = output
		? output
				.split("\n")
				.map((line) => line.trimEnd())
				.filter((line) => line.trim())
		: ["tasklight doctor produced no output"];
	const resultLine = [...lines].reverse().find((line) => line.toLowerCase().includes("result")) ?? lines[lines.length - 1];

	return {
		status: result.code === 0 ? "success" : "warning",
		headline: result.code === 0 ? "Tasklight doctor passed" : "Tasklight doctor found issues",
		lines: prioritizeDoctorResultLine(lines, resultLine).slice(0, maxLines),
	};
}

export function formatCommandOutput(result: TasklightCommandResult): string {
	const parts = [];
	if (result.stdout.trim()) parts.push(result.stdout.trim());
	if (result.stderr.trim()) parts.push(result.stderr.trim());
	if (result.error && !result.stderr.trim()) parts.push(result.error);
	return parts.join("\n");
}

export function tasklightInfoPlainLines(doctorDisplay: DoctorDisplay, packageInfo: TasklightPackageInfo): string[] {
	return [
		"Pi Tasklight",
		packageInfo.name,
		"",
		"Tasklight notifications for Pi coding-agent sessions.",
		"",
		"Usage:",
		"  /tl <prompt>   Run one Tasklight-notified Pi task",
		"  /tl-toggle     Toggle notifications for normal prompts",
		"  /tl-doctor     Run Tasklight diagnostics",
		"",
		`Doctor: ${doctorDisplay.headline}`,
		...doctorDisplay.lines.map((line) => `  ${line}`),
		"",
		`Repository: ${packageInfo.repoUrl}`,
		`Issues:     ${packageInfo.issuesUrl}`,
		`NPM:        ${packageInfo.npmUrl}`,
		"",
		"Contributions welcome — open issues, suggest improvements, or send PRs.",
	];
}

function prioritizeDoctorResultLine(lines: string[], resultLine: string | undefined): string[] {
	if (!resultLine) return lines;
	return [resultLine, ...lines.filter((line) => line !== resultLine)];
}
