export function formatDuration(ms: number): string {
	if (ms < 1000) return "<1s";
	const totalSeconds = Math.round(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes === 0) return `${seconds}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	if (hours === 0) return `${minutes}m ${seconds}s`;
	return `${hours}h ${remainingMinutes}m ${seconds}s`;
}
