export type Env = Record<string, string | undefined>;

const TERMINAL_APP_NAMES: Record<string, string> = {
	terminal: "Terminal",
	apple_terminal: "Terminal",
	iterm: "iTerm2",
	iterm2: "iTerm2",
	vscode: "Visual Studio Code",
	wezterm: "WezTerm",
	warpterminal: "Warp",
	warp: "Warp",
	kitty: "kitty",
	ghostty: "Ghostty",
};

const BUNDLE_ID_DISPLAY_NAMES: Record<string, string> = {
	"com.apple.Terminal": "Terminal",
	"com.googlecode.iterm2": "iTerm2",
	"com.github.wez.wezterm": "WezTerm",
	"com.microsoft.VSCode": "Visual Studio Code",
	"com.microsoft.VSCodeInsiders": "VS Code Insiders",
	"com.todesktop.230313mzl4w4u92": "Cursor",
	"dev.warp.Warp-Stable": "Warp",
	"com.mitchellh.ghostty": "Ghostty",
	"net.kovidgoyal.kitty": "kitty",
	"org.alacritty": "Alacritty",
};

export function notificationTitle(sessionName?: string, env: Env = process.env): string {
	const suffix = sanitizeTitlePart(sessionName ?? detectAppDisplayName(env) ?? "");
	return suffix ? `Pi - ${suffix}` : "Pi";
}

function sanitizeTitlePart(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function detectActivateApp(env: Env = process.env): string | undefined {
	if (env.TASKLIGHT_ACTIVATE_APP) return env.TASKLIGHT_ACTIVATE_APP;
	if (env.__CFBundleIdentifier) return env.__CFBundleIdentifier;
	return detectTerminalAppName(env);
}

function detectAppDisplayName(env: Env = process.env): string | undefined {
	if (env.PI_TASKLIGHT_TITLE_SUFFIX) return env.PI_TASKLIGHT_TITLE_SUFFIX;
	if (env.__CFBundleIdentifier) {
		return bundleIDDisplayName(env.__CFBundleIdentifier);
	}
	return detectTerminalAppName(env);
}

function detectTerminalAppName(env: Env = process.env): string | undefined {
	const terminal = env.LC_TERMINAL || env.TERM_PROGRAM || "";
	return TERMINAL_APP_NAMES[terminal.toLowerCase()];
}

function bundleIDDisplayName(bundleID: string): string | undefined {
	return BUNDLE_ID_DISPLAY_NAMES[bundleID];
}
