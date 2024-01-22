import type { Taxonomies } from '@lib/supabase';

/**
 * Filters and maps an array of taxonomies to return an array of taxonomies that have a specific parent ID.
 * @param {Taxonomies} data - An array of taxonomies or null.
 * @param {number} id - The parent ID to filter the taxonomies.
 * @returns {Taxonomies} An array of taxonomies with their subcategories.
 */
export function getTaxonomyChildren(data: Taxonomies | null, id: number) {
	const flattenedTaxonomies = data ? data.flat() : [];

	const onlyCategories = flattenedTaxonomies.filter((taxonomy) => taxonomy.parent === id);

	const taxonomies = onlyCategories.map((category) => {
		const subcategories = flattenedTaxonomies.filter((taxonomy) => taxonomy.parent === category.id);

		return {
			...category,
			subcategories,
		};
	});

	return taxonomies;
}

/**
 * Retrieves the parent taxonomies of a given taxonomy ID.
 * @param {Taxonomies} data - The taxonomies data, an array of objects with `id` and `parent` properties, or `null` if there is no data.
 * @param {number} id - The ID of the taxonomy for which to find the parents.
 * @returns {Array} An array containing the current taxonomy, its parent taxonomy, and its grandparent taxonomy.
 */
export function getTaxonomyParents(data: Taxonomies | null, id?: number) {
	const flattenedTaxonomies = data ? data.flat() : [];

	let taxonomies = [];

	const currentTaxonomy = flattenedTaxonomies.find((taxonomy) => taxonomy.id === id);
	taxonomies.push(currentTaxonomy);

	const parentTaxonomy = flattenedTaxonomies.find((taxonomy) => taxonomy.id === currentTaxonomy?.parent);
	if (parentTaxonomy) taxonomies.push(parentTaxonomy);

	const grandparentTaxonomy = flattenedTaxonomies.find((taxonomy) => taxonomy.parent === parentTaxonomy?.parent);
	if (grandparentTaxonomy) taxonomies.push(grandparentTaxonomy);

	return taxonomies;
}

/**
 *
 * @param taxonomyTree
 * @param searchId
 */
export function searchTaxonomyTree(taxonomyTree, searchId) {
	taxonomyTree.forEach((taxonomy) => {
		//console.log('searching taxonomy:', taxonomy.id, searchId);
		if (taxonomy.id === searchId) {
			//console.log('am gasit rezultat:', taxonomy, searchId);
			return true;
		}

		if (taxonomy.categories) {
			return searchTaxonomyTree(taxonomy.categories, searchId);
		}

		if (taxonomy.subcategories) {
			return searchTaxonomyTree(taxonomy.subcategories, searchId);
		}
	});
	return false;
}
