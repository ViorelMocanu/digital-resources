import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticServer, resolveFile } from './serve-static.ts';
import { makeScratchDir, removeScratchDir } from './lib/scratch-git.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { join } from 'node:path';

let outside: string;
let root: string;
let server: Server;
let origin: string;

beforeAll(async () => {
	outside = makeScratchDir('serve-static-');
	root = join(outside, 'site');
	mkdirSync(join(root, 'despre'), { recursive: true });
	mkdirSync(join(root, '_astro'), { recursive: true });
	writeFileSync(join(outside, 'secret.txt'), 'not served');
	writeFileSync(join(root, 'index.html'), '<h1>Home</h1>');
	writeFileSync(join(root, '404.html'), '<h1>Not found</h1>');
	writeFileSync(join(root, 'despre', 'index.html'), '<h1>Despre</h1>');
	writeFileSync(join(root, '_astro', 'style.css'), 'body { margin: 0; }');
	writeFileSync(join(root, 'with space.txt'), 'spaced');
	server = createStaticServer(root);
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
	await new Promise((done) => server.close(done));
	removeScratchDir(outside);
});

describe('resolveFile', () => {
	it('maps the root address to the index file', () => {
		expect(resolveFile(root, '/')).toBe(join(root, 'index.html'));
	});

	it('maps a folder address, with or without the closing slash, to its index file', () => {
		expect(resolveFile(root, '/despre')).toBe(join(root, 'despre', 'index.html'));
		expect(resolveFile(root, '/despre/')).toBe(join(root, 'despre', 'index.html'));
	});

	it('drops the query string and decodes the path', () => {
		expect(resolveFile(root, '/with%20space.txt?v=1')).toBe(join(root, 'with space.txt'));
	});

	it('returns nothing for a file that does not exist', () => {
		expect(resolveFile(root, '/lipsa')).toBeNull();
	});

	it('never leaves the served folder', () => {
		expect(resolveFile(root, '/../secret.txt')).toBeNull();
		expect(resolveFile(root, '/%2e%2e/secret.txt')).toBeNull();
		expect(resolveFile(root, '/despre/../../secret.txt')).toBeNull();
	});

	it('returns nothing for a path that cannot be decoded', () => {
		expect(resolveFile(root, '/%E0%A4%A')).toBeNull();
	});
});

describe('createStaticServer', () => {
	it('serves a page as HTML in UTF-8', async () => {
		const response = await fetch(`${origin}/despre`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(await response.text()).toBe('<h1>Despre</h1>');
	});

	it('serves a style sheet with its type', async () => {
		const response = await fetch(`${origin}/_astro/style.css`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8');
	});

	it('answers 404 with the not-found page for an unknown address', async () => {
		const response = await fetch(`${origin}/lipsa`);
		expect(response.status).toBe(404);
		expect(await response.text()).toBe('<h1>Not found</h1>');
	});
});
