// The response headers vercel.json gives every page and file.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

interface HeaderRule {
	source: string;
	headers: { key: string; value: string }[];
}

const { headers = [] } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers?: HeaderRule[] };
const all = headers.flatMap((rule) => rule.headers);

describe('vercel.json', () => {
	// A browser accepts one origin or `*` in this header; a list makes it refuse the response to every origin.
	it('names at most one origin in each Access-Control-Allow-Origin', () => {
		const lists = all.filter(({ key, value }) => key.toLowerCase() === 'access-control-allow-origin' && value.includes(','));
		expect(lists).toEqual([]);
	});

	it('sends Access-Control-Allow-Methods only where it also allows an origin', () => {
		const origins = all.filter(({ key }) => key.toLowerCase() === 'access-control-allow-origin');
		const methods = all.filter(({ key }) => key.toLowerCase() === 'access-control-allow-methods');
		expect(methods.length === 0 || origins.length > 0).toBe(true);
	});
});
