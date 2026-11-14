// The Astro formatter plugin 0.14.1 dropped a type argument inside a template, turning
// `(item: CollectionEntry<'subcategories'>)` into `(item: CollectionEntry)`, and only the type check noticed
// (docs/lessons.md, L-009). This formats a component through Prettier with the repository's own settings.
import { expect, it } from 'vitest';
import { format, resolveConfig } from 'prettier';
import { resolve } from 'node:path';

const SAMPLE = `---
import type { CollectionEntry } from 'astro:content';
const items: CollectionEntry<'subcategories'>[] = [];
---

<ul>
	{items.map((item: CollectionEntry<'subcategories'>) => (
		<li>{item.id}</li>
	))}
</ul>
`;

// The plugin's 1.x line formats for Astro 7's default `compressHTML: 'jsx'`, where a whitespace run holding a newline
// is dropped, so it may move a link's text onto lines of its own. This site builds with `compressHTML: true`, which
// keeps one space of every run: that move showed a space inside the footer links and before the full stop that ends
// the copyright line, on every page (phase-5-due-fixes, task 5.7). The line is longer than the print width on purpose.
const PARAGRAPH = `<p class="Copyright">
	Copyright &copy; 2023
	<a href="https://example.ro/" title="Vezi site-ul personal al autorului acestui proiect">Autorul proiectului</a> și <a href="https://example.ro/comunitate" title="Vizitează comunitatea de Discord a proiectului">comunitatea proiectului</a>.
</p>
`;

/**
 * Formats a component with the repository's settings, as `pnpm format:fix` does.
 * @param source The component.
 * @returns The formatted component.
 */
async function formatComponent(source: string): Promise<string> {
	const filepath = resolve(import.meta.dirname, '..', 'src', 'components', 'Sample.astro');
	return format(source, { ...(await resolveConfig(filepath)), filepath });
}

/**
 * The text a reader sees: tags removed, and every whitespace run shown as one space.
 * @param html The markup.
 * @returns The text.
 */
function visibleText(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

it('keeps a type argument inside a template', async () => {
	expect(await formatComponent(SAMPLE)).toContain("(item: CollectionEntry<'subcategories'>)");
}, 30_000);

it('leaves the text of a paragraph with links as it was', async () => {
	expect(visibleText(await formatComponent(PARAGRAPH))).toBe('Copyright &copy; 2023 Autorul proiectului și comunitatea proiectului.');
}, 30_000);
