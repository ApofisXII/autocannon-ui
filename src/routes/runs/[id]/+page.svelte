<script lang="ts">
	import { page } from '$app/state';
	import FileQuestionIcon from '@lucide/svelte/icons/file-question';
	import RunView from '#lib/components/RunView.svelte';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { hostAndPath } from '#lib/format.js';
	import { live } from '#lib/live.svelte.js';
	import type { RunEvent, RunRecord } from '#lib/types.js';

	let run = $state<RunRecord | null>(null);
	let notFound = $state(false);

	// Load the run; if it is still in progress, follow it over server-sent events.
	$effect(() => {
		const id = page.params.id!;
		let source: EventSource | null = null;
		let cancelled = false;
		run = null;
		notFound = false;

		async function load() {
			const res = await fetch(`/api/runs/${id}`);
			if (cancelled) return;
			if (!res.ok) {
				notFound = true;
				return;
			}
			run = await res.json();
			if (run && (run.status === 'running' || run.status === 'stopping')) follow();
		}

		function follow() {
			source = new EventSource(`/api/runs/${id}/events`);
			source.onmessage = (msg) => {
				const event: RunEvent = JSON.parse(msg.data);
				if (event.type === 'snapshot') run = event.run;
				else if (event.type === 'sample') run?.samples.push(event.sample);
				else if (event.type === 'status' && run) run.status = event.status;
				else if (event.type === 'done') {
					run = event.run;
					source?.close();
					if (live.activeId === id) {
						live.activeId = null;
						live.activeUrl = null;
					}
				}
			};
			source.onerror = () => {
				// The run ended while we were disconnected: fetch the saved record instead.
				if (source?.readyState === EventSource.CLOSED && !cancelled) {
					source = null;
					void load();
				}
			};
		}

		void load();
		return () => {
			cancelled = true;
			source?.close();
		};
	});
</script>

<svelte:head>
	<title
		>{run ? `${run.options.title || hostAndPath(run.options.url).host} · ` : ''}autocannon ui</title
	>
</svelte:head>

{#if notFound}
	<div class="p-4 md:p-8">
		<Empty.Root class="border border-dashed">
			<Empty.Header>
				<Empty.Media variant="icon"><FileQuestionIcon /></Empty.Media>
				<Empty.Title>Run not found</Empty.Title>
				<Empty.Description
					>It may have been deleted, or the data folder was moved.</Empty.Description
				>
			</Empty.Header>
			<Empty.Content><Button href="/" variant="outline">Back to history</Button></Empty.Content>
		</Empty.Root>
	</div>
{:else if run}
	<RunView {run} />
{:else}
	<div class="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-8">
		<Skeleton class="h-14 w-1/2" />
		<Skeleton class="h-44 w-full" />
		<Skeleton class="h-64 w-full" />
	</div>
{/if}
