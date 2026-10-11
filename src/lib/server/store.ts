// Run history, persisted as one JSON file per run in DATA_DIR (default: ./data/runs).

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarize, type RunRecord, type RunSummary } from '#lib/types.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data', 'runs');
const ID_RE = /^[a-z0-9-]+$/i;

function fileFor(id: string) {
	if (!ID_RE.test(id)) throw new Error(`Invalid run id: ${id}`);
	return path.join(DATA_DIR, `${id}.json`);
}

export async function saveRun(run: RunRecord) {
	await mkdir(DATA_DIR, { recursive: true });
	await writeFile(fileFor(run.id), JSON.stringify(run));
}

export async function loadRun(id: string): Promise<RunRecord | null> {
	if (!ID_RE.test(id)) return null;
	try {
		return JSON.parse(await readFile(fileFor(id), 'utf8'));
	} catch {
		return null;
	}
}

export async function deleteRun(id: string) {
	if (!ID_RE.test(id)) return;
	await rm(fileFor(id), { force: true });
}

export async function listRuns(): Promise<RunSummary[]> {
	let files: string[];
	try {
		files = await readdir(DATA_DIR);
	} catch {
		return [];
	}
	const runs = await Promise.all(
		files.filter((f) => f.endsWith('.json')).map((f) => loadRun(f.slice(0, -'.json'.length)))
	);
	return runs
		.filter((r): r is RunRecord => r !== null)
		.map(summarize)
		.sort((a, b) => b.startedAt - a.startedAt);
}
