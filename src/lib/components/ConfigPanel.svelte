<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SquareIcon from '@lucide/svelte/icons/square';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ClipboardPasteIcon from '@lucide/svelte/icons/clipboard-paste';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import * as ButtonGroup from '#lib/components/ui/button-group/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import NumberField from './NumberField.svelte';
	import FormSection from './FormSection.svelte';
	import { parseCommand, toCommand } from '#lib/cli.js';
	import { config, saveDraft, setOptions } from '#lib/config.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { validateOptions } from '#lib/options.js';
	import { HTTP_METHODS } from '#lib/types.js';

	const o = $derived(config.options);
	const errors = $derived(validateOptions(o));
	const command = $derived(toCommand(o));

	let showErrors = $state(false);
	let submitting = $state(false);
	let stopping = $state(false);
	let submitError = $state<string | null>(null);

	let pasteOpen = $state(false);
	let pasteText = $state('');
	let pasteError = $state<string | null>(null);

	const requestCount = $derived(o.headers.filter((h) => h.name.trim()).length + (o.body ? 1 : 0));
	const limitsCount = $derived(
		[
			o.overallRate,
			o.connectionRate,
			o.maxConnectionRequests,
			o.maxOverallRequests,
			o.reconnectRate,
			o.bailout
		].filter((v) => v > 0).length
	);
	const checksCount = $derived(
		[
			o.expectBody,
			o.title,
			o.ignoreCoordinatedOmission,
			o.excludeErrorStats,
			o.idReplacement
		].filter(Boolean).length
	);

	// Keep a draft of the form across reloads.
	$effect(() => {
		JSON.stringify(config.options);
		saveDraft();
	});

	function err(key: keyof typeof errors) {
		return showErrors ? errors[key] : undefined;
	}

	async function start(e: SubmitEvent) {
		e.preventDefault();
		showErrors = true;
		submitError = null;
		if (Object.keys(errors).length) return;
		submitting = true;
		try {
			const res = await fetch('/api/runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(o)
			});
			const body = await res.json().catch(() => ({}));
			if (res.status === 409) {
				live.activeId = body.runId;
				submitError = 'A test is already running. Stop it before starting another one.';
				return;
			}
			if (!res.ok) {
				submitError = body.message ?? `The server answered ${res.status}.`;
				return;
			}
			showErrors = false;
			live.activeId = body.id;
			live.activeUrl = o.url;
			await goto(`/runs/${body.id}`);
		} catch {
			submitError = 'Could not reach the server. Is it still running?';
		} finally {
			submitting = false;
		}
	}

	async function stop() {
		if (!live.activeId) return;
		stopping = true;
		try {
			await fetch(`/api/runs/${live.activeId}/stop`, { method: 'POST' });
		} finally {
			stopping = false;
		}
	}

	function applyPaste() {
		pasteError = null;
		try {
			const { options, ignored } = parseCommand(pasteText);
			setOptions(options);
			pasteOpen = false;
			pasteText = '';
			if (ignored.length)
				toast.warning('Form filled, some flags left out', {
					description: `Not supported in the UI: ${ignored.join(', ')}`
				});
			else toast.success('Form filled from the command');
		} catch (e) {
			pasteError = e instanceof Error ? e.message : String(e);
		}
	}

	async function copyCommand() {
		try {
			await navigator.clipboard.writeText(command);
			toast.success('Command copied');
		} catch {
			toast.error('The browser blocked the clipboard');
		}
	}
</script>

