import { collections } from '@utils/collections';

/** A reference as the content files hold it. */
interface Ref {
	id: string;
}

/** The part of an entry the check reads. `filePath` is relative to the project root. */
interface Entry<D> {
	id: string;
	filePath?: string | undefined;
	data: D;
}

/** The five collections, as far as the check needs them. */
export interface Content {
	resources: readonly Entry<{
		section: Ref;
		categories?: readonly Ref[] | null | undefined;
		subcategories?: readonly Ref[] | null | undefined;
		tags: readonly Ref[];
	}>[];
	sections: readonly Entry<{ categories?: readonly Ref[] | null | undefined }>[];
	categories: readonly Entry<{ subcategories?: readonly Ref[] | null | undefined }>[];
	subcategories: readonly Entry<unknown>[];
	tags: readonly Entry<unknown>[];
}

/**
 * Finds every reference in the content that does not resolve, and every resource category that its section does not
 * list. Astro checks neither: a mistyped id drops a resource from a list, or stops the build without naming the file.
 * @param content The five collections.
 * @returns One message per fault, naming the file and the id, in the order of the input; empty when all is well.
 */
export function findBrokenReferences(content: Content): string[] {
	const ids = {
		sections: new Set(content.sections.map((entry) => entry.id)),
		categories: new Set(content.categories.map((entry) => entry.id)),
		subcategories: new Set(content.subcategories.map((entry) => entry.id)),
		tags: new Set(content.tags.map((entry) => entry.id)),
	};
	const sectionCategories = new Map(content.sections.map((section) => [section.id, new Set((section.data.categories ?? []).map((ref) => ref.id))]));
	const messages: string[] = [];

	const check = (where: string, field: keyof typeof ids, refs: readonly Ref[] | null | undefined) => {
		for (const ref of refs ?? []) {
			if (!ids[field].has(ref.id)) messages.push(`${where}: ${field} "${ref.id}" nu există în ${field}`);
		}
	};

	for (const resource of content.resources) {
		const where = resource.filePath ?? `resources/${resource.id}`;
		const { section, categories, subcategories, tags } = resource.data;
		if (!ids.sections.has(section.id)) messages.push(`${where}: section "${section.id}" nu există în sections`);
		check(where, 'categories', categories);
		check(where, 'subcategories', subcategories);
		check(where, 'tags', tags);
		const listed = sectionCategories.get(section.id);
		for (const category of categories ?? []) {
			if (listed && ids.categories.has(category.id) && !listed.has(category.id)) messages.push(`${where}: categoria "${category.id}" nu este în secțiunea "${section.id}"`);
		}
	}
	for (const section of content.sections) check(section.filePath ?? `sections/${section.id}`, 'categories', section.data.categories);
	for (const category of content.categories) check(category.filePath ?? `categories/${category.id}`, 'subcategories', category.data.subcategories);

	return messages;
}

/**
 * Stops the build when a reference in the content does not resolve, with every fault in one message.
 * @throws {Error} Listing each fault on its own line.
 */
export async function assertContentIntegrity(): Promise<void> {
	const [resources, sections, categories, subcategories, tags] = await Promise.all([
		collections.all('resources'),
		collections.all('sections'),
		collections.all('categories'),
		collections.all('subcategories'),
		collections.all('tags'),
	]);
	const messages = findBrokenReferences({ resources, sections, categories, subcategories, tags });
	if (messages.length > 0) throw new Error(`Referințe greșite în conținut:\n${messages.join('\n')}`);
}
