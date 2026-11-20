/**
 * A second audit of what the site ships, for the case pnpm 10's own audit cannot see.
 *
 * `pnpm audit` in pnpm 10 sends the registry a tree in which each package's dependencies are keyed by their real name.
 * When a package depends on two versions of one package and one of them is installed under another name (an alias),
 * the alias overwrites the other version and the registry never hears of it. That is how path-to-regexp 6.1.0 under
 * `@vercel/routing-utils` passed `pnpm audit --prod` until 2026-11-20.
 *
 * This script reads the production tree of pnpm-lock.yaml, the file `pnpm audit` reads, as
 * `pnpm list --prod --json --depth Infinity --lockfile-only` prints it. It keeps every version of every package under
 * its real name, sends them all to the registry's bulk advisory endpoint (the one pnpm 11's audit uses) and fails when
 * an advisory's range holds one of them. A registry that cannot be reached, or an answer it cannot read, fails the
 * check too.
 *
 * Usage: pnpm audit:bulk (which pipes pnpm list into node scripts/audit-bulk.ts)
 */

import { satisfies, sort, valid, validRange } from 'semver';

/** The registry's bulk advisory endpoint: names and versions in, the advisories that touch them out. */
export const BULK_ENDPOINT = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk';

/** How many package names go into one request. */
const BATCH_SIZE = 100;

/** One installed package in the output of `pnpm list --json`. */
export interface ListNode {
	/** The real package name; the key above it is the name it is installed under. */
	from?: string;
	version?: string;
	dependencies?: Record<string, ListNode>;
	optionalDependencies?: Record<string, ListNode>;
}

/** One project in the output of `pnpm list --json`. Its unsavedDependencies are hoisted links, not dependencies. */
export interface ListRoot {
	dependencies?: Record<string, ListNode>;
	optionalDependencies?: Record<string, ListNode>;
	unsavedDependencies?: Record<string, ListNode>;
}

/** An advisory as the bulk endpoint returns it. */
export interface Advisory {
	id: number;
	url: string;
	title: string;
	severity: string;
	vulnerable_versions: string;
}

/** A locked version inside an advisory's range. */
export interface Finding {
	name: string;
	version: string;
	advisory: Advisory;
}

/** Versions by real package name. */
export type Versions = Record<string, string[]>;

/** Advisories by package name. */
export type Answers = Record<string, Advisory[]>;

/**
 * Every registry version in a `pnpm list` tree, by real package name. Links and other versions that are not a
 * semver version (a workspace package, a hoisted copy) are left out.
 * @param roots The parsed output of `pnpm list --json`.
 * @returns The versions of each package, sorted.
 */
export function collectVersions(roots: readonly ListRoot[]): Versions {
	const found = new Map<string, Set<string>>();
	const walk = (dependencies: Record<string, ListNode> | undefined): void => {
		for (const [key, node] of Object.entries(dependencies ?? {})) {
			if (node.version && valid(node.version)) {
				const name = node.from ?? key;
				const versions = found.get(name) ?? new Set<string>();
				versions.add(node.version);
				found.set(name, versions);
			}
			walk(node.dependencies);
			walk(node.optionalDependencies);
		}
	};
	for (const root of roots) {
		walk(root.dependencies);
		walk(root.optionalDependencies);
	}
	return Object.fromEntries([...found].sort(([a], [b]) => a.localeCompare(b)).map(([name, versions]) => [name, sort([...versions])]));
}

/**
 * The locked versions that fall inside an advisory's range, read as npm and pnpm 11 read it (loose, prereleases
 * included). An advisory whose range cannot be read throws: dropping it would pass the check.
 * @param versions The locked versions by package name.
 * @param answers The advisories the endpoint returned.
 * @returns One finding per version and advisory.
 */
export function matchFindings(versions: Versions, answers: Answers): Finding[] {
	return Object.entries(answers).flatMap(([name, advisories]) => {
		if (!Array.isArray(advisories)) throw new Error(`the bulk advisory endpoint answered something other than a list for ${name}`);
		return advisories.flatMap((advisory) => {
			const range: unknown = advisory.vulnerable_versions;
			if (typeof range !== 'string' || validRange(range, { loose: true }) === null) {
				throw new Error(`the bulk advisory endpoint returned advisory ${advisory.id} for ${name} with a range semver cannot read: ${String(range)}`);
			}
			return (versions[name] ?? []).filter((version) => satisfies(version, range, { includePrerelease: true, loose: true })).map((version) => ({ name, version, advisory }));
		});
	});
}

