<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';

	interface Props {
		title: string;
		/** how many settings in this section differ from the defaults */
		count?: number;
		children: Snippet;
	}

	let { title, count = 0, children }: Props = $props();
	// Sections with settings in use start open.
	let open = $state(untrack(() => count > 0));
</script>

<Collapsible.Root bind:open class="border-t pt-3">
	<Collapsible.Trigger
		class="group flex w-full items-center gap-2 rounded-md py-1 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
	>
		<ChevronRightIcon
			class="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
		/>
		{title}
		{#if count > 0}
			<Badge variant="secondary" class="ml-auto tabular-nums">{count}</Badge>
		{/if}
	</Collapsible.Trigger>
	<Collapsible.Content class="flex flex-col gap-4 pt-3 pb-1">
		{@render children()}
	</Collapsible.Content>
</Collapsible.Root>
