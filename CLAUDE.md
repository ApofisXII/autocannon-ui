# autocannon ui

Local web UI for running autocannon load tests with live charts. Single-user, runs on the user's machine; not a SaaS. The owner may publish it on GitHub for others to run locally.

## Stack

- **SvelteKit 3 + Svelte 5 (runes)**, adapter-node. Node 25 locally.
- **Tailwind CSS 4 + shadcn-svelte** (style "nova", base zinc, blue theme, Geist / Geist Mono). Theme tokens live in `src/routes/layout.css`; light/dark via `mode-watcher` (`.dark` class).
- **uPlot** for charts, wrapped in `src/lib/components/Chart.svelte`.
- **autocannon 8**, used through its Node API in-process.

## SvelteKit 3 gotchas

- The lib alias is **`#lib`** (Node subpath imports in `package.json`), not `$lib`. Imports need explicit extensions: `#lib/types.js`, `#lib/config.svelte.js`, `#lib/components/ui/button/index.js`. Relative imports inside `src/lib` can stay extensionless.
- `$app/environment` doesn't exist; use `typeof window` checks (or `$app/env`).
- `tsconfig.json` extends `$app/tsconfig`, generated into `node_modules/$app` by `svelte-kit sync`. `npm install` can wipe it: run `npx svelte-kit sync` before `svelte-check` or `npx shadcn-svelte add …`, or those fail with "File '$app/tsconfig' not found".
- `vite build` crashes on Node 25 with Kit 3.0.1 (`styleText('grey')`). `scripts/patch-kit-node25.mjs` fixes it and runs from the `prepare` script after every install. Remove both once Kit ships a fix.
- shadcn-svelte CLI is interactive; `add` works with `-y -o < /dev/null`. Components go to `src/lib/components/ui/` — don't hand-edit them unless necessary.

## Architecture

```
src/lib/types.ts          shared types: RunOptions, Sample, RunRecord, RunEvent, RunSummary
src/lib/options.ts        validateOptions (form + API) and coerceOptions (untrusted JSON → RunOptions)
src/lib/cli.ts            parseCommand / toCommand: autocannon CLI string <-> RunOptions
src/lib/format.ts         number/bytes/ms/date formatting
src/lib/config.svelte.ts  form state ($state), draft persisted in localStorage
src/lib/live.svelte.ts    which run is active (header pill, Start/Stop button)
src/lib/server/runner.ts  starts autocannon, builds 1s samples, emits RunEvents; one run at a time
src/lib/server/store.ts   history as JSON files in $DATA_DIR/runs (default ./data/runs)
src/routes/api/runs/...   REST + SSE (see below)
src/routes/+layout.svelte header + ConfigPanel sidebar + main
src/routes/+page.svelte   history table
src/routes/runs/[id]      run page: fetches the record, follows SSE while running
src/lib/components/       ConfigPanel, RunView, ResultTables, Chart, NumberField, FormSection
```

API:

- `GET /api/runs` → `RunSummary[]` (active run first) · `POST /api/runs` body `RunOptions` → `{id}`; 400 with `errors`, 409 if a run is active
- `GET /api/runs/:id` → `RunRecord` (active from memory, otherwise from disk) · `DELETE /api/runs/:id`
- `POST /api/runs/:id/stop`
- `GET /api/runs/:id/events` → SSE: `snapshot`, then `sample` every second, `status`, `done` (final record). 404 if not running.

Runner details:

- Live samples come from autocannon's `response` / `reqError` events bucketed by our own 1s `setInterval` (autocannon's `tick` isn't reliable for this). Per-bucket latency percentiles via sort. Bytes/latency follow autocannon's rule: count non-2xx too unless `excludeErrorStats`.
- Final figures come from autocannon's result (`pickResult`), and `report` is `autocannon.printResult` with a non-TTY stream (no ANSI).
- Active run state is on `globalThis.__autocannonUi` so Vite HMR doesn't orphan a running test.
- A run is saved to disk only when it ends.

## UI conventions

- Copy in the UI is English, sentence case, plain verbs. Buttons say what they do ("Start test", "Use these settings").
- Chart colors: `--series-1..3` (validated categorical palette, light and dark variants) and `--status-*` for status classes (always shown with a text label). Fills use the hex color + `1a` alpha, so keep series vars as hex.
- Charts share a crosshair (`cursor.sync`), and the legend header shows the value under the cursor (or the latest value).
- Number inputs bind to numbers; validation runs on submit and shows inline errors.

## README screenshots

`docs/*-light.png` / `docs/*-dark.png` (2880×1800, en-US locale) are shown with `<picture>` so GitHub picks the one matching the reader's theme. Take them from a separate `DATA_DIR` with demo runs, never from the owner's real history. Retake them when the UI changes visibly.

## Commands

```sh
npm run dev       # dev server on :5173
npm run check     # svelte-kit sync + svelte-check (keep at 0 errors)
npm run build && npm start   # production on 127.0.0.1:3000
npm run format
```

To try a run end to end, start any local HTTP server and POST to `/api/runs`, or use the form.

## Talking to the owner

The owner writes in Italian; reply in Italian. They use autocannon from the terminal a lot, so keep parity with the CLI flags and its report.
