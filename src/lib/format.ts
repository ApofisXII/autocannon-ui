const compactFmt = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1
});
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 1,284 · 12.9K · 4.2M */
export function compact(n: number | null | undefined) {
	if (n == null || !Number.isFinite(n)) return '–';
	return Math.abs(n) < 10_000 ? intFmt.format(n) : compactFmt.format(n);
}

export function int(n: number | null | undefined) {
	if (n == null || !Number.isFinite(n)) return '–';
	return intFmt.format(n);
}

export function ms(n: number | null | undefined) {
	if (n == null || !Number.isFinite(n)) return '–';
	if (n >= 10_000) return `${(n / 1000).toFixed(1)} s`;
	if (n >= 100) return `${Math.round(n)} ms`;
	if (n >= 10) return `${n.toFixed(1)} ms`;
	return `${n.toFixed(2)} ms`;
}

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
export function bytes(n: number | null | undefined) {
	if (n == null || !Number.isFinite(n)) return '–';
	let i = 0;
	let v = n;
	while (Math.abs(v) >= 1000 && i < UNITS.length - 1) {
		v /= 1000;
		i++;
	}
	return `${i === 0 ? Math.round(v) : v.toFixed(v >= 100 ? 0 : 1)} ${UNITS[i]}`;
}

export function seconds(s: number | null | undefined) {
	if (s == null || !Number.isFinite(s)) return '–';
	if (s < 60) return `${Math.round(s)}s`;
	const m = Math.floor(s / 60);
	const r = Math.round(s % 60);
	return r ? `${m}m ${r}s` : `${m}m`;
}

export function dateTime(epoch: number) {
	return new Date(epoch).toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function hostAndPath(url: string) {
	try {
		const u = new URL(url);
		return { host: u.host, path: u.pathname + u.search === '/' ? '' : u.pathname + u.search };
	} catch {
		return { host: url, path: '' };
	}
}

/** Short tick labels: 0 / 25 ms / 1.5 s */
export function msTick(n: number) {
	if (n === 0) return '0';
	if (n >= 1000) return `${Number((n / 1000).toPrecision(3))} s`;
	return `${Number(n.toPrecision(3))} ms`;
}

/** Short tick labels: 0 / 500 kB / 2 MB */
export function bytesTick(n: number) {
	return n === 0 ? '0' : bytes(n).replace(/\.0 /, ' ');
}
