import { PORT, SITE_ROOT } from './server.ts';
import { assertBuiltSite, createStaticServer } from '../scripts/serve-static.ts';

/**
 * Serve the built site for the whole run. The server lives inside the test runner, so it stops with it and
 * leaves nothing behind on the port.
 * @returns The function that stops the server.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
	assertBuiltSite(SITE_ROOT);

	const server = createStaticServer(SITE_ROOT);
	await new Promise<void>((done, failed) => {
		server.once('error', failed);
		server.listen(PORT, '127.0.0.1', done);
	});
	return async () => {
		server.closeAllConnections();
		await new Promise((done) => server.close(done));
	};
}
