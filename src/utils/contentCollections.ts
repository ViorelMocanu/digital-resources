import { type CollectionEntry, getCollection } from "astro:content";

export const getSortedSections = async (): Promise<CollectionEntry<"sections">[]> => {
	return (await getCollection("sections")).sort((a, b) => a.data.sortOrder - b.data.sortOrder);
};

export const getSortedCategories = async (): Promise<CollectionEntry<"categories">[]> => {
	return (await getCollection("categories")).sort((a, b) => b.data.sortOrder - a.data.sortOrder);
};

export const getSortedSubcategories = async (): Promise<CollectionEntry<"subcategories">[]> => {
	return (await getCollection("subcategories")).sort((a, b) => b.data.sortOrder - a.data.sortOrder);
};

export const getSortedResources = async (): Promise<CollectionEntry<"resources">[]> => {
	return (await getCollection("resources")).sort(
		(a, b) => (new Date(b.data.pubDate).valueOf() - new Date(a.data.pubDate).valueOf())
	);
};