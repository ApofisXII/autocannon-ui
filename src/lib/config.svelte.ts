// The form state lives here (not in a component) so it survives navigation and the
// "Run again" button on a past run can fill it in. A draft is kept in localStorage.

import { coerceOptions } from './options';
import { DEFAULT_OPTIONS, type RunOptions } from './types';

const KEY = 'autocannon-ui:draft';

function load(): RunOptions {
	if (typeof window === 'undefined') return structuredClone(DEFAULT_OPTIONS);
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return coerceOptions(JSON.parse(raw));
	} catch {
		/* storage unavailable or corrupt: start fresh */
	}
	return structuredClone(DEFAULT_OPTIONS);
}

export const config = $state<{ options: RunOptions }>({ options: load() });

export function saveDraft() {
	try {
		localStorage.setItem(KEY, JSON.stringify(config.options));
	} catch {
		/* ignore */
	}
}

export function setOptions(options: RunOptions) {
	config.options = structuredClone(options);
	saveDraft();
}
