// The Node version Vercel builds with. Vercel turns engines.node into one major version: an open range
// such as >=24.16 becomes the newest Node it offers (26 in November 2026), while the CI tests run on the
// major in .nvmrc. A caret range keeps both on the same major and keeps the 24.16 minimum.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const { engines } = JSON.parse(readFileSync('package.json', 'utf8')) as { engines: { node: string } };
const nvmrc = readFileSync('.nvmrc', 'utf8').trim();

describe('Node version', () => {
	it('pins engines.node to Node 24 from 24.16 with a caret range', () => {
		expect(engines.node).toBe('^24.16.0');
	});

	it('names the same major as .nvmrc, which the CI uses', () => {
		expect(engines.node.match(/^\^(\d+)\./)?.[1]).toBe(nvmrc);
	});
});
