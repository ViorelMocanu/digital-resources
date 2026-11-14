import { defineCollection, reference } from 'astro:content';
import { dateTextSchema } from './utils/resourceMeta';
import { glob } from 'astro/loaders';
import { ratingSchema } from './utils/rating';
import { z } from 'astro/zod';

// documentație: https://zod.dev/

/**
 * Loads every Markdown file of one collection folder. The id of an entry is its `slug` frontmatter field when it
 * has one, else its file name without the extension: the value `entry.slug` had before the Content Layer.
 * @param {string} folder The collection's folder name under `src/content/`.
 * @returns {ReturnType<typeof glob>} The loader for `defineCollection`.
 */
const markdownIn = (folder: string) => glob({ pattern: '**/[^_]*.md', base: `./src/content/${folder}` });

/** The short description every collection but the resources carries: it is also the page's meta description. */
const shortDescription = z.string().max(165, 'Descrierea scurtă trebuie să fie de maxim 165 caractere');

const resourceCollection = defineCollection({
	loader: markdownIn('resources'),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			url: z.url('URL invalid'),
			language: z.enum(['en', 'ro']),
			modDate: dateTextSchema.optional(),
			addDate: z.string(),
			description: z.string(),
			authorName: z.string().optional(),
			authorUrl: z.url('URL invalid').optional(),
			section: reference('sections'),
			categories: z.array(reference('categories')).nullish(),
			subcategories: z.array(reference('subcategories')).nullish(),
			rating: ratingSchema,
			price: z.number().min(0, 'Prețul nu poate fi negativ').optional(),
			requiredTime: z.number().optional(),
			type: z.enum(['text', 'video', 'curs', 'carte']),
			mandatory: z.boolean(),
			image: z
				.object({
					// @TODO: make either imageLocalUrl or imageUrl be validated for the image object to become valid
					// The minimum width (1000px) is checked where the resource page is built: src/utils/imageRules.ts
					imageLocalUrl: image().optional(),
					// @TODO: add file type extension validation for imageUrl
					imageUrl: z.url('Imagine cu URL invalid.').optional(),
					imageAlt: z.string().optional(),
				})
				.nullish(),
			tags: z.array(reference('tags')),
		}),
});

const tagCollection = defineCollection({
	loader: markdownIn('tags'),
	schema: z.object({
		title: z.string(),
		type: z.string(),
		image: z
			.object({
				imageUrl: z.url('URL invalid'),
				imageAlt: z.string().optional(),
			})
			.nullish(),
		description: shortDescription,
		publishDate: z.date().optional(),
	}),
});

const sectionCollection = defineCollection({
	loader: markdownIn('sections'),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			menu: z.string(),
			sortOrder: z.number(),
			// The minimum width (100px) is checked where the section page is built: src/utils/imageRules.ts
			imageUrl: image().optional(),
			imageAlt: z.string().optional(),
			description: shortDescription,
			categories: z.array(reference('categories')).nullish(),
			publishDate: z.date(),
		}),
});

const categoryCollection = defineCollection({
	loader: markdownIn('categories'),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			menu: z.string(),
			sortOrder: z.number(),
			image: z
				.object({
					// Through the image pipeline, as for sections: the page gets a built file, not a source path.
					imageUrl: image().optional(),
					imageAlt: z.string().optional(),
				})
				.nullish(),
			description: shortDescription,
			subcategories: z.array(reference('subcategories')).nullish(),
			publishDate: z.date(),
		}),
});

const subcategoriesCollection = defineCollection({
	loader: markdownIn('subcategories'),
	schema: z.object({
		title: z.string(),
		menu: z.string(),
		sortOrder: z.number(),
		image: z
			.object({
				imageUrl: z.string().optional(),
				imageAlt: z.string().optional(),
			})
			.nullish(),
		description: shortDescription,
	}),
});

export const collections = {
	resources: resourceCollection,
	tags: tagCollection,
	sections: sectionCollection,
	categories: categoryCollection,
	subcategories: subcategoriesCollection,
};
