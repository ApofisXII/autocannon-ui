<script lang="ts">
	import { toast } from 'svelte-sonner';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { bytes, int } from '#lib/format.js';
	import type { HistogramSummary, RunResult } from '#lib/types.js';

	let { result, report }: { result: RunResult; report: string | null } = $props();

	type Col = { label: string; key: keyof HistogramSummary };
	const latencyCols: Col[] = [
		{ label: '2.5%', key: 'p2_5' },
		{ label: '50%', key: 'p50' },
		{ label: '90%', key: 'p90' },
		{ label: '97.5%', key: 'p97_5' },
		{ label: '99%', key: 'p99' },
		{ label: '99.9%', key: 'p99_9' },
		{ label: 'Avg', key: 'average' },
		{ label: 'Stdev', key: 'stddev' },
		{ label: 'Max', key: 'max' }
	];
	const rateCols: Col[] = [
		{ label: '1%', key: 'p1' },
		{ label: '2.5%', key: 'p2_5' },
		{ label: '50%', key: 'p50' },
		{ label: '97.5%', key: 'p97_5' },
		{ label: 'Avg', key: 'average' },
		{ label: 'Stdev', key: 'stddev' },
		{ label: 'Min', key: 'min' }
	];

	const codes = $derived(
		Object.entries(result.statusCodeStats)
			.map(([code, v]) => ({ code, count: v.count ?? 0 }))
			.sort((a, b) => a.code.localeCompare(b.code))
	);
	const totalResponses = $derived(codes.reduce((n, c) => n + c.count, 0));

	const fmtMs = (v: number) =>
		v == null || !Number.isFinite(v) ? '–' : `${Number.isInteger(v) ? v : v.toFixed(2)} ms`;

	const codeColor = (code: string) =>
		({ '2': 'bg-status-good', '4': 'bg-status-warning', '5': 'bg-status-serious' })[code[0]] ??
		'bg-status-redirect';

	const counts = $derived([
		{ label: 'Requests sent', value: int(result.requests.sent) },
		{ label: 'Responses', value: int(result.requests.total) },
		{ label: 'Data read', value: bytes(result.throughput.total) },
		{ label: 'Duration', value: `${result.duration.toFixed(2)} s` },
		{ label: 'Errors', value: int(result.errors) },
		{ label: 'Timeouts', value: int(result.timeouts) },
		{ label: 'Body mismatches', value: int(result.mismatches) },
		{ label: 'Pipeline resets', value: int(result.resets) }
	]);

	async function copyReport() {
		if (!report) return;
		try {
			await navigator.clipboard.writeText(report);
			toast.success('Report copied');
		} catch {
			toast.error('The browser blocked the clipboard');
		}
	}
</script>

<Tabs.Root value="summary" class="gap-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-base font-semibold tracking-tight">Report</h2>
		<Tabs.List>
			<Tabs.Trigger value="summary">Tables</Tabs.Trigger>
			<Tabs.Trigger value="terminal" disabled={!report}>Terminal output</Tabs.Trigger>
		</Tabs.List>
	</div>

	<Tabs.Content value="summary" class="flex flex-col gap-4">
		<Card.Root class="gap-0 py-0">
			<Card.Header class="border-b px-4 py-3 [.border-b]:pb-3">
				<Card.Title class="text-sm">Latency</Card.Title>
			</Card.Header>
			<Table.Root>
				<Table.Header>
					<Table.Row class="hover:bg-transparent">
						{#each latencyCols as c (c.key)}<Table.Head class="text-right first:pl-4 last:pr-4"
								>{c.label}</Table.Head
							>{/each}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					<Table.Row class="hover:bg-transparent">
						{#each latencyCols as c (c.key)}
							<Table.Cell class="text-right tabular-nums first:pl-4 last:pr-4"
								>{fmtMs(result.latency[c.key])}</Table.Cell
							>
						{/each}
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</Card.Root>

		<Card.Root class="gap-0 py-0">
			<Card.Header class="border-b px-4 py-3 [.border-b]:pb-3">
				<Card.Title class="text-sm">Per-second distribution</Card.Title>
			</Card.Header>
			<Table.Root>
				<Table.Header>
					<Table.Row class="hover:bg-transparent">
						<Table.Head class="pl-4"><span class="sr-only">Measure</span></Table.Head>
						{#each rateCols as c (c.key)}<Table.Head class="text-right last:pr-4"
								>{c.label}</Table.Head
							>{/each}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					<Table.Row class="hover:bg-transparent">
						<Table.Head scope="row" class="pl-4 font-medium text-foreground">Req/Sec</Table.Head>
						{#each rateCols as c (c.key)}
							<Table.Cell class="text-right tabular-nums last:pr-4"
								>{int(result.requests[c.key])}</Table.Cell
							>
						{/each}
					</Table.Row>
					<Table.Row class="hover:bg-transparent">
						<Table.Head scope="row" class="pl-4 font-medium text-foreground">Bytes/Sec</Table.Head>
						{#each rateCols as c (c.key)}
							<Table.Cell class="text-right tabular-nums last:pr-4"
								>{bytes(result.throughput[c.key])}</Table.Cell
							>
						{/each}
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</Card.Root>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
			<Card.Root class="gap-0 py-0">
				<Card.Header class="border-b px-4 py-3 [.border-b]:pb-3">
					<Card.Title class="text-sm">Status codes</Card.Title>
				</Card.Header>
				<Table.Root>
					<Table.Header>
						<Table.Row class="hover:bg-transparent">
							<Table.Head class="pl-4">Code</Table.Head>
							<Table.Head class="text-right">Count</Table.Head>
							<Table.Head class="pr-4 text-right">Share</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each codes as c (c.code)}
							<Table.Row class="hover:bg-transparent">
								<Table.Cell class="pl-4">
									<span class="inline-flex items-center gap-2 font-mono text-xs font-medium">
										<span class="size-2 rounded-full {codeColor(c.code)}"></span>{c.code}
									</span>
								</Table.Cell>
								<Table.Cell class="text-right tabular-nums">{int(c.count)}</Table.Cell>
								<Table.Cell class="pr-4 text-right text-muted-foreground tabular-nums">
									{totalResponses ? ((c.count / totalResponses) * 100).toFixed(1) : 0}%
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row class="hover:bg-transparent">
								<Table.Cell colspan={3} class="pl-4 text-muted-foreground"
									>No responses received.</Table.Cell
								>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Root>

			<Card.Root class="py-0">
				<dl
					class="grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
				>
					{#each counts as c (c.label)}
						<div class="flex flex-col gap-0.5">
							<dt class="text-xs text-muted-foreground">{c.label}</dt>
							<dd class="font-semibold tabular-nums">{c.value}</dd>
						</div>
					{/each}
				</dl>
			</Card.Root>
		</div>
	</Tabs.Content>

	<Tabs.Content value="terminal">
		<div class="relative">
			<Button variant="outline" size="sm" class="absolute top-2.5 right-2.5" onclick={copyReport}>
				<CopyIcon data-icon="inline-start" />Copy
			</Button>
			<pre
				class="overflow-x-auto rounded-xl border bg-muted/50 p-4 font-mono text-xs leading-relaxed">{report}</pre>
		</div>
	</Tabs.Content>
</Tabs.Root>
