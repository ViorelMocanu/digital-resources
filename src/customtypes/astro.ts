import type { CollectionEntry, CollectionKey } from 'astro:content';

export type BreadcrumbItem = {
	href: string | URL;
	title: string;
	label: string;
};

export type Headings = {
	depth: number;
	slug: string;
	text: string;
}[];

export type ExtendedCategory = CollectionEntry<'categories'> & {
	subCategoryData: CollectionEntry<'subcategories'>[];
};

export type ExtendedResource = Omit<CollectionEntry<'resources'>, 'render'> & {
	type: string;
	tagData: CollectionEntry<'tags'>[];
	sectionData: CollectionEntry<'sections'> | undefined;
	categoryData: CollectionEntry<'categories'>[];
	subCategoryData: CollectionEntry<'subcategories'>[];
};

export type Order = 'asc' | 'desc';
export type Type = 'text' | 'number' | 'date';
export type CollectionKeyEnum = 'sections' | 'categories' | 'subcategories' | 'resources' | 'tags' | CollectionKey;
