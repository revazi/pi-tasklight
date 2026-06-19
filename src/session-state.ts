type SessionEntry = {
	type?: unknown;
	customType?: unknown;
	data?: Record<string, unknown>;
};

export function latestAlwaysEnabled(entries: readonly unknown[], customType: string): boolean | undefined {
	return latestBooleanEntry(entries, customType, "alwaysEnabled");
}

function latestBooleanEntry(entries: readonly unknown[], customType: string, key: string): boolean | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = sessionEntry(entries[i]);
		if (entry?.type !== "custom" || entry.customType !== customType) continue;
		if (typeof entry.data?.[key] === "boolean") return entry.data[key];
	}
	return undefined;
}

function sessionEntry(value: unknown): SessionEntry | undefined {
	return typeof value === "object" && value !== null ? (value as SessionEntry) : undefined;
}

export function parseBooleanEnv(value: string | undefined): boolean | undefined {
	if (!value) return undefined;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return undefined;
}
