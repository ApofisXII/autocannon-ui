// Converts between RunOptions and an `autocannon …` terminal command, so a test can be
// moved back and forth between the UI and the shell.

import { DEFAULT_OPTIONS, HTTP_METHODS, type HttpMethod, type RunOptions } from './types';

type NumKey =
	| 'connections'
	| 'duration'
	| 'amount'
	| 'pipelining'
	| 'timeout'
	| 'overallRate'
	| 'connectionRate'
	| 'maxConnectionRequests'
	| 'maxOverallRequests'
	| 'reconnectRate'
	| 'bailout';
type BoolKey = 'ignoreCoordinatedOmission' | 'excludeErrorStats' | 'idReplacement';
type StrKey = 'body' | 'expectBody' | 'title';

const NUM_FLAGS: Record<string, NumKey> = {
	c: 'connections',
	connections: 'connections',
	d: 'duration',
	duration: 'duration',
	a: 'amount',
	amount: 'amount',
	p: 'pipelining',
	pipelining: 'pipelining',
	t: 'timeout',
	timeout: 'timeout',
	R: 'overallRate',
	overallRate: 'overallRate',
	r: 'connectionRate',
	connectionRate: 'connectionRate',
	M: 'maxConnectionRequests',
	maxConnectionRequests: 'maxConnectionRequests',
	O: 'maxOverallRequests',
	maxOverallRequests: 'maxOverallRequests',
	D: 'reconnectRate',
	reconnectRate: 'reconnectRate',
	B: 'bailout',
	bailout: 'bailout'
};
const BOOL_FLAGS: Record<string, BoolKey> = {
	C: 'ignoreCoordinatedOmission',
	ignoreCoordinatedOmission: 'ignoreCoordinatedOmission',
	x: 'excludeErrorStats',
	excludeErrorStats: 'excludeErrorStats',
	I: 'idReplacement',
	idReplacement: 'idReplacement'
};
const STR_FLAGS: Record<string, StrKey> = {
	b: 'body',
	body: 'body',
	E: 'expectBody',
	expectBody: 'expectBody',
	T: 'title',
	title: 'title'
};
/** Terminal-only flags: accepted silently because they change nothing in the UI. */
const IGNORED_BOOL = new Set([
	'j',
	'json',
	'n',
	'l',
	'latency',
	'renderLatencyTable',
	'progress',
	'renderProgressBar',
	'statusCodes',
	'renderStatusCodes',
	'V',
	'verbose',
	'debug',
	'no-progress'
]);

/** Shell-like tokenizer: handles '…', "…", backslash escapes and line continuations. */
export function tokenize(input: string): string[] {
	const tokens: string[] = [];
	let cur = '';
	let has = false;
	let quote: "'" | '"' | null = null;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (quote === "'") {
			if (ch === "'") quote = null;
			else cur += ch;
		} else if (quote === '"') {
			if (ch === '"') quote = null;
			else if (ch === '\\' && i + 1 < input.length && '"\\$`'.includes(input[i + 1]))
				cur += input[++i];
			else cur += ch;
		} else if (ch === "'" || ch === '"') {
			quote = ch;
			has = true;
		} else if (ch === '\\') {
			const next = input[i + 1];
			if (next === '\n') i++;
			else if (next === '\r' && input[i + 2] === '\n') i += 2;
			else if (next !== undefined) {
				cur += next;
				has = true;
				i++;
			}
		} else if (/\s/.test(ch)) {
			if (has) tokens.push(cur);
			cur = '';
			has = false;
		} else {
			cur += ch;
			has = true;
		}
	}
	if (quote) throw new Error('The command has an unclosed quote.');
	if (has) tokens.push(cur);
	return tokens;
}

export interface ParsedCommand {
	options: RunOptions;
	/** flags that were understood but can't be used from the UI */
	ignored: string[];
}

