import { describe, expect, it } from "vitest";
import {
	doctorDisplayFromResult,
	formatCommandOutput,
	tasklightInfoPlainLines,
	type TasklightPackageInfo,
} from "../src/doctor.ts";

const packageInfo: TasklightPackageInfo = {
	name: "@tasklight/pi-tasklight",
	repoUrl: "https://github.com/revazi/pi-tasklight",
	issuesUrl: "https://github.com/revazi/pi-tasklight/issues",
	npmUrl: "https://www.npmjs.com/package/@tasklight/pi-tasklight",
};

describe("doctor helpers", () => {
	it("formats command output from stdout, stderr, and fallback errors", () => {
		expect(formatCommandOutput({ code: 0, stdout: "ok\n", stderr: "" })).toBe("ok");
		expect(formatCommandOutput({ code: 1, stdout: "out\n", stderr: "err\n", error: "boom" })).toBe("out\nerr");
		expect(formatCommandOutput({ code: 1, stdout: "", stderr: "", error: "spawn failed" })).toBe("spawn failed");
	});

	it("builds a passing doctor display and prioritizes the result line", () => {
		const display = doctorDisplayFromResult({
			code: 0,
			stdout: "Tasklight doctor\n  • Platform darwin/arm64\n  ✓ result Tasklight looks ready\n",
			stderr: "",
		});

		expect(display.status).toBe("success");
		expect(display.headline).toBe("Tasklight doctor passed");
		expect(display.lines[0]).toContain("result");
	});

	it("builds a warning doctor display when the command fails", () => {
		const display = doctorDisplayFromResult({ code: 1, stdout: "", stderr: "missing cli" });

		expect(display.status).toBe("warning");
		expect(display.headline).toBe("Tasklight doctor found issues");
		expect(display.lines).toEqual(["missing cli"]);
	});

	it("builds plain fallback info lines with contribution links", () => {
		const lines = tasklightInfoPlainLines({ status: "success", headline: "Tasklight doctor passed", lines: ["✓ ready"] }, packageInfo);

		expect(lines).toContain("@tasklight/pi-tasklight");
		expect(lines).toContain(`Repository: ${packageInfo.repoUrl}`);
		expect(lines).toContain(`Issues:     ${packageInfo.issuesUrl}`);
		expect(lines.join("\n")).toContain("Contributions welcome");
	});
});
