<script lang="ts" module>
	export interface ChartSeries {
		label: string;
		/** CSS custom property holding the series color (a hex value), e.g. "--series-1" */
		color: string;
		/** draw a 10% wash under the line */
		fill?: boolean;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { mode } from 'mode-watcher';
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';
	import * as Card from '#lib/components/ui/card/index.js';

	interface Props {
		title: string;
		series: ChartSeries[];
		/** [xs, ...ys] in uPlot's aligned format; x is seconds since start */
		data: (number | null)[][];
		format: (v: number) => string;
		/** tick labels on the y axis; defaults to `format` */
		axisFormat?: (v: number) => string;
		/** fix the x axis to the planned length of the run, so lines grow left to right */
		xMax?: number | null;
		height?: number;
		/** charts sharing a key share their crosshair */
		syncKey?: string;
		class?: string;
	}

	let {
		title,
		series,
		data,
		format,
		axisFormat,
		xMax = null,
		height = 180,
		syncKey = 'run',
		class: className = ''
	}: Props = $props();

	let host: HTMLDivElement;
	let plot: uPlot | null = null;
	let cursorIdx = $state<number | null>(null);

	const lastIdx = $derived(data[0]?.length ? data[0].length - 1 : null);
	const shownIdx = $derived(cursorIdx ?? lastIdx);
	const shownTime = $derived(shownIdx != null ? (data[0][shownIdx] as number) : null);

	function css(name: string) {
		return getComputedStyle(host).getPropertyValue(name).trim();
	}

	function build() {
		plot?.destroy();
		const surface = css('--card');
		const muted = css('--muted-foreground');
		const grid = css('--border');
		const font = `11px ${css('--font-sans') || 'system-ui'}`;
		const axis: uPlot.Axis = {
			stroke: muted,
			font,
			grid: { stroke: grid, width: 1 },
			ticks: { show: false },
			border: { show: false },
			gap: 6
		};

		plot = new uPlot(
			{
				width: host.clientWidth,
				height,
				padding: [8, 14, 0, 0],
				legend: { show: false },
				cursor: {
					sync: { key: syncKey },
					drag: { x: false, y: false },
					points: {
						size: 9,
						width: 2,
						stroke: () => surface,
						fill: (u, i) => u.series[i].stroke as unknown as string
					}
				},
				scales: {
					x: {
						time: false,
						// Samples are stamped at the end of each 1s bucket, so the first one is at ~1s.
						range: (u, _min, max) => {
							const first = (u.data[0]?.[0] as number | undefined) ?? 1;
							const lo = Math.min(1, first);
							return [lo, Math.max(xMax ?? 0, max ?? 0, lo + 1)];
						}
					},
					y: {
						range: (_u, _min, max) => [0, max > 0 ? max * 1.12 : 1]
					}
				},
				axes: [
					{
						...axis,
						size: 30,
						incrs: [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600],
						values: (_u, ticks) => ticks.map((t) => `${t}s`)
					},
					{
						...axis,
						size: 64,
						values: (_u, ticks) => ticks.map((t) => (axisFormat ?? format)(t))
					}
				],
				series: [
					{},
					...series.map((s) => {
						const color = css(s.color);
						return {
							label: s.label,
							stroke: color,
							width: 2,
							fill: s.fill ? color + '1a' : undefined,
							points: { show: false },
							spanGaps: false
						} satisfies uPlot.Series;
					})
				],
				hooks: {
					setCursor: [
						(u) => {
							cursorIdx = u.cursor.idx ?? null;
						}
					]
				}
			},
			data as uPlot.AlignedData,
			host
		);
	}

	onMount(() => {
		build();
		const ro = new ResizeObserver(() => {
			if (plot && host.clientWidth && plot.width !== host.clientWidth)
				plot.setSize({ width: host.clientWidth, height });
		});
		ro.observe(host);
		return () => {
			ro.disconnect();
			plot?.destroy();
			plot = null;
		};
	});

	// Colors come from CSS variables: rebuild when light/dark flips.
	let lastMode: string | undefined;
	$effect(() => {
		const m = mode.current;
		if (lastMode !== undefined && m !== lastMode) requestAnimationFrame(build);
		lastMode = m;
	});

	$effect(() => {
		void xMax;
		plot?.setData(data as uPlot.AlignedData);
	});

	function valueAt(seriesIdx: number) {
		if (shownIdx == null) return '–';
		const v = data[seriesIdx + 1]?.[shownIdx];
		return v == null ? '–' : format(v);
	}
</script>

<Card.Root class="gap-3 py-4 {className}">
	<Card.Header class="px-4">
		<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
			<Card.Title class="text-sm">{title}</Card.Title>
			{#if series.length === 1}
				<span class="text-sm font-semibold tabular-nums">{valueAt(0)}</span>
			{:else}
				<span class="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
					{#each series as s, i (s.label)}
						<span class="inline-flex items-center gap-1.5">
							<span class="h-[3px] w-3 rounded-full" style:background="var({s.color})"></span>
							{s.label}
							<span class="font-medium text-foreground tabular-nums">{valueAt(i)}</span>
						</span>
					{/each}
				</span>
			{/if}
			<span class="ml-auto text-xs text-muted-foreground tabular-nums">
				{#if shownTime != null}{cursorIdx != null ? 'at' : 'latest,'} {shownTime.toFixed(0)}s{/if}
			</span>
		</div>
	</Card.Header>
	<Card.Content class="px-3">
		<div class="w-full [&_.u-over]:cursor-crosshair" bind:this={host}></div>
	</Card.Content>
</Card.Root>
