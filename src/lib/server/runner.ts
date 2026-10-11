// Runs autocannon in-process and turns its per-response events into 1-second samples
// that the UI can stream. Only one run at a time: parallel load tests from the same
// machine would compete for CPU and skew each other's numbers.

import autocannon from 'autocannon';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { randomBytes } from 'node:crypto';
import type { RunEvent, RunOptions, RunRecord, RunResult, Sample } from '#lib/types.js';
import { saveRun } from './store';

interface ActiveRun {
	record: RunRecord;
	instance: autocannon.Instance | null;
	events: EventEmitter;
}

// Kept on globalThis so Vite's HMR doesn't orphan a running test.
const state: { active: ActiveRun | null } = ((globalThis as any).__autocannonUi ??= {
	active: null
});

export class RunBusyError extends Error {
	constructor(public runId: string) {
		super('Another load test is already running');
	}
}

export function getActiveRun(id?: string): ActiveRun | null {
	const active = state.active;
	if (!active) return null;
	return id === undefined || active.record.id === id ? active : null;
}

export function subscribe(run: ActiveRun, listener: (event: RunEvent) => void) {
	run.events.on('event', listener);
	return () => run.events.off('event', listener);
}

function emit(run: ActiveRun, event: RunEvent) {
	run.events.emit('event', event);
}

function newId() {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	return `${stamp}-${randomBytes(3).toString('hex')}`;
}

function toAutocannonOptions(o: RunOptions): autocannon.Options {
	const positive = (n: number) => (n > 0 ? n : undefined);
	const headers: Record<string, string> = {};
	for (const h of o.headers) if (h.name.trim()) headers[h.name.trim()] = h.value;

	return {
		url: o.url,
		method: o.method,
		connections: o.connections,
		pipelining: o.pipelining,
		timeout: o.timeout,
		headers,
		body: o.body || undefined,
		...(o.mode === 'amount' ? { amount: o.amount } : { duration: o.duration }),
		overallRate: positive(o.overallRate),
		connectionRate: positive(o.connectionRate),
		maxConnectionRequests: positive(o.maxConnectionRequests),
		maxOverallRequests: positive(o.maxOverallRequests),
		reconnectRate: positive(o.reconnectRate),
		bailout: positive(o.bailout),
		expectBody: o.expectBody || undefined,
		title: o.title || undefined,
		ignoreCoordinatedOmission: o.ignoreCoordinatedOmission,
		excludeErrorStats: o.excludeErrorStats,
		idReplacement: o.idReplacement
	} as autocannon.Options;
}

/** Nearest-rank percentile of an ascending array. */
function percentile(sorted: number[], q: number) {
	return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

function pickResult(r: autocannon.Result): RunResult {
	const res = r as any;
	return {
		latency: res.latency,
		requests: res.requests,
		throughput: res.throughput,
		duration: res.duration,
		errors: res.errors,
		timeouts: res.timeouts,
		mismatches: res.mismatches,
		resets: res.resets,
		non2xx: res.non2xx,
		'1xx': res['1xx'],
		'2xx': res['2xx'],
		'3xx': res['3xx'],
		'4xx': res['4xx'],
		'5xx': res['5xx'],
		statusCodeStats: res.statusCodeStats ?? {}
	};
}

function textReport(result: autocannon.Result) {
	// A non-TTY stream makes autocannon render the tables without ANSI colors.
	const text = autocannon.printResult(result, {
		outputStream: new PassThrough() as any,
		renderLatencyTable: false
	});
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1b\[[0-9;]*m/g, '').trim();
}

export function startRun(options: RunOptions): RunRecord {
	if (state.active) throw new RunBusyError(state.active.record.id);

	const record: RunRecord = {
		id: newId(),
		options,
		status: 'running',
		startedAt: Date.now(),
		finishedAt: null,
		stoppedEarly: false,
		samples: [],
		result: null,
		report: null,
		error: null
	};
	const run: ActiveRun = { record, instance: null, events: new EventEmitter() };
	run.events.setMaxListeners(50);
	state.active = run;

	// --- live sampling -------------------------------------------------------
	const countAll = !options.excludeErrorStats; // same rule autocannon uses for its stats
	const t0 = performance.now();
	let bucketStart = t0;
	let latencies: number[] = [];
	let responses = 0;
	let bytes = 0;
	let status: Sample['status'] = [0, 0, 0, 0, 0];
	let errors = 0;
	let timeouts = 0;

	function flush(final = false) {
		const now = performance.now();
		const dt = (now - bucketStart) / 1000;
		// A sliver of a bucket at the very end would show up as a misleading dip.
		if (final && dt < 0.3) return;

		let latency: Sample['latency'] = null;
		if (latencies.length) {
			latencies.sort((a, b) => a - b);
			let sum = 0;
			for (const v of latencies) sum += v;
			latency = {
				p50: percentile(latencies, 0.5),
				p90: percentile(latencies, 0.9),
				p99: percentile(latencies, 0.99),
				max: latencies[latencies.length - 1],
				mean: sum / latencies.length
			};
		}
		const sample: Sample = {
			t: Math.round(((now - t0) / 1000) * 100) / 100,
			dt: Math.round(dt * 1000) / 1000,
			responses,
			bytes,
			status,
			errors,
			timeouts,
			latency
		};
		record.samples.push(sample);
		emit(run, { type: 'sample', sample });

		bucketStart = now;
		latencies = [];
		responses = 0;
		bytes = 0;
		status = [0, 0, 0, 0, 0];
		errors = 0;
		timeouts = 0;
	}

	const timer = setInterval(flush, 1000);

	async function finish(err: unknown, result?: autocannon.Result) {
		clearInterval(timer);
		if (record.status === 'done' || record.status === 'error') return;
		flush(true);
		record.finishedAt = Date.now();
		if (err || !result) {
			record.status = 'error';
			record.error = err instanceof Error ? err.message : String(err ?? 'Unknown error');
		} else {
			record.status = 'done';
			record.result = pickResult(result);
			try {
				record.report = textReport(result);
			} catch {
				record.report = null;
			}
		}
		state.active = null;
		try {
			await saveRun(record);
		} catch (e) {
			console.error('[autocannon-ui] Could not save run', e);
		}
		emit(run, { type: 'done', run: record });
		run.events.removeAllListeners();
	}

	// autocannon reports invalid options through the callback, sometimes synchronously.
	const instance = autocannon(toAutocannonOptions(options), (err, result) => {
		void finish(err, result);
	});
	if (record.status === 'error') return record;
	run.instance = instance;

	instance.on(
		'response',
		(_client: unknown, statusCode: number, resBytes: number, time: number) => {
			const cls = Math.floor(statusCode / 100) - 1;
			if (cls >= 0 && cls < 5) status[cls]++;
			responses++;
			if (cls === 1 || countAll) {
				latencies.push(time);
				bytes += resBytes;
			}
		}
	);
	instance.on('reqError', (error: Error) => {
		errors++;
		if (error?.message === 'request timed out') timeouts++;
	});

	return record;
}

export function stopRun(id: string) {
	const run = getActiveRun(id);
	if (!run || run.record.status !== 'running') return false;
	run.record.status = 'stopping';
	run.record.stoppedEarly = true;
	emit(run, { type: 'status', status: 'stopping' });
	run.instance?.stop();
	return true;
}
