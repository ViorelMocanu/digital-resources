import { expect, test } from 'vitest';
import type { AstroIntegration } from 'astro';
import config from '../astro.config.mjs';

// Astro 7 deprecates the Markdown plugin keys of the config: plugins belong on the processor itself, as the site's own
// `markdown.processor: unified({...})` does. An integration that still sets them makes every build, type check and
// test run print a deprecation warning.
const LEGACY_KEYS = ['remarkPlugins', 'rehypePlugins', 'remarkRehype'];

const quiet = (): undefined => undefined;
const logger = { info: quiet, warn: quiet, error: quiet, debug: quiet, fork: () => logger };

test('no integration adds Markdown plugins through the keys Astro 7 deprecates', async () => {
	const integrations = (config.integrations ?? []).flat().filter((integration): integration is AstroIntegration => Boolean(integration));
	const legacy: string[] = [];
	for (const integration of integrations) {
		const updateConfig = (update: { markdown?: Record<string, unknown> }): typeof config => {
			if (LEGACY_KEYS.some((key) => key in (update.markdown ?? {}))) legacy.push(integration.name);
			return config;
		};
		await integration.hooks['astro:config:setup']?.({ config: { ...config, integrations }, updateConfig, command: 'build', isRestart: false, logger } as never);
	}
	expect(legacy).toEqual([]);
});
