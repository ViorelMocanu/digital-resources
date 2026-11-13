/** Where the end-to-end tests find the built site. */

import { resolve } from 'node:path';

/**
 * The folder that is served: the build output, or another copy of a built site named in E2E_SITE_ROOT (used to
 * prove that a test fails on a broken build).
 */
export const SITE_ROOT = resolve(process.env['E2E_SITE_ROOT'] ?? resolve(import.meta.dirname, '..', '.vercel', 'output', 'static'));

/** The port of the local server. */
export const PORT = 4173;

/** The address every test starts from. */
export const ORIGIN = `http://127.0.0.1:${PORT}`;
