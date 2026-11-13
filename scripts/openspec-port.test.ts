import { PROJECT_RULES, portSkill, workflowText } from './openspec-port.ts';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

const RULES = `**Project rules. They override anything below.**

-   Wherever this text shows \`openspec <command>\`, run \`pnpm exec openspec <command>\`.
-   Never run \`openspec init\` or \`openspec update\`: they are the owner's commands. This repository already has its \`openspec/\` folder, so the setup questions below do not apply.
-   \`AGENTS.md\` wins over this skill. No git writes. Archiving moves a change folder, so archive only when the owner asked for it. A task is ticked when its check has passed, never in a batch.
-   Never run \`openspec feedback\` or \`openspec install\`: both reach outside this machine.
-   Where a step names a tool your host does not have (a question dialog, a todo list), ask in the chat and keep a plain checklist.`;

describe('portSkill', () => {
	it('drops allowed-tools, puts the rules on top and writes commands in the canonical form', () => {
		const stock = '---\nname: openspec-demo\nallowed-tools: Bash(openspec:*)\ndescription: A demo.\n---\n\nRun /opsx:apply, then /opsx:verify.\n';
		expect(portSkill(stock, 'openspec-demo')).toBe(`---\nname: openspec-demo\ndescription: A demo.\n---\n\n${RULES}\n\nRun /opsx-apply, then /opsx-verify.\n`);
	});

	it('refuses a text with no frontmatter', () => {
		expect(() => portSkill('Run /opsx:apply.\n', 'openspec-demo')).toThrow('openspec-demo: the stock skill has no frontmatter');
	});
});

describe('workflowText', () => {
	it('writes the frontmatter and one sentence that names the skill', () => {
		expect(workflowText({ id: 'sync', category: 'Workflow', description: 'Sync delta specs' }, 'openspec-sync-specs')).toBe(
			"---\nname: /opsx-sync\nid: opsx-sync\ncategory: Workflow\ndescription: Sync delta specs\n---\n\nRead `.agents/skills/openspec-sync-specs/SKILL.md` from the repository root and follow it, with the owner's arguments unchanged. Resolve every path from the repository root.\n"
		);
	});
});

describe('the ported files in .agents/', () => {
	const skills = readdirSync(join(repoRoot, '.agents/skills')).filter((name) => name.startsWith('openspec-'));
	const workflows = readdirSync(join(repoRoot, '.agents/workflows')).filter((name) => name.startsWith('opsx-'));

	it('finds the skills and workflows', () => {
		expect(skills.length).toBe(12);
		expect(workflows.length).toBe(12);
	});

	it('exports the rules block this test expects', () => {
		expect(PROJECT_RULES).toBe(RULES);
	});

	it.each(skills)('%s carries the rules block right after its frontmatter', (name) => {
		const text = read(join(repoRoot, '.agents/skills', name, 'SKILL.md'));
		const body = text.slice(text.indexOf('\n---\n', 4) + 5);
		expect(body.startsWith(`\n${RULES}\n\n`)).toBe(true);
	});

	it.each(workflows)('%s hands over to a skill that exists', (file) => {
		const skill = /`\.agents\/skills\/([a-z-]+)\/SKILL\.md`/.exec(read(join(repoRoot, '.agents/workflows', file)))?.[1];
		expect(skill).toBeDefined();
		expect(existsSync(join(repoRoot, '.agents/skills', skill ?? '', 'SKILL.md'))).toBe(true);
	});
});
