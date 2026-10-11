import { error, json } from '@sveltejs/kit';
import { getActiveRun } from '#lib/server/runner.js';
import { deleteRun, loadRun } from '#lib/server/store.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const run = getActiveRun(params.id)?.record ?? (await loadRun(params.id));
	if (!run) error(404, 'Run not found');
	return json(run);
};

export const DELETE: RequestHandler = async ({ params }) => {
	if (getActiveRun(params.id)) error(409, 'Stop the run before deleting it');
	await deleteRun(params.id);
	return new Response(null, { status: 204 });
};
