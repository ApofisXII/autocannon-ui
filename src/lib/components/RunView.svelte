<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import SquareIcon from '@lucide/svelte/icons/square';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import Chart, { type ChartSeries } from './Chart.svelte';
	import ResultTables from './ResultTables.svelte';
	import { setOptions } from '#lib/config.svelte.js';
	import { bytes, bytesTick, compact, dateTime, int, ms, msTick, seconds } from '#lib/format.js';
	import type { RunRecord } from '#lib/types.js';

	let { run }: { run: RunRecord } = $props();

	const o = $derived(run.options);
	const inProgress = $derived(run.status === 'running' || run.status === 'stopping');
	const samples = $derived(run.samples);
	const last = $derived(samples.at(-1) ?? null);
	const r = $derived(run.result);

	// Clock for the progress bar while the run is in progress.
	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});
	const elapsed = $derived(
		inProgress ? (now - run.startedAt) / 1000 : (r?.duration ?? last?.t ?? 0)
	);

	const totals = $derived.by(() => {
		let responses = 0;
		let errors = 0;
		let timeouts = 0;
		let non2xx = 0;
		for (const s of samples) {
			responses += s.responses;
			errors += s.errors;
			timeouts += s.timeouts;
			non2xx += s.responses - s.status[1];
		}
		return { responses, errors, timeouts, non2xx };
	});

	const progress = $derived.by(() => {
		if (!inProgress) return 1;
		if (o.mode === 'amount') return Math.min(1, totals.responses / o.amount);
		return Math.min(1, elapsed / o.duration);
	});

	// Figures: live values while running, autocannon's own summary once finished.
	const heroValue = $derived(r ? r.requests.average : last ? last.responses / last.dt : null);
	const errorCount = $derived(r ? r.errors : totals.errors);
	const timeoutCount = $derived(r ? r.timeouts : totals.timeouts);
	const non2xxCount = $derived(r ? r.non2xx : totals.non2xx);
	const figures = $derived([
		{ label: 'Latency p99', value: ms(r ? r.latency.p99 : last?.latency?.p99) },
		{ label: 'Latency avg', value: ms(r ? r.latency.average : last?.latency?.mean) },
		{
			label: 'Throughput',
			value: `${bytes(r ? r.throughput.average : last ? last.bytes / last.dt : null)}/s`
		},
		{ label: 'Responses', value: compact(r ? r.requests.total : totals.responses) }
	]);

	// Chart data, in uPlot's aligned-array format.
	const xs = $derived(samples.map((s) => s.t));
	const rate = (n: number, dt: number) => (dt > 0 ? n / dt : 0);
	const rpsData = $derived([xs, samples.map((s) => rate(s.responses, s.dt))]);
	const latencyData = $derived([
		xs,
		samples.map((s) => s.latency?.p50 ?? null),
		samples.map((s) => s.latency?.p90 ?? null),
		samples.map((s) => s.latency?.p99 ?? null)
	]);
	const throughputData = $derived([xs, samples.map((s) => rate(s.bytes, s.dt))]);
	const statusData = $derived([
		xs,
		samples.map((s) => rate(s.status[1], s.dt)),
		samples.map((s) => rate(s.status[0] + s.status[2], s.dt)),
		samples.map((s) => rate(s.status[3], s.dt)),
		samples.map((s) => rate(s.status[4], s.dt)),
		samples.map((s) => rate(s.errors, s.dt))
	]);
	const xMax = $derived(o.mode === 'duration' ? o.duration : null);

	const latencySeries: ChartSeries[] = [
		{ label: 'p50', color: '--series-1' },
		{ label: 'p90', color: '--series-2' },
		{ label: 'p99', color: '--series-3' }
	];
	const statusSeries: ChartSeries[] = [
		{ label: '2xx', color: '--status-good' },
		{ label: '1xx/3xx', color: '--status-redirect' },
		{ label: '4xx', color: '--status-warning' },
		{ label: '5xx', color: '--status-serious' },
		{ label: 'Errors', color: '--status-critical' }
	];

	// Actions
	let stopping = $state(false);
	async function stop() {
		stopping = true;
		await fetch(`/api/runs/${run.id}/stop`, { method: 'POST' }).catch(() => {});
		stopping = false;
	}

	function useSettings() {
		setOptions(run.options);
		toast.success('Settings loaded in the panel', {
			description: 'Adjust them and start a new test.'
		});
	}

	function download() {
		const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `autocannon-${run.id}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function remove() {
		const res = await fetch(`/api/runs/${run.id}`, { method: 'DELETE' });
		if (res.ok) {
			toast.success('Run deleted');
			await goto('/');
		} else toast.error('Could not delete the run');
	}

	const statusBadge = $derived(
		{
			running: { label: 'Running', variant: 'default' },
			stopping: { label: 'Stopping', variant: 'secondary' },
			done: { label: run.stoppedEarly ? 'Stopped early' : 'Finished', variant: 'outline' },
			error: { label: 'Failed', variant: 'destructive' }
		}[run.status] as { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
	);
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-8">
	<!-- Heading -->
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-1.5">
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant={statusBadge.variant} class="gap-1.5">
					{#if inProgress}
						<span class="relative flex size-1.5">
							<span
								class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70"
							></span>
							<span class="relative inline-flex size-1.5 rounded-full bg-current"></span>
						</span>
					{/if}
					{statusBadge.label}
				</Badge>
				<span class="text-xs text-muted-foreground">{dateTime(run.startedAt)}</span>
			</div>
			{#if o.title}
				<h1 class="text-xl font-semibold tracking-tight">{o.title}</h1>
			{/if}
			<p
				class="flex min-w-0 items-baseline gap-2 {o.title
					? 'text-sm text-muted-foreground'
					: 'text-lg font-medium'}"
			>
				<span class="font-mono text-xs font-semibold text-muted-foreground">{o.method}</span>
				<span class="font-mono break-all">{o.url}</span>
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if inProgress}
				<Button
					variant="destructive"
					onclick={stop}
					disabled={stopping || run.status === 'stopping'}
				>
					{#if stopping || run.status === 'stopping'}<Spinner />{:else}<SquareIcon
							data-icon="inline-start"
							class="fill-current"
						/>{/if}
					Stop
				</Button>
			{:else}
				<Button variant="outline" onclick={useSettings}>
					<RotateCcwIcon data-icon="inline-start" />Use these settings
				</Button>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Download JSON"
					title="Download JSON"
					onclick={download}
				>
					<DownloadIcon />
				</Button>
				<AlertDialog.Root>
					<AlertDialog.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								aria-label="Delete run"
								title="Delete run"
							>
								<Trash2Icon />
							</Button>
						{/snippet}
					</AlertDialog.Trigger>
					<AlertDialog.Content>
						<AlertDialog.Header>
							<AlertDialog.Title>Delete this run?</AlertDialog.Title>
							<AlertDialog.Description>
								Its charts and report are removed from the history. This can't be undone.
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							<AlertDialog.Action onclick={remove}>Delete run</AlertDialog.Action>
						</AlertDialog.Footer>
					</AlertDialog.Content>
				</AlertDialog.Root>
			{/if}
		</div>
	</div>

	{#if run.error}
		<Alert.Root variant="destructive">
			<CircleAlertIcon />
			<Alert.Title>autocannon stopped with an error</Alert.Title>
			<Alert.Description>{run.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Headline numbers -->
	<Card.Root class="gap-0 overflow-hidden py-0">
		<div class="grid gap-px bg-border lg:grid-cols-[minmax(260px,1.1fr)_2fr]">
			<div class="flex flex-col justify-between gap-6 bg-card p-5">
				<div class="flex flex-col gap-1">
					<span class="text-sm text-muted-foreground">
						{r ? 'Requests per second, average' : 'Requests per second, now'}
					</span>
					<span class="text-5xl font-semibold tracking-tight md:text-6xl">
						{heroValue == null ? '–' : int(heroValue)}
					</span>
				</div>
				<div class="flex flex-col gap-2">
					<div
						class="h-1.5 overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-label="Progress"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(progress * 100)}
					>
						<div
							class="h-full rounded-full transition-[width] duration-300 ease-linear {inProgress
								? 'bg-primary'
								: 'bg-muted-foreground/40'}"
							style:width="{progress * 100}%"
						></div>
					</div>
					<div class="flex justify-between text-xs text-muted-foreground tabular-nums">
						<span>
							{#if o.mode === 'duration'}
								{seconds(Math.min(elapsed, o.duration))} of {seconds(o.duration)}
							{:else}
								{compact(Math.min(totals.responses, o.amount))} of {compact(o.amount)} requests
							{/if}
						</span>
						<span>
							{o.connections} connections{o.pipelining > 1 ? `, pipelining ${o.pipelining}` : ''}
						</span>
					</div>
				</div>
			</div>
			<dl class="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
				{#each figures as f (f.label)}
					<div class="flex flex-col gap-1 bg-card p-5">
						<dt class="text-sm text-muted-foreground">
							{f.label}{#if !r}<span class="sr-only">, last second</span>{/if}
						</dt>
						<dd class="text-2xl font-semibold tracking-tight tabular-nums">{f.value}</dd>
					</div>
				{/each}
				<div class="flex flex-col gap-1 bg-card p-5">
					<dt class="text-sm text-muted-foreground">Errors</dt>
					<dd class="flex items-baseline gap-2 text-2xl font-semibold tracking-tight tabular-nums">
						<span class={errorCount > 0 ? 'text-destructive' : ''}>{int(errorCount)}</span>
						{#if timeoutCount > 0}
							<span class="text-xs font-normal tracking-normal text-muted-foreground"
								>{int(timeoutCount)} timeouts</span
							>
						{/if}
					</dd>
				</div>
				<div class="flex flex-col gap-1 bg-card p-5">
					<dt class="text-sm text-muted-foreground">Non-2xx</dt>
					<dd
						class="text-2xl font-semibold tracking-tight tabular-nums {non2xxCount > 0
							? 'text-destructive'
							: ''}"
					>
						{int(non2xxCount)}
					</dd>
				</div>
			</dl>
		</div>
	</Card.Root>

	<!-- Charts -->
	<section aria-label="Charts over time" class="grid gap-4 lg:grid-cols-2">
		<Chart
			class="lg:col-span-2"
			title="Requests per second"
			series={[{ label: 'req/s', color: '--series-1', fill: true }]}
			data={rpsData}
			format={compact}
			{xMax}
			height={220}
		/>
		<Chart
			title="Latency"
			series={latencySeries}
			data={latencyData}
			format={ms}
			axisFormat={msTick}
			{xMax}
		/>
		<Chart
			title="Throughput"
			series={[{ label: 'bytes/s', color: '--series-1', fill: true }]}
			data={throughputData}
			format={(v) => `${bytes(v)}/s`}
			axisFormat={bytesTick}
			{xMax}
		/>
		<Chart
			class="lg:col-span-2"
			title="Responses per second by status"
			series={statusSeries}
			data={statusData}
			format={compact}
			{xMax}
		/>
	</section>

	{#if r}
		<ResultTables result={r} report={run.report} />
	{:else if inProgress}
		<p class="text-sm text-muted-foreground">
			The full percentile tables appear when the test ends.
		</p>
	{/if}
</div>
