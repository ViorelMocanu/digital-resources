// The web manifest is a static file, so nothing keeps it in step with the site config. This test does.
import { ACCENT_COLOR, LANGUAGE_EXTENDED_DASH, SITE_DESCRIPTION, SITE_NAME } from '../src/config';
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../public/site.webmanifest', import.meta.url), 'utf8')) as Record<string, unknown>;

test('the web manifest repeats the site config', () => {
	expect(manifest.name).toBe(SITE_NAME);
	expect(manifest.short_name).toBe(SITE_NAME);
	expect(manifest.description).toBe(SITE_DESCRIPTION);
	expect(manifest.lang).toBe(LANGUAGE_EXTENDED_DASH);
	expect(manifest.theme_color).toBe(ACCENT_COLOR);
	expect(manifest.background_color).toBe(ACCENT_COLOR);
});
