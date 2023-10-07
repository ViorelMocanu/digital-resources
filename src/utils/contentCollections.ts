import { type CollectionEntry, getCollection } from "astro:content";

// @TODO: Vlad Lucaciu - In loc de n getter functions care sorteaza ceva, poate ar fi mai bine o functie generica cu niste parametrii (getSortedStuff(stuff, sortType)). Just my 2 cents code review

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
		(a, b) => (new Date(b.data.modDate as string).valueOf() - new Date(a.data.modDate as string).valueOf())
	);
};