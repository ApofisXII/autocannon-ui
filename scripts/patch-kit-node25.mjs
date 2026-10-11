// SvelteKit 3.0.1 calls util.styleText('grey', …), which Node 25 rejects ("gray" only),
// so `vite build` crashes. Rewrite the two call sites. Safe to run repeatedly; delete this
// script (and the postinstall entry) once a SvelteKit release fixes it.
import { readFile, writeFile } from 'node:fs/promises';

const files = [
	'node_modules/@sveltejs/kit/src/cli.js',
	'node_modules/@sveltejs/kit/src/core/utils.js'
];

for (const file of files) {
	try {
		const src = await readFile(file, 'utf8');
		const out = src.replaceAll("styleText('grey'", "styleText('gray'");
		if (out !== src) await writeFile(file, out);
	} catch {
		// file moved in a newer SvelteKit: nothing to patch
	}
}
