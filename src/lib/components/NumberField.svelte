<script lang="ts">
	import * as Field from '#lib/components/ui/field/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import type { Snippet } from 'svelte';
	import InfoTip from './InfoTip.svelte';

	interface Props {
		id: string;
		label: string;
		value: number;
		suffix?: string;
		min?: number;
		error?: string;
		description?: string;
		labelClass?: string;
		/** plain-language explanation shown in a tooltip next to the label */
		info?: Snippet;
	}

	let {
		id,
		label,
		value = $bindable(),
		suffix,
		min = 0,
		error,
		description,
		labelClass = '',
		info
	}: Props = $props();
</script>

<Field.Field data-invalid={!!error || undefined} class="gap-1.5">
	{#if info}
		<div class="flex items-center gap-1.5">
			<Field.Label for={id} class="w-auto text-xs font-normal text-muted-foreground {labelClass}"
				>{label}</Field.Label
			>
			<InfoTip {label}>{@render info()}</InfoTip>
		</div>
	{:else}
		<Field.Label for={id} class="text-xs font-normal text-muted-foreground {labelClass}"
			>{label}</Field.Label
		>
	{/if}
	<InputGroup.Root>
		<InputGroup.Input
			{id}
			type="number"
			inputmode="numeric"
			{min}
			class="tabular-nums"
			bind:value
			aria-invalid={!!error || undefined}
		/>
		{#if suffix}
			<InputGroup.Addon align="inline-end">
				<InputGroup.Text class="text-xs">{suffix}</InputGroup.Text>
			</InputGroup.Addon>
		{/if}
	</InputGroup.Root>
	{#if description}<Field.Description class="text-xs">{description}</Field.Description>{/if}
	{#if error}<Field.Error class="text-xs">{error}</Field.Error>{/if}
</Field.Field>
