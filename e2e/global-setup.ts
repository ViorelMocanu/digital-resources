import { PORT, SITE_ROOT } from './server.ts';
import { createStaticServer } from '../scripts/serve-static.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Serve the built site for the whole run. The server lives inside the test runner, so it stops with it and
 * leaves nothing behind on the port.
 * @returns The function that stops the server.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
	const root = SITE_ROOT;
	if (!existsSync(join(root, 'index.html'))) throw new Error(`No built site in ${root}. Run "pnpm build" first.`);

	const server = createStaticServer(root);
	await new Promise<void>((done, failed) => {
		server.once('error', failed);
		server.listen(PORT, '127.0.0.1', done);
	});
	return async () => {
		server.closeAllConnections();
		await new Promise((done) => server.close(done));
	};
}
