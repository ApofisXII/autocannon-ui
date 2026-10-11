// Types shared by the server (runner, API) and the browser (UI).

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface Header {
	name: string;
	value: string;
}

/** Everything the form can configure. Mirrors the autocannon CLI flags. */
export interface RunOptions {
	url: string;
	method: HttpMethod;
	/** -c */
	connections: number;
	/** stop after `duration` seconds or after `amount` requests */
	mode: 'duration' | 'amount';
	/** -d, seconds */
	duration: number;
	/** -a */
	amount: number;
	/** -p */
	pipelining: number;
	/** -t, seconds */
	timeout: number;
	/** -H */
	headers: Header[];
	/** -b */
	body: string;
	/** -R, requests/sec across all connections (0 = unlimited) */
	overallRate: number;
	/** -r, requests/sec per connection (0 = unlimited) */
	connectionRate: number;
	/** -M (0 = unlimited) */
	maxConnectionRequests: number;
	/** -O (0 = unlimited) */
	maxOverallRequests: number;
	/** -D, reconnect every N requests (0 = never) */
	reconnectRate: number;
	/** -B, stop after N errors (0 = never) */
	bailout: number;
	/** -E */
	expectBody: string;
	/** -T */
	title: string;
	/** -C */
	ignoreCoordinatedOmission: boolean;
	/** -x */
	excludeErrorStats: boolean;
	/** -I */
	idReplacement: boolean;
}

export const DEFAULT_OPTIONS: RunOptions = {
	url: '',
	method: 'GET',
	connections: 10,
	mode: 'duration',
	duration: 10,
	amount: 1000,
	pipelining: 1,
	timeout: 10,
	headers: [],
	body: '',
	overallRate: 0,
	connectionRate: 0,
	maxConnectionRequests: 0,
	maxOverallRequests: 0,
	reconnectRate: 0,
	bailout: 0,
	expectBody: '',
	title: '',
	ignoreCoordinatedOmission: false,
	excludeErrorStats: false,
	idReplacement: false
};

/** Latency percentiles (ms) of the responses received within one sample window. */
export interface LatencySample {
	p50: number;
	p90: number;
	p99: number;
	max: number;
	mean: number;
}

/** One time bucket (normally 1 second) of live data. */
export interface Sample {
	/** seconds since the start of the run, at the end of the bucket */
	t: number;
	/** bucket length in seconds (the last bucket can be shorter) */
	dt: number;
	/** responses received in the bucket */
	responses: number;
	/** response bytes received in the bucket */
	bytes: number;
	/** responses per status class: [1xx, 2xx, 3xx, 4xx, 5xx] */
	status: [number, number, number, number, number];
	/** connection errors + timeouts in the bucket */
	errors: number;
	timeouts: number;
	latency: LatencySample | null;
}

export interface HistogramSummary {
	average: number;
	mean: number;
	stddev: number;
	min: number;
	max: number;
	total: number;
	p1: number;
	p2_5: number;
	p50: number;
	p90: number;
	p97_5: number;
	p99: number;
	p99_9: number;
	[key: string]: number;
}

/** The subset of autocannon's result object we keep. */
export interface RunResult {
	latency: HistogramSummary;
	requests: HistogramSummary & { sent: number };
	throughput: HistogramSummary;
	duration: number;
	errors: number;
	timeouts: number;
	mismatches: number;
	resets: number;
	non2xx: number;
	'1xx': number;
	'2xx': number;
	'3xx': number;
	'4xx': number;
	'5xx': number;
	statusCodeStats: Record<string, { count?: number }>;
}

export type RunStatus = 'running' | 'stopping' | 'done' | 'error';

export interface RunRecord {
	id: string;
	options: RunOptions;
	status: RunStatus;
	/** epoch ms */
	startedAt: number;
	finishedAt: number | null;
	/** true when the run was stopped by hand before its planned end */
	stoppedEarly: boolean;
	samples: Sample[];
	result: RunResult | null;
	/** autocannon's own text report, as printed in the terminal */
	report: string | null;
	error: string | null;
}

/** Lightweight row for the history list. */
export interface RunSummary {
	id: string;
	url: string;
	method: HttpMethod;
	title: string;
	connections: number;
	status: RunStatus;
	startedAt: number;
	duration: number | null;
	reqPerSec: number | null;
	latencyP99: number | null;
	latencyAvg: number | null;
	totalRequests: number | null;
	errors: number | null;
	non2xx: number | null;
}

/** Server-sent events on /api/runs/[id]/events */
export type RunEvent =
	| { type: 'snapshot'; run: RunRecord }
	| { type: 'sample'; sample: Sample }
	| { type: 'status'; status: RunStatus }
	| { type: 'done'; run: RunRecord };

export function summarize(run: RunRecord): RunSummary {
	const r = run.result;
	return {
		id: run.id,
		url: run.options.url,
		method: run.options.method,
		title: run.options.title,
		connections: run.options.connections,
		status: run.status,
		startedAt: run.startedAt,
		duration: r?.duration ?? null,
		reqPerSec: r?.requests.average ?? null,
		latencyP99: r?.latency.p99 ?? null,
		latencyAvg: r?.latency.average ?? null,
		totalRequests: r ? r.requests.total : null,
		errors: r?.errors ?? null,
		non2xx: r?.non2xx ?? null
	};
}