export function parseCommand(input: string): ParsedCommand {
	const tokens = tokenize(input.trim());
	const options: RunOptions = structuredClone(DEFAULT_OPTIONS);
	const ignored: string[] = [];
	let sawAmount = false;
	let sawDuration = false;

	// Drop the program name: `autocannon`, `npx autocannon`, `npx autocannon@8`, …
	while (tokens.length && /^(npx|pnpx|bunx|-y|--yes|.*autocannon(@\S+)?)$/.test(tokens[0]))
		tokens.shift();

	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (!tok.startsWith('-') || tok === '-') {
			if (options.url) throw new Error(`Unexpected argument "${tok}".`);
			options.url = tok;
			continue;
		}

		let name: string;
		let inline: string | undefined;
		if (tok.startsWith('--')) {
			const eq = tok.indexOf('=');
			name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
			inline = eq === -1 ? undefined : tok.slice(eq + 1);
		} else {
			name = tok[1];
			inline = tok.length > 2 ? tok.slice(2).replace(/^=/, '') : undefined;
		}
		const takeValue = () => {
			if (inline !== undefined) return inline;
			const v = tokens[++i];
			if (v === undefined) throw new Error(`Missing value for ${tok}.`);
			return v;
		};

		if (name in NUM_FLAGS) {
			const key = NUM_FLAGS[name];
			const raw = takeValue();
			const n = Number(raw);
			if (!Number.isFinite(n)) throw new Error(`${tok} expects a number, got "${raw}".`);
			options[key] = n;
			if (key === 'amount') sawAmount = true;
			if (key === 'duration') sawDuration = true;
		} else if (name in BOOL_FLAGS) {
			options[BOOL_FLAGS[name]] = inline === undefined ? true : inline !== 'false';
		} else if (name in STR_FLAGS) {
			options[STR_FLAGS[name]] = takeValue();
		} else if (name === 'm' || name === 'method') {
			const m = takeValue().toUpperCase();
			if (!HTTP_METHODS.includes(m as HttpMethod)) throw new Error(`Unsupported method "${m}".`);
			options.method = m as HttpMethod;
		} else if (name === 'H' || name === 'header' || name === 'headers') {
			const raw = takeValue();
			const colon = raw.indexOf(':');
			const eq = raw.indexOf('=');
			const idx = Math.min(colon < 0 ? Infinity : colon, eq < 0 ? Infinity : eq);
			if (!Number.isFinite(idx) || idx === 0)
				throw new Error(`Header "${raw}" should look like "Name: value".`);
			options.headers.push({ name: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() });
		} else if (IGNORED_BOOL.has(name)) {
			// terminal output switches
		} else {
			// Anything else (workers, forms, HAR files, sockets, …) isn't supported by the UI.
			// Skip its value if it has one.
			if (
				inline === undefined &&
				tokens[i + 1] &&
				!tokens[i + 1].startsWith('-') &&
				i + 2 < tokens.length
			)
				i++;
			ignored.push(tok);
		}
	}

	if (!options.url) throw new Error('The command has no URL.');
	options.mode = sawAmount && !sawDuration ? 'amount' : 'duration';
	return { options, ignored };
}

function shellQuote(s: string) {
	if (/^[\w@%+=:,./-]+$/.test(s)) return s;
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function toCommand(o: RunOptions): string {
	const parts: string[] = ['autocannon'];
	const add = (flag: string, value?: string | number) =>
		parts.push(value === undefined ? flag : `${flag} ${shellQuote(String(value))}`);

	add('-c', o.connections);
	if (o.mode === 'amount') add('-a', o.amount);
	else add('-d', o.duration);
	if (o.pipelining !== 1) add('-p', o.pipelining);
	if (o.timeout !== DEFAULT_OPTIONS.timeout) add('-t', o.timeout);
	if (o.method !== 'GET') add('-m', o.method);
	for (const h of o.headers) if (h.name.trim()) add('-H', `${h.name.trim()}: ${h.value}`);
	if (o.body) add('-b', o.body);
	if (o.overallRate > 0) add('-R', o.overallRate);
	if (o.connectionRate > 0) add('-r', o.connectionRate);
	if (o.maxConnectionRequests > 0) add('-M', o.maxConnectionRequests);
	if (o.maxOverallRequests > 0) add('-O', o.maxOverallRequests);
	if (o.reconnectRate > 0) add('-D', o.reconnectRate);
	if (o.bailout > 0) add('-B', o.bailout);
	if (o.expectBody) add('-E', o.expectBody);
	if (o.title) add('-T', o.title);
	if (o.ignoreCoordinatedOmission) add('-C');
	if (o.excludeErrorStats) add('-x');
	if (o.idReplacement) add('-I');
	parts.push(shellQuote(o.url || '<url>'));
	return parts.join(' ');
}
