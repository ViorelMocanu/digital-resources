// The head is printed as written, without a sorter. astro-capo, the sorter the site used, dropped the client
// router's script on Astro 5 and later and needed a patch (lesson L-008); Phase 5 removed it. These tests fail if it
// comes back, or if the router leaves the head. The browser tests check the built head and the navigation itself.
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

test('astro-capo is not a dependency and has no patch entry', () => {
	const manifest = JSON.parse(read('../package.json')) as Record<string, Record<string, string> | undefined>;
	expect(Object.keys({ ...manifest['dependencies'], ...manifest['devDependencies'] })).not.toContain('astro-capo');
	expect(read('../pnpm-workspace.yaml')).not.toContain('astro-capo');
});

test('the layout prints a plain head with the client router inside it', () => {
	const layout = read('../src/layouts/Layout.astro');
	expect(layout).not.toContain('astro-capo');
	// Case-sensitive: the sorter's component was <Head>.
	expect(layout).toMatch(/<head>[\s\S]*<ClientRouter fallback="none" \/>[\s\S]*<\/head>/);
});
