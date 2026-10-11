<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { ModeWatcher, toggleMode } from 'mode-watcher';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import ConfigPanel from '#lib/components/ConfigPanel.svelte';
	import { hostAndPath } from '#lib/format.js';
	import { live, refreshActive } from '#lib/live.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		refreshActive();
	});

	const onActiveRun = $derived(page.url.pathname === `/runs/${live.activeId}`);
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<title>autocannon ui</title>
</svelte:head>

<ModeWatcher />
<Toaster position="bottom-right" />

<div
	class="grid h-dvh grid-cols-1 grid-rows-[56px_auto_auto] max-md:h-auto md:grid-cols-[380px_minmax(0,1fr)] md:grid-rows-[56px_minmax(0,1fr)]"
>
	<header
		class="col-span-full flex items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-5"
	>
		<a href="/" class="flex items-center gap-2.5 font-semibold tracking-tight">
			<span
				class="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
			>
				<ActivityIcon class="size-4" />
			</span>
			<span>autocannon <span class="font-normal text-muted-foreground">ui</span></span>
		</a>

		<nav class="ml-auto flex items-center gap-1">
			{#if live.activeId && !onActiveRun}
				<a
					href="/runs/{live.activeId}"
					class="mr-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15"
				>
					<span class="relative flex size-2">
						<span
							class="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60"
						></span>
						<span class="relative inline-flex size-2 rounded-full bg-primary"></span>
					</span>
					<span class="max-sm:hidden">Running on</span>
					{hostAndPath(live.activeUrl ?? '').host}
				</a>
			{/if}
			<Button
				href="/"
				variant="ghost"
				size="sm"
				aria-current={page.url.pathname === '/' ? 'page' : undefined}
			>
				History
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={toggleMode}
				aria-label="Switch light or dark theme"
			>
				<SunIcon class="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<MoonIcon class="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
			</Button>
		</nav>
	</header>

	<aside aria-label="Test settings" class="min-h-0 border-b bg-sidebar md:border-r md:border-b-0">
		<Tooltip.Provider>
			<ConfigPanel />
		</Tooltip.Provider>
	</aside>

	<main class="min-w-0 md:overflow-y-auto">
		{@render children()}
	</main>
</div>