<form class="flex h-full min-h-0 flex-col" onsubmit={start} novalidate>
	<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-4">
		<Field.Field data-invalid={!!err('url') || undefined} class="gap-1.5">
			<Field.Label for="url">Target</Field.Label>
			<ButtonGroup.Root class="w-full">
				<Select.Root type="single" bind:value={o.method}>
					<Select.Trigger class="w-[92px] font-mono text-xs font-semibold" aria-label="HTTP method">
						{o.method}
					</Select.Trigger>
					<Select.Content>
						{#each HTTP_METHODS as m (m)}
							<Select.Item value={m} label={m} class="font-mono text-xs">{m}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Input
					id="url"
					type="url"
					class="font-mono text-[13px]"
					placeholder="http://localhost:3000/"
					autocomplete="off"
					spellcheck="false"
					bind:value={o.url}
					aria-invalid={!!err('url') || undefined}
				/>
			</ButtonGroup.Root>
			{#if err('url')}<Field.Error class="text-xs">{err('url')}</Field.Error>{/if}
		</Field.Field>

		<div class="grid grid-cols-2 gap-3">
			<NumberField
				id="connections"
				label="Connections"
				min={1}
				bind:value={o.connections}
				error={err('connections')}
			/>
			<NumberField
				id="pipelining"
				label="Pipelining"
				min={1}
				bind:value={o.pipelining}
				error={err('pipelining')}
			>
				{#snippet info()}
					How many requests each connection sends before waiting for the replies. With 1, a
					connection sends a request, waits for the answer, then sends the next one, like a browser
					does. Higher values push more load through the same connections, but some servers and
					proxies don't handle it well. If unsure, leave it at 1.
				{/snippet}
			</NumberField>
		</div>

		<Field.Set class="gap-1.5">
			<Field.Legend
				variant="label"
				class="mb-0 font-normal text-muted-foreground data-[variant=label]:text-xs"
				>Stop after</Field.Legend
			>
			<div class="grid grid-cols-2 gap-3">
				<ToggleGroup.Root
					type="single"
					variant="outline"
					class="w-full"
					value={o.mode}
					onValueChange={(v) => {
						if (v) o.mode = v as 'duration' | 'amount';
					}}
				>
					<ToggleGroup.Item value="duration" class="flex-1">Time</ToggleGroup.Item>
					<ToggleGroup.Item value="amount" class="flex-1">Requests</ToggleGroup.Item>
				</ToggleGroup.Root>
				{#if o.mode === 'duration'}
					<NumberField
						id="duration"
						label="Duration"
						labelClass="sr-only"
						min={1}
						suffix="sec"
						bind:value={o.duration}
						error={err('duration')}
					/>
				{:else}
					<NumberField
						id="amount"
						label="Requests"
						labelClass="sr-only"
						min={1}
						suffix="req"
						bind:value={o.amount}
						error={err('amount')}
					/>
				{/if}
			</div>
		</Field.Set>

		<NumberField
			id="timeout"
			label="Timeout per request"
			min={1}
			suffix="sec"
			bind:value={o.timeout}
			error={err('timeout')}
		/>

		<div class="flex flex-col gap-3">
			<FormSection title="Headers and body" count={requestCount}>
				<Field.Field class="gap-1.5">
					<Field.Label class="text-xs font-normal text-muted-foreground">Headers</Field.Label>
					{#each o.headers as h, i (i)}
						<div class="flex gap-1.5">
							<Input
								class="flex-[1] font-mono text-xs"
								placeholder="Name"
								aria-label="Header name"
								spellcheck="false"
								bind:value={h.name}
							/>
							<Input
								class="flex-[1.4] font-mono text-xs"
								placeholder="Value"
								aria-label="Header value"
								spellcheck="false"
								bind:value={h.value}
							/>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Remove header"
								onclick={() => o.headers.splice(i, 1)}
							>
								<XIcon />
							</Button>
						</div>
					{/each}
					<Button
						variant="outline"
						size="sm"
						class="w-fit"
						onclick={() => o.headers.push({ name: '', value: '' })}
					>
						<PlusIcon data-icon="inline-start" />Add header
					</Button>
					{#if err('headers')}<Field.Error class="text-xs">{err('headers')}</Field.Error>{/if}
				</Field.Field>
				<Field.Field class="gap-1.5">
					<Field.Label for="body" class="text-xs font-normal text-muted-foreground"
						>Body</Field.Label
					>
					<Textarea
						id="body"
						rows={4}
						class="font-mono text-xs"
						spellcheck="false"
						bind:value={o.body}
					/>
					<Field.Description class="text-xs"
						>Sent with every request. Add a Content-Type header to match.</Field.Description
					>
				</Field.Field>
			</FormSection>

			<FormSection title="Rate and limits" count={limitsCount}>
				<p class="-mt-1 text-xs text-muted-foreground">Leave at 0 for no limit.</p>
				<div class="grid grid-cols-2 gap-3">
					<NumberField
						id="overallRate"
						label="Overall rate"
						suffix="req/s"
						bind:value={o.overallRate}
						error={err('overallRate')}
					/>
					<NumberField
						id="connectionRate"
						label="Per connection"
						suffix="req/s"
						bind:value={o.connectionRate}
						error={err('connectionRate')}
					/>
					<NumberField
						id="maxConnectionRequests"
						label="Max per connection"
						bind:value={o.maxConnectionRequests}
						error={err('maxConnectionRequests')}
					/>
					<NumberField
						id="maxOverallRequests"
						label="Max overall"
						bind:value={o.maxOverallRequests}
						error={err('maxOverallRequests')}
					/>
					<NumberField
						id="reconnectRate"
						label="Reconnect every"
						suffix="req"
						bind:value={o.reconnectRate}
						error={err('reconnectRate')}
					/>
					<NumberField
						id="bailout"
						label="Give up after"
						suffix="errors"
						bind:value={o.bailout}
						error={err('bailout')}
					/>
				</div>
			</FormSection>

			<FormSection title="Checks and labels" count={checksCount}>
				<Field.Field class="gap-1.5">
					<Field.Label for="title" class="text-xs font-normal text-muted-foreground"
						>Title</Field.Label
					>
					<Input id="title" placeholder="Shown in the history" bind:value={o.title} />
				</Field.Field>
				<Field.Field class="gap-1.5">
					<Field.Label for="expectBody" class="text-xs font-normal text-muted-foreground"
						>Expected body</Field.Label
					>
					<Input
						id="expectBody"
						class="font-mono text-xs"
						spellcheck="false"
						bind:value={o.expectBody}
					/>
					<Field.Description class="text-xs"
						>Responses with a different body count as mismatches.</Field.Description
					>
				</Field.Field>
				<div class="flex flex-col gap-3">
					<div class="flex items-start gap-2.5">
						<Checkbox id="idReplacement" bind:checked={o.idReplacement} class="mt-0.5" />
						<Label
							for="idReplacement"
							class="text-[13px] leading-snug font-normal text-muted-foreground"
						>
							Replace <code class="font-mono text-xs">[&lt;id&gt;]</code> with a random id in each request
						</Label>
					</div>
					<div class="flex items-start gap-2.5">
						<Checkbox id="excludeErrorStats" bind:checked={o.excludeErrorStats} class="mt-0.5" />
						<Label
							for="excludeErrorStats"
							class="text-[13px] leading-snug font-normal text-muted-foreground"
						>
							Leave non-2xx responses out of latency and throughput
						</Label>
					</div>
					<div class="flex items-start gap-2.5">
						<Checkbox id="ignoreCO" bind:checked={o.ignoreCoordinatedOmission} class="mt-0.5" />
						<Label
							for="ignoreCO"
							class="text-[13px] leading-snug font-normal text-muted-foreground"
						>
							Ignore coordinated omission (matters only with a rate limit)
						</Label>
					</div>
				</div>
			</FormSection>
		</div>

		<div class="flex flex-col gap-2 border-t pt-3">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium">Command</span>
				<div class="-mr-1.5 flex">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Copy command"
						title="Copy command"
						onclick={copyCommand}
					>
						<CopyIcon />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Paste a command"
						title="Paste a command"
						aria-expanded={pasteOpen}
						onclick={() => {
							pasteOpen = !pasteOpen;
							pasteError = null;
						}}
					>
						<ClipboardPasteIcon />
					</Button>
				</div>
			</div>
			{#if pasteOpen}
				<Textarea
					rows={3}
					class="font-mono text-xs"
					spellcheck="false"
					placeholder="autocannon -c 100 -d 30 http://localhost:3000"
					bind:value={pasteText}
					aria-invalid={!!pasteError || undefined}
				/>
				{#if pasteError}<p class="text-xs text-destructive">{pasteError}</p>{/if}
				<div class="flex gap-2">
					<Button size="sm" disabled={!pasteText.trim()} onclick={applyPaste}>Fill the form</Button>
					<Button size="sm" variant="ghost" onclick={() => (pasteOpen = false)}>Cancel</Button>
				</div>
			{:else}
				<pre
					class="rounded-lg bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-muted-foreground">{command}</pre>
			{/if}
		</div>
	</div>

	<div class="flex flex-col gap-2 border-t bg-sidebar px-5 py-4">
		{#if submitError}
			<Alert.Root variant="destructive" class="py-2">
				<Alert.Description class="text-xs">
					{submitError}
					{#if live.activeId}<a class="underline" href="/runs/{live.activeId}">Open it</a>{/if}
				</Alert.Description>
			</Alert.Root>
		{/if}
		{#if live.activeId}
			<Button
				variant="destructive"
				size="lg"
				class="h-10 w-full"
				onclick={stop}
				disabled={stopping}
			>
				{#if stopping}<Spinner />{:else}<SquareIcon
						data-icon="inline-start"
						class="fill-current"
					/>{/if}
				Stop the running test
			</Button>
		{:else}
			<Button type="submit" size="lg" class="h-10 w-full" disabled={submitting}>
				{#if submitting}<Spinner />{:else}<PlayIcon
						data-icon="inline-start"
						class="fill-current"
					/>{/if}
				Start test
			</Button>
		{/if}
	</div>
</form>
