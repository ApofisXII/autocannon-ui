// Which run (if any) is in progress on the server, shared by the header, the form and the run page.

import type { RunSummary } from './types';

export const live = $state<{ activeId: string | null; activeUrl: string | null }>({
	activeId: null,
	activeUrl: null
});

export async function refreshActive() {
	try {
		const res = await fetch('/api/runs');
		const runs: RunSummary[] = await res.json();
		const active = runs.find((r) => r.status === 'running' || r.status === 'stopping');
		live.activeId = active?.id ?? null;
		live.activeUrl = active?.url ?? null;
	} catch {
		/* server unreachable: leave as is */
	}
}
