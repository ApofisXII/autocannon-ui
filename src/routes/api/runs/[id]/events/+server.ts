import { error } from '@sveltejs/kit';
import { getActiveRun, subscribe } from '#lib/server/runner.js';
import type { RunEvent } from '#lib/types.js';
import type { RequestHandler } from './$types';

/**
 * Server-sent events for a run in progress: a `snapshot` first (so a reload resumes
 * where it left off), then one `sample` per second, then `done` with the final record.
 */
export const GET: RequestHandler = ({ params, request }) => {
	const run = getActiveRun(params.id);
	if (!run) error(404, 'This run is not in progress');

	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (event: RunEvent) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				} catch {
					cleanup();
				}
			};
			// Comment lines keep proxies and the browser from timing out an idle stream.
			const keepAlive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch {
					cleanup();
				}
			}, 15_000);
			const unsubscribe = subscribe(run, (event) => {
				send(event);
				if (event.type === 'done') {
					cleanup();
					try {
						controller.close();
					} catch {
						/* already closed */
					}
				}
			});
			cleanup = () => {
				clearInterval(keepAlive);
				unsubscribe();
			};
			request.signal.addEventListener('abort', () => cleanup());
			send({ type: 'snapshot', run: run.record });
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
};
