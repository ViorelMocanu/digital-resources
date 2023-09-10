import { z, defineCollection } from "astro:content";

// documentație: https://zod.dev/
const resourceCollection = defineCollection({
	type: 'data',
	schema: z.array(
		z.object({
			title: z.string(),
			slug: z.string(),
			url: z.string().url({ message: "URL invalid" }),
			language: z.enum(["en", "ro"]),
			pubDate: z.string().optional(),
			addDate: z.string(),
			description: z.string(),
			authorName: z.string().optional(),
			authorUrl: z.string().url({ message: "URL invalid" }).optional(),
			section: z.enum(["Front End", "Back End", "Design", "Marketing", "NetSec", "Altele"]),
			category: z.string(),
			rating: z.number().min(1, "Rating-ul nu poate avea mai puțin de nota 1").max(100, "Rating-ul nu poate avea mai mult de nota 10").optional(),
			price: z.number().min(0, "Prețul nu poate fi negativ").optional(),
			requiredTime: z.number().optional(),
			type: z.string(),
			mandatory: z.boolean(),
			image: z.object({
				imageUrl: z.string().url({ message: "URL invalid" }),
				alt: z.string().optional(),
			}).nullable().optional(),
			tags: z.array(z.string()),
		})
	)
});

export const collections = {
	resources: resourceCollection,
}