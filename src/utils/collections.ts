import { type CollectionEntry, type CollectionKey, getCollection } from 'astro:content';

type Load = <K extends CollectionKey>(key: K) => Promise<CollectionEntry<K>[]>;

/**
 * Collections that are fetched once and then answered from memory.
 *
 * A component that is on every page (the header, the footer, a resource list) used to fetch its collections on
 * every render. During a build the content cannot change, so one fetch serves every page. While developing it
 * can, so nothing is kept and an edited file shows up at once.
 * @param {Load} load Fetches one whole collection.
 * @param {boolean} keep Whether to keep what was fetched.
 * @returns {object} `all`, the entries of a collection in the order the loader gave them (not to be sorted in place), and `byId`, the same entries by their id.
 */
export function cachedCollections(load: Load, keep: boolean) {
	const lists = new Map<CollectionKey, Promise<unknown>>();
	const indexes = new Map<CollectionKey, Promise<unknown>>();

	const remember = <V>(kept: Map<CollectionKey, Promise<unknown>>, key: CollectionKey, make: () => Promise<V>): Promise<V> => {
		if (!keep) return make();
		if (!kept.has(key)) kept.set(key, make());
		return kept.get(key) as Promise<V>;
	};

	const all = <K extends CollectionKey>(key: K): Promise<readonly CollectionEntry<K>[]> => remember(lists, key, () => load(key));

	const byId = <K extends CollectionKey>(key: K): Promise<ReadonlyMap<string, CollectionEntry<K>>> =>
		remember(indexes, key, async () => new Map((await all(key)).map((entry) => [entry.id, entry])));

	return { all, byId };
}

/** The site's collections: kept for the whole of a build, fetched again on every use while developing. */
export const collections = cachedCollections(getCollection, import.meta.env.PROD);
