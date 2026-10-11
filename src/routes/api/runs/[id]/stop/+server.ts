import { error, json } from '@sveltejs/kit';
import { stopRun } from '#lib/server/runner.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ params }) => {
	if (!stopRun(params.id)) error(409, 'This run is not in progress');
	return json({ ok: true });
};
