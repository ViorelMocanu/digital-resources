// Ports the stock skills of the installed OpenSpec package into .agents/, with this project's rules on top.
//
// Each skill keeps the stock text of the installed version. Each workflow is one sentence that hands over to its
// skill, so the instructions exist once. The script calls the package's own template functions: it does not run
// `openspec init` or `openspec update`, and it writes only under .agents/.
//
// Usage: pnpm openspec:port, then format and sync (docs/agent/harness-sync.md, "Upgrading OpenSpec").
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/** The block every ported skill carries between its frontmatter and the stock text. */
export const PROJECT_RULES = [
	'**Project rules. They override anything below.**',
	'',
	'-   Wherever this text shows `openspec <command>`, run `pnpm exec openspec <command>`.',
	"-   Never run `openspec init` or `openspec update`: they are the owner's commands. This repository already has its `openspec/` folder, so the setup questions below do not apply.",
	'-   `AGENTS.md` wins over this skill. No git writes. Archiving moves a change folder, so archive only when the owner asked for it. A task is ticked when its check has passed, never in a batch.',
	'-   Never run `openspec feedback` or `openspec install`: both reach outside this machine.',
	'-   Where a step names a tool your host does not have (a question dialog, a todo list), ask in the chat and keep a plain checklist.',
].join('\n');

const FRONTMATTER_END = '\n---\n';

/**
 * Turns one stock skill into this project's version: the `allowed-tools` key is dropped (OpenSpec commands keep the
 * normal permission prompt), the rules block goes on top, and commands are written `/opsx-<verb>`, the canonical
 * form that the harness sync rewrites per tool.
 * @param stock The skill text as the package generates it.
 * @param name The skill's folder name, for the error message.
 * @returns The text to write to `.agents/skills/<name>/SKILL.md`, before formatting.
 */
export function portSkill(stock: string, name: string): string {
	const end = stock.indexOf(FRONTMATTER_END, 4);
	if (!stock.startsWith('---\n') || end < 0) throw new Error(`${name}: the stock skill has no frontmatter`);
	const front = stock
		.slice(0, end + FRONTMATTER_END.length)
		.split('\n')
		.filter((line) => !line.startsWith('allowed-tools:'))
		.join('\n');
	const body = stock
		.slice(end + FRONTMATTER_END.length)
		.replace(/^\n+/, '')
		.replaceAll('/opsx:', '/opsx-');
	return `${front}\n${PROJECT_RULES}\n\n${body}`;
}

export interface StockCommand {
	id: string;
	category: string;
	description: string;
}

/**
 * The whole text of one workflow: its frontmatter and the sentence that hands over to its skill.
 * @param command The command as the package describes it.
 * @param skill The folder name of the skill the workflow hands over to.
 * @returns The text to write to `.agents/workflows/opsx-<id>.md`.
 */
export function workflowText(command: StockCommand, skill: string): string {
	const name = `opsx-${command.id}`;
	return [
		'---',
		`name: /${name}`,
		`id: ${name}`,
		`category: ${command.category}`,
		`description: ${command.description}`,
		'---',
		'',
		`Read \`.agents/skills/${skill}/SKILL.md\` from the repository root and follow it, with the owner's arguments unchanged. Resolve every path from the repository root.`,
		'',
	].join('\n');
}

/** The part of the package's skill-generation module this script uses. */
interface SkillGeneration {
	getSkillTemplates(): { template: unknown; dirName: string; workflowId: string }[];
	getCommandContents(): StockCommand[];
	generateSkillContent(template: unknown, version: string): string;
}

export interface PortResult {
	version: string;
	skills: string[];
	workflows: string[];
}

/**
 * Writes every skill and workflow of the installed OpenSpec package into `.agents/`.
 * @param root The repository root: where `package.json` and `.agents/` are.
 * @returns The package version and the names written.
 */
export async function port(root: string): Promise<PortResult> {
	const require = createRequire(join(root, 'package.json'));
	const packageRoot = resolve(dirname(require.resolve('@fission-ai/openspec')), '..');
	const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string };
	const generation = (await import(pathToFileURL(join(packageRoot, 'dist/core/shared/skill-generation.js')).href)) as SkillGeneration;

	const skillOf = new Map<string, string>();
	for (const { template, dirName, workflowId } of generation.getSkillTemplates()) {
		const folder = join(root, '.agents/skills', dirName);
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'SKILL.md'), portSkill(generation.generateSkillContent(template, version), dirName));
		skillOf.set(workflowId, dirName);
	}

	const workflows: string[] = [];
	mkdirSync(join(root, '.agents/workflows'), { recursive: true });
	for (const command of generation.getCommandContents()) {
		const skill = skillOf.get(command.id);
		if (!skill) throw new Error(`${command.id}: the package has a command with no skill`);
		writeFileSync(join(root, '.agents/workflows', `opsx-${command.id}.md`), workflowText(command, skill));
		workflows.push(`opsx-${command.id}`);
	}
	return { version, skills: [...skillOf.values()], workflows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const result = await port(resolve(import.meta.dirname, '..'));
	console.log(`Ported OpenSpec ${result.version}: ${result.skills.length} skills, ${result.workflows.length} workflows.`);
}
