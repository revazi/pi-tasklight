import type { TasklightPackageInfo } from "./doctor.ts";

export const CUSTOM_TYPE = "pi-tasklight";
const PACKAGE_NAME = "@tasklight/pi-tasklight";
export const PACKAGE_REPO_URL = "https://github.com/revazi/pi-tasklight";
export const PACKAGE_ISSUES_URL = `${PACKAGE_REPO_URL}/issues`;
export const PACKAGE_NPM_URL = "https://www.npmjs.com/package/@tasklight/pi-tasklight";
export const TASKLIGHT_DOCTOR_TIMEOUT_MS = 10000;

export const PACKAGE_INFO: TasklightPackageInfo = {
	name: PACKAGE_NAME,
	repoUrl: PACKAGE_REPO_URL,
	issuesUrl: PACKAGE_ISSUES_URL,
	npmUrl: PACKAGE_NPM_URL,
};
