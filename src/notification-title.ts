type Env = Record<string, string | undefined>;

const TITLE_SEPARATOR = " · ";
const MAX_TITLE_PART_LENGTH = 80;

export function notificationTitle(sessionName?: string, env: Env = process.env): string {
	return uniqueNonEmpty(["Pi", titleContext(env), sessionName].map(sanitizeTitlePart)).join(TITLE_SEPARATOR);
}

function titleContext(env: Env): string {
	return sanitizeTitlePart(env.PI_TASKLIGHT_TITLE_SUFFIX) || directoryName(env.PWD) || "";
}

function directoryName(path: string | undefined): string | undefined {
	const folder = (path?.trim() || process.cwd())
		.replace(/[\\/]+$/, "")
		.split(/[\\/]/)
		.pop();
	return sanitizeTitlePart(folder);
}

function sanitizeTitlePart(value: string | undefined): string {
	return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_PART_LENGTH);
}

function uniqueNonEmpty(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		if (!value || seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	return result;
}
