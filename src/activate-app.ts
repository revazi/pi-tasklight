type Env = Record<string, string | undefined>;

export function detectActivateApp(env: Env = process.env): string | undefined {
	return nonEmpty(env.TASKLIGHT_ACTIVATE_APP) ?? nonEmpty(env.__CFBundleIdentifier);
}

function nonEmpty(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized || undefined;
}
