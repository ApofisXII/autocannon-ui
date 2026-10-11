<script lang="ts">
	import type { Snippet } from 'svelte';
	import InfoIcon from '@lucide/svelte/icons/info';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	/** A small "i" next to a label that explains it on hover or keyboard focus. */
	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<Tooltip.Root delayDuration={150}>
	<Tooltip.Trigger
		type="button"
		aria-label="What is {label}?"
		class="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
	>
		<InfoIcon class="size-3.5" />
	</Tooltip.Trigger>
	<Tooltip.Content side="top" class="max-w-64 text-left leading-relaxed text-pretty">
		<p>{@render children()}</p>
	</Tooltip.Content>
</Tooltip.Root>
