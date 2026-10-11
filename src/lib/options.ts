// Validation of run options. Used by the form (to show errors) and by the API
// (which never trusts the client).

import { DEFAULT_OPTIONS, HTTP_METHODS, type HttpMethod, type RunOptions } from './types';

export type OptionErrors = Partial<Record<keyof RunOptions, string>>;

const INT_LIMITS: Partial<Record<keyof RunOptions, [min: number, max: number]>> = {
	connections: [1, 10_000],
	duration: [1, 86_400],
	amount: [1, 1_000_000_000],
	pipelining: [1, 1_000],
	timeout: [1, 3_600],
	overallRate: [0, 10_000_000],
	connectionRate: [0, 10_000_000],
	maxConnectionRequests: [0, 1_000_000_000],
	maxOverallRequests: [0, 1_000_000_000],
	reconnectRate: [0, 1_000_000_000],
	bailout: [0, 1_000_000_000]
};

export function validateOptions(o: RunOptions): OptionErrors {
	const errors: OptionErrors = {};

	let url: URL | null = null;
	try {
		url = new URL(o.url.trim());
	} catch {
		/* handled below */
	}
	if (!o.url.trim()) errors.url = 'Enter the URL to test.';
	else if (!url || !['http:', 'https:'].includes(url.protocol))
		errors.url = 'Use a full http:// or https:// URL.';

	if (!HTTP_METHODS.includes(o.method)) errors.method = 'Unsupported method.';

	for (const [key, [min, max]] of Object.entries(INT_LIMITS) as [
		keyof RunOptions,
		[number, number]
	][]) {
		if (key === 'duration' && o.mode !== 'duration') continue;
		if (key === 'amount' && o.mode !== 'amount') continue;
		const v = o[key] as number;
		if (!Number.isInteger(v) || v < min || v > max)
			errors[key] = `Whole number between ${min} and ${max.toLocaleString('en-US')}.`;
	}

	if (o.headers.some((h) => !h.name.trim() && h.value.trim()))
		errors.headers = 'Every header needs a name.';
	else if (o.headers.some((h) => /[\s:]/.test(h.name.trim())))
		errors.headers = 'Header names cannot contain spaces or colons.';

	return errors;
}

/** Coerces untrusted JSON into RunOptions, filling gaps with defaults. */
export function coerceOptions(input: unknown): RunOptions {
	const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	const out: RunOptions = structuredClone(DEFAULT_OPTIONS);

	const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
	const num = (v: unknown, fallback: number) => {
		const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
		return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
	};
	const bool = (v: unknown) => v === true;

	out.url = str(src.url, '').trim();
	out.method = (typeof src.method === 'string' ? src.method.toUpperCase() : 'GET') as HttpMethod;
	out.mode = src.mode === 'amount' ? 'amount' : 'duration';
	for (const key of Object.keys(INT_LIMITS) as (keyof RunOptions)[]) {
		(out as any)[key] = num(src[key], DEFAULT_OPTIONS[key] as number);
	}
	out.headers = Array.isArray(src.headers)
		? src.headers
				.filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
				.map((h) => ({ name: str(h.name, ''), value: str(h.value, '') }))
		: [];
	out.body = str(src.body, '');
	out.expectBody = str(src.expectBody, '');
	out.title = str(src.title, '');
	out.ignoreCoordinatedOmission = bool(src.ignoreCoordinatedOmission);
	out.excludeErrorStats = bool(src.excludeErrorStats);
	out.idReplacement = bool(src.idReplacement);
	return out;
}
