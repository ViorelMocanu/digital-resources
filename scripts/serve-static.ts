/**
 * Serves the built site from `.vercel/output/static` on this machine, for the end-to-end tests.
 *
 * The Vercel adapter has no preview command for a static build, and the tests need the same addresses the host
 * serves: `/despre` answers with `despre/index.html`, and an unknown address answers 404 with `404.html`.
 * It listens on the loopback address only and never serves a file outside the folder it was given.
 *
 * Usage: node scripts/serve-static.ts [--port 4173] [--root .vercel/output/static]
 */

import { type Server, createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { isInside } from './lib/checkout-root.ts';

/** The build output of this repository. */
export const DEFAULT_ROOT = resolve(import.meta.dirname, '..', '.vercel', 'output', 'static');

/** The port the site is served on unless another is asked for. */
export const DEFAULT_PORT = 4173;

/**
 * Stop when a folder holds no built site.
 * @param root The folder that should hold a build.
 */
export function assertBuiltSite(root: string): void {
	if (!existsSync(join(root, 'index.html'))) throw new Error(`No built site in ${root}. Run "pnpm build" first.`);
}

/** The content type of each kind of file a build contains. */
const TYPES: Readonly<Record<string, string>> = {
	'.avif': 'image/avif',
	'.css': 'text/css; charset=utf-8',
	'.gif': 'image/gif',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.webmanifest': 'application/manifest+json; charset=utf-8',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.xml': 'application/xml; charset=utf-8',
};

/**
 * Find the file that answers an address.
 * @param root The served folder.
 * @param url The request address: a path with an optional query string.
 * @returns The absolute path of the file, or null when there is none inside the served folder.
 */
export function resolveFile(root: string, url: string): string | null {
	const base = resolve(root);
	let path: string;
	try {
		path = decodeURIComponent(url.split('?')[0] ?? '');
	} catch {
		return null;
	}
	// No file name holds a null byte, and the file system calls throw on one.
	if (path.includes('\0')) return null;
	const target = resolve(join(base, path));
	if (!isInside(target, base, process.platform)) return null;
	const candidates = [target, join(target, 'index.html'), `${target}.html`];
	return candidates.find((file) => statSync(file, { throwIfNoEntry: false })?.isFile()) ?? null;
}

/**
 * Create a server for one folder. The caller starts it with `listen`.
 * @param root The served folder.
 * @returns The server.
 */
export function createStaticServer(root: string): Server {
	return createServer((request, response) => {
		const found = resolveFile(root, request.url ?? '/');
		const file = found ?? resolveFile(root, '/404.html');
		if (!file) {
			response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
			response.end('Not found');
			return;
		}
		response.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
		createReadStream(file).pipe(response);
	});
}

/**
 * Read the value that follows a flag on the command line.
 * @param flag The flag, such as `--port`.
 * @param fallback The value when the flag is absent.
 * @returns The value.
 */
function option(flag: string, fallback: string): string {
	const index = process.argv.indexOf(flag);
	return (index >= 0 && process.argv[index + 1]) || fallback;
}

if (import.meta.main) {
	const root = resolve(option('--root', DEFAULT_ROOT));
	const port = Number(option('--port', String(DEFAULT_PORT)));
	assertBuiltSite(root);
	createStaticServer(root).listen(port, '127.0.0.1', () => {
		console.log(`Serving ${root} at http://127.0.0.1:${port}`);
	});
}
