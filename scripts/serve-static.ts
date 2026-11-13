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
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
	const target = resolve(join(base, path));
	if (target !== base && !target.startsWith(base + sep)) return null;
	const candidates = [target, join(target, 'index.html'), `${target}.html`];
	return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const root = resolve(option('--root', '.vercel/output/static'));
	const port = Number(option('--port', '4173'));
	if (!existsSync(join(root, 'index.html'))) {
		console.error(`No built site in ${root}. Run "pnpm build" first.`);
		process.exit(1);
	}
	createStaticServer(root).listen(port, '127.0.0.1', () => {
		console.log(`Serving ${root} at http://127.0.0.1:${port}`);
	});
}