/**
 * Ask the endpoint about every package, a batch of names at a time.
 * @param versions The locked versions by package name.
 * @param batchSize How many names go into one request.
 * @param post Sends one batch and returns its answer.
 * @returns The advisories of all batches.
 */
export async function queryAdvisories(versions: Versions, batchSize: number, post: (body: Versions) => Promise<Answers>): Promise<Answers> {
	const names = Object.keys(versions).sort();
	let answers: Answers = {};
	for (let start = 0; start < names.length; start += batchSize) {
		const body = Object.fromEntries(names.slice(start, start + batchSize).map((name) => [name, versions[name] ?? []]));
		answers = { ...answers, ...(await post(body)) };
	}
	return answers;
}

/**
 * Send one batch to the bulk endpoint. A network error, a server error or a 429 (too many requests) is tried once
 * more; any other refusal is final.
 * @param body The versions by package name.
 * @param fetchImpl The fetch to use.
 * @returns The advisories by package name.
 */
export async function postBulk(body: Versions, fetchImpl: typeof fetch = fetch): Promise<Answers> {
	let failure = new Error('the bulk advisory endpoint was not called');
	for (let attempt = 1; attempt <= 2; attempt++) {
		let response: Response;
		try {
			response = await fetchImpl(BULK_ENDPOINT, {
				method: 'POST',
				headers: { 'accept': 'application/json', 'content-type': 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(30_000),
			});
		} catch (error) {
			failure = error instanceof Error ? error : new Error(String(error));
			continue;
		}
		if (response.ok) {
			const answer: unknown = await response.json();
			if (typeof answer !== 'object' || answer === null || Array.isArray(answer)) throw new Error('the bulk advisory endpoint answered something other than an object');
			return answer as Answers;
		}
		failure = new Error(`the bulk advisory endpoint answered HTTP ${response.status}`);
		if (response.status < 500 && response.status !== 429) throw failure;
	}
	throw failure;
}

/**
 * The whole check, from the text pnpm list printed to the lines to print and the exit code.
 * @param input The output of `pnpm list --prod --json --depth Infinity`.
 * @param post Sends one batch to the endpoint and returns its answer.
 * @returns The exit code and the lines to print.
 */
export async function run(input: string, post: (body: Versions) => Promise<Answers>): Promise<{ exitCode: number; lines: string[] }> {
	let roots: unknown;
	try {
		roots = JSON.parse(input);
	} catch {
		roots = undefined;
	}
	if (!Array.isArray(roots)) return { exitCode: 1, lines: ['The input is not the JSON that pnpm list --prod --json --depth Infinity prints.'] };
	const versions = collectVersions(roots as ListRoot[]);
	const names = Object.keys(versions);
	if (names.length === 0) return { exitCode: 1, lines: ['The production tree is empty: pnpm-lock.yaml is missing or lists no production dependency.'] };
	const findings = matchFindings(versions, await queryAdvisories(versions, BATCH_SIZE, post));
	if (findings.length === 0) {
		const count = names.reduce((sum, name) => sum + (versions[name]?.length ?? 0), 0);
		return { exitCode: 0, lines: [`No known advisory in ${count} versions of ${names.length} production packages.`] };
	}
	return {
		exitCode: 1,
		lines: [
			`${findings.length} known ${findings.length === 1 ? 'advisory' : 'advisories'} in the production packages:`,
			...findings.map(({ name, version, advisory }) => `${name}@${version}: ${advisory.severity}, ${advisory.title} (${advisory.vulnerable_versions}) ${advisory.url}`),
		],
	};
}

if (import.meta.main) {
	process.stdin.setEncoding('utf8');
	let input = '';
	for await (const chunk of process.stdin) input += String(chunk);
	try {
		const result = await run(input, (body) => postBulk(body));
		for (const line of result.lines) console.log(line);
		process.exitCode = result.exitCode;
	} catch (error) {
		console.error(`The advisory check could not finish: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
}
