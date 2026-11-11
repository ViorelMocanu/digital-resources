/**
 * Reading the checkout lock's holder (OpenSpec change harness-guardrails, design D1 "Shared code", D15 "The
 * handshake" and D17 "The lock gate in the guard").
 *
 * The light half of `scripts/checkout-lock.ts`: the lock's address, its handshake line and a synchronous read of the
 * holder, for the guard's lock gate. It loads neither `node:net` nor `node:crypto` on import (D1: a hook does not
 * load them); `lockAddress` loads `node:crypto` only on Windows, where it hashes the root into the pipe name.
 * `scripts/checkout-lock.ts` imports and re-exports everything here, so its importers keep one entry point.
 *
 * Uses only `node:` built-ins and the shared modules; no side effects on import.
 */

import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import { normaliseRoot, scratchPath } from './checkout-root.ts';
import { asciiLine } from '../hooks/hook-io.ts';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/** What a holder says about itself on each connection (design D15, "The handshake"). */
export interface Holder {
	pid: number;
	/** The wrapped script, such as `build`. */
	label: string;
	command: string;
	/** Local ISO time with offset. */
	started: string;
	/** 16 hex characters, passed to the holder's children. */
	token: string;
}

/** The variable that carries the holder's token to its children. */
export const TOKEN_VARIABLE = 'RESURSE_CHECKOUT_LOCK';

/** How long a probe waits for the holder's answer. */
export const PROBE_TIMEOUT_MS = 1000;

/** The longest handshake read. */
export const MAX_HANDSHAKE_BYTES = 4096;

/** The lock wrapper, which {@link readHolderSync} runs as `--probe` on POSIX. */
const LOCK_SCRIPT = resolve(import.meta.dirname, '..', 'checkout-lock.ts');

/**
 * The lock's address for a checkout: a named pipe on Windows, `<root>/tmp/.checkout-lock.sock` elsewhere. The pipe
 * name hashes the normalised root, so slash direction, letter case and a trailing separator do not matter, and the
 * socket path comes from the root alone, never the working directory.
 * @param root The checkout root, absolute.
 * @param platform The platform whose rules apply.
 * @returns The pipe name or the socket path.
 */
export function lockAddress(root: string, platform: NodeJS.Platform): string {
	const normalised = normaliseRoot(root, platform);
	if (platform === 'win32') {
		// Loaded here, not on import: the guard reads this module on every shell call (design D1).
		const { createHash } = process.getBuiltinModule('node:crypto');
		const hex = createHash('sha256').update(normalised).digest('hex').slice(0, 12);
		return `\\\\.\\pipe\\resurse-${hex}-checkout`;
	}
	return scratchPath(normalised, platform, '.checkout-lock.sock');
}

/**
 * Read a holder's handshake line.
 * @param text What the holder sent.
 * @returns The holder, or null when the text is not a valid handshake.
 */
export function parseHandshake(text: string): Holder | null {
	try {
		const value = JSON.parse(text.split('\n')[0] ?? '') as Record<string, unknown> | null;
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
		const { pid, label, command, started, token } = value;
		if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null;
		if (typeof label !== 'string' || typeof command !== 'string' || typeof started !== 'string') return null;
		if (typeof token !== 'string' || !/^[0-9a-f]{16}$/.test(token)) return null;
		return { pid, label, command, started, token };
	} catch {
		return null;
	}
}

/**
 * Show a holder's start time as `2026-10-25 14:02 +03:00`.
 * @param started The handshake's ISO time.
 * @returns The short form, or the text as sent when it is not an ISO time.
 */
function shownStart(started: string): string {
	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(started);
	if (match === null) return asciiLine(started);
	return `${match[1]} ${match[2]} ${match[3] === 'Z' ? '+00:00' : match[3]}`;
}

/**
 * Say who holds the lock, for the busy message and the guard's lock block.
 * @param holder The holder, or null when it did not say who it is.
 * @param now The current time.
 * @returns A clause such as `"build" is running in this checkout (pid 12345, started 2026-10-25 14:02 +03:00, 3 min ago)`.
 */
export function describeHolder(holder: Holder | null, now: Date): string {
	if (holder === null) return "another process holds this checkout's lock";
	const elapsed = now.getTime() - Date.parse(holder.started);
	const age = Number.isNaN(elapsed) ? '' : elapsed < 60_000 ? ', under 1 min ago' : `, ${Math.floor(elapsed / 60_000)} min ago`;
	return `"${asciiLine(holder.label)}" is running in this checkout (pid ${holder.pid}, started ${shownStart(holder.started)}${age})`;
}

/**
 * Read the holder of a checkout's lock synchronously, for the guard's lock gate (design D17). On Windows it opens the
 * pipe as a file and reads the handshake (about 1 ms); on POSIX, where Node has no synchronous socket connect, it
 * checks for the socket file first and only then runs the lock wrapper's `--probe` (one Node start).
 * @param root The checkout root.
 * @param platform The platform.
 * @returns The holder, or null when the lock is free or cannot be read.
 */
export function readHolderSync(root: string, platform: NodeJS.Platform = process.platform): Holder | null {
	const address = lockAddress(root, platform);
	if (platform === 'win32') {
		let fd: number;
		try {
			fd = openSync(address, 'r');
		} catch {
			return null;
		}
		const chunks: Buffer[] = [];
		let size = 0;
		const buffer = Buffer.alloc(MAX_HANDSHAKE_BYTES);
		try {
			for (;;) {
				const count = readSync(fd, buffer, 0, buffer.length, null);
				if (count === 0) break;
				chunks.push(Buffer.from(buffer.subarray(0, count)));
				size += count;
				if (buffer.subarray(0, count).includes(10) || size >= MAX_HANDSHAKE_BYTES) break;
			}
		} catch {
			// The holder closed the pipe after its line: EOF.
		} finally {
			closeSync(fd);
		}
		return parseHandshake(Buffer.concat(chunks).toString('utf-8'));
	}
	if (!existsSync(address)) return null;
	const result = spawnSync(process.execPath, [LOCK_SCRIPT, '--probe', root], { encoding: 'utf-8', timeout: PROBE_TIMEOUT_MS * 2, windowsHide: true });
	return result.status === 0 ? parseHandshake(result.stdout) : null;
}
