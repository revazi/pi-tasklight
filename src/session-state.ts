export function latestAlwaysEnabled(entries: any[], customType: string): boolean | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type !== "custom" || entry.customType !== customType) continue;
		if (typeof entry.data?.alwaysEnabled === "boolean") {
			return entry.data.alwaysEnabled;
		}
	}
	return undefined;
}

export function parseBooleanEnv(value: string | undefined): boolean | undefined {
	if (!value) return undefined;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return undefined;
}
