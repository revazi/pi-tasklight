import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { TasklightCommandResult } from "./doctor.ts";
import { detectActivateApp } from "./title.ts";

const requireFromTasklightCli = createRequire(import.meta.url);

type NotifyOptions = {
	title: string;
	subtitle: string;
	message: string;
};

type TasklightCliPackage = {
	bin?: string | Record<string, string>;
};

type TasklightExecutable = {
	command: string;
	baseArgs: string[];
};

export async function sendTasklightNotification(options: NotifyOptions): Promise<{ ok: true } | { ok: false; error: string }> {
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

export async function runTasklightCommand(args: string[], timeout: number): Promise<TasklightCommandResult> {
	const explicitTasklightBin = process.env.TASKLIGHT_BIN?.trim();
	if (explicitTasklightBin) {
		return execTasklightFile(explicitTasklightBin, args, timeout);
	}

	const dependencyExecutable = tasklightDependencyExecutable();
	if (dependencyExecutable) {
		return execTasklightFile(dependencyExecutable.command, [...dependencyExecutable.baseArgs, ...args], timeout);
	}

	const pathResult = await execTasklightFile("tasklight", args, timeout);
	if (!isCommandNotFound(pathResult)) return pathResult;

	return execTasklightFile(npxCommand(), ["-y", "@tasklight/cli", ...args], Math.max(timeout, 15000));
}

function execTasklightFile(command: string, args: string[], timeout: number): Promise<TasklightCommandResult> {
	return new Promise((resolve) => {
		execFile(command, args, { timeout }, (error: any, stdout, stderr) => {
			resolve({
				code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
				stdout: stdout?.toString() ?? "",
				stderr: stderr?.toString() ?? "",
				error: error?.message,
				errorCode: error?.code,
			});
		});
	});
}

function tasklightDependencyExecutable(): TasklightExecutable | undefined {
	try {
		return executableFromPackageJsonPath(requireFromTasklightCli.resolve("@tasklight/cli/package.json"));
	} catch {
		return undefined;
	}
}

function executableFromPackageJsonPath(packageJsonPath: string): TasklightExecutable | undefined {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as TasklightCliPackage;
	const binPath = tasklightBinPath(packageJson);
	return binPath ? executableFromBinPath(resolve(dirname(packageJsonPath), binPath)) : undefined;
}

function tasklightBinPath(packageJson: TasklightCliPackage): string | undefined {
	return typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.tasklight;
}

function executableFromBinPath(binPath: string): TasklightExecutable | undefined {
	if (!existsSync(binPath)) return undefined;
	if (/\.[cm]?js$/i.test(binPath)) return { command: process.execPath, baseArgs: [binPath] };
	return { command: binPath, baseArgs: [] };
}

function isCommandNotFound(result: TasklightCommandResult): boolean {
	return result.errorCode === "ENOENT";
}

function npxCommand(): string {
	return process.platform === "win32" ? "npx.cmd" : "npx";
}
