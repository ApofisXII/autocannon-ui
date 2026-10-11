<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { compact, dateTime, hostAndPath, int, ms, seconds } from '#lib/format.js';
	import type { RunSummary } from '#lib/types.js';

	let runs = $state<RunSummary[] | null>(null);
	let loadError = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/api/runs');
			runs = await res.json();
		} catch {
			loadError = true;
		}
	});
</script>

<svelte:head><title>History · autocannon ui</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-5 p-4 md:p-8">
	<div>
		<h1 class="text-xl font-semibold tracking-tight">History</h1>
		<p class="text-sm text-muted-foreground">
			Every test is saved on this machine. Open one to see its charts and full report.
		</p>
	</div>

	{#if loadError}
		<p class="text-sm text-destructive">Could not load the history. Is the server running?</p>
	{:else if runs === null}
		<div class="flex flex-col gap-2">
			{#each [0, 1, 2] as i (i)}<Skeleton class="h-12 w-full" />{/each}
		</div>
	{:else if runs.length === 0}
		<Empty.Root class="border border-dashed">
			<Empty.Header>
				<Empty.Media variant="icon"><HistoryIcon /></Empty.Media>
				<Empty.Title>No tests yet</Empty.Title>
				<Empty.Description>
					Enter a URL in the panel, pick the load and press Start test. Results show up here as soon
					as a test ends.
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<div class="overflow-hidden rounded-xl border bg-card">
			<Table.Root>
				<Table.Header>
					<Table.Row class="hover:bg-transparent">
						<Table.Head class="pl-4">Target</Table.Head>
						<Table.Head>Started</Table.Head>
						<Table.Head class="text-right">Connections</Table.Head>
						<Table.Head class="text-right">Duration</Table.Head>
						<Table.Head class="text-right">Req/s avg</Table.Head>
						<Table.Head class="text-right">Latency avg</Table.Head>
						<Table.Head class="text-right">p99</Table.Head>
						<Table.Head class="pr-4 text-right">Errors</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each runs as run (run.id)}
						{@const target = hostAndPath(run.url)}
						<Table.Row class="cursor-pointer" onclick={() => goto(`/runs/${run.id}`)}>
							<Table.Cell class="max-w-[340px] pl-4">
								<a
									href="/runs/{run.id}"
									class="flex flex-col gap-0.5 outline-none"
									onclick={(e) => e.stopPropagation()}
								>
									<span class="flex items-center gap-2">
										<span class="font-mono text-[11px] font-semibold text-muted-foreground"
											>{run.method}</span
										>
										<span class="truncate font-medium">{run.title || target.host}</span>
										{#if run.status === 'running' || run.status === 'stopping'}
											<Badge>Running</Badge>
										{:else if run.status === 'error'}
											<Badge variant="destructive">Failed</Badge>
										{/if}
									</span>
									<span class="truncate font-mono text-xs text-muted-foreground">
										{run.title ? run.url : target.path || '/'}
									</span>
								</a>
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{dateTime(run.startedAt)}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{int(run.connections)}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{seconds(run.duration)}</Table.Cell>
							<Table.Cell class="text-right font-medium tabular-nums"
								>{compact(run.reqPerSec)}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums">{ms(run.latencyAvg)}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">{ms(run.latencyP99)}</Table.Cell>
							<Table.Cell class="pr-4 text-right tabular-nums">
								{#if run.errors == null}
									<span class="text-muted-foreground">–</span>
								{:else if run.errors + (run.non2xx ?? 0) > 0}
									<span class="flex flex-col items-end text-destructive">
										{#if run.errors}<span>{int(run.errors)} errors</span>{/if}
										{#if run.non2xx}<span>{compact(run.non2xx)} non-2xx</span>{/if}
									</span>
								{:else}
									<span class="text-muted-foreground">0</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>
