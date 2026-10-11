import { error, json } from '@sveltejs/kit';
import { coerceOptions, validateOptions } from '#lib/options.js';
import { getActiveRun, RunBusyError, startRun } from '#lib/server/runner.js';
import { listRuns } from '#lib/server/store.js';
import { summarize } from '#lib/types.js';
import type { RequestHandler } from './$types';

/** History, newest first. The run in progress (if any) is listed on top. */
export const GET: RequestHandler = async () => {
	const runs = await listRuns();
	const active = getActiveRun();
	if (active) runs.unshift(summarize(active.record));
	return json(runs);
};

/** Starts a load test. Body: RunOptions. */
export const POST: RequestHandler = async ({ request }) => {
	const options = coerceOptions(await request.json().catch(() => null));
	const errors = validateOptions(options);
	if (Object.keys(errors).length)
		return json({ message: 'Invalid options', errors }, { status: 400 });

	try {
		const run = startRun(options);
		if (run.status === 'error') error(400, run.error ?? 'autocannon rejected the options');
		return json({ id: run.id }, { status: 201 });
	} catch (e) {
		if (e instanceof RunBusyError)
			return json({ message: e.message, runId: e.runId }, { status: 409 });
		throw e;
	}
};
