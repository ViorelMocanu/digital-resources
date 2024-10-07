import { NOW, column, defineTable } from 'astro:db';

export const LikeTest = defineTable({
	columns: {
		id: column.number(),
		likes: column.number({ default: 0 }),
	},
});

export const Author = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		name: column.text({ optional: false }),
		slug: column.text({ unique: true, optional: false }), // @TODO: automatically generate slug from title using sqlight functions inline
		url: column.text({ optional: true }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const User = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		name: column.text(),
		username: column.text({ unique: true, optional: false }),
		slug: column.text({ unique: true, optional: false }), // @TODO: automatically generate slug from title using sqlight functions inline
		email: column.text({ unique: true, optional: true }),
		url: column.text({ optional: true }),
		avatar: column.text({ optional: true }),
		github: column.text({ unique: true, optional: true }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const ResourceType = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		title: column.text(),
		icon: column.text(), // get from resourceTypeIcon
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const Resource = defineTable({
	columns: {
		id: column.number({ primaryKey: true, unique: true }),
		title: column.text(),
		title_en: column.text({ optional: true }),
		slug: column.text({ unique: true, optional: false }), // @TODO: automatically generate slug from title using sqlight functions inline
		url: column.text({ unique: true, optional: false }),
		language: column.text({ default: 'en', optional: false }),
		description: column.text({ optional: true }),
		description_en: column.text({ optional: true }),
		author_id: column.number({ optional: true /*, references: () => Author.columns.id*/ }), // @TODO: add reference to Author or turn this into embedded columns: author_name, author_url
		resource_type_id: column.number({ default: 1, references: () => ResourceType.columns.id }),
		mandatory: column.boolean({ default: false }),
		price: column.number({ default: 0, optional: false }),
		required_time: column.number({ optional: true }),
		image: column.text({ optional: true }),
		image_alt: column.text({ optional: true }),
		image_alt_en: column.text({ optional: true }),
		taxonomy_id: column.number({ optional: true }), // @TODO: transform to column.json for multiple taxonomies
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
	indexes: [
		{
			on: ['taxonomy_id', 'modified_at', 'title'],
			unique: false,
		},
		{
			on: ['url', 'slug'],
			unique: true,
		},
	],
});

export const Like = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		resource_id: column.number({ references: () => Resource.columns.id }),
		user_id: column.number({ references: () => User.columns.id }),
		created_at: column.date({ default: NOW }),
	},
});

export const Rating = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		resource_id: column.number({ references: () => Resource.columns.id }),
		rating: column.number({ default: 5 }),
		user_id: column.number({ references: () => User.columns.id }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const TaxonomyType = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		title: column.text(),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const Taxonomy = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		title: column.text({ optional: false }),
		title_en: column.text({ optional: true }),
		slug: column.text({ optional: false, unique: false }), // @TODO: automatically generate slug from title using sqlight functions inline
		description: column.text({ optional: true }),
		description_en: column.text({ optional: true }),
		taxonomy_type_id: column.number({ references: () => TaxonomyType.columns.id }),
		parent_id: column.number({ optional: true, nullable: true /*, references: () => Taxonomy.columns.id*/ }), // @TODO: add self reference
		menu: column.text({ optional: true }),
		menu_en: column.text({ optional: true }),
		sort_order: column.number({ default: 0 }),
		image: column.text({ optional: true }),
		image_alt: column.text({ optional: true }),
		image_alt_en: column.text({ optional: true }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
	indexes: [
		{
			on: ['taxonomy_type_id', 'modified_at', 'slug'],
			unique: false,
		},
	],
});

export const TagType = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		title: column.text(),
		title_en: column.text({ optional: true }),
		slug: column.text({ unique: true, optional: false }), // @TODO: automatically generate slug from title using sqlight functions inline
		description: column.text({ optional: true }),
		description_en: column.text({ optional: true }),
		image: column.text({ optional: true }),
		image_alt: column.text({ optional: true }),
		image_alt_en: column.text({ optional: true }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const Tag = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		title: column.text(),
		title_en: column.text({ optional: true }),
		slug: column.text({ unique: true, optional: false }), // @TODO: automatically generate slug from title using sqlight functions inline
		description: column.text({ optional: true }),
		description_en: column.text({ optional: true }),
		tag_type_id: column.number({ references: () => TagType.columns.id }),
		image: column.text({ optional: true }),
		image_alt: column.text({ optional: true }),
		image_alt_en: column.text({ optional: true }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const RelationResourceTag = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		resource_id: column.number({ references: () => Resource.columns.id }),
		tag_id: column.number({ references: () => Tag.columns.id }),
		created_at: column.date({ default: NOW }),
		modified_at: column.date({ default: NOW, nullable: true }),
	},
});

export const Visits = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		page_slug: column.text({ default: '/' }),
		pagination: column.number({ default: 1 }),
		visitor_logged_in: column.boolean({ default: false }),
		visitor_user_id: column.number({ optional: true, references: () => User.columns.id }),
		visitor_ip_hash: column.text(),
		visitor_user_agent_hash: column.text(),
		visitor_count: column.number({ default: 1 }),
	},
});

export const Session = defineTable({
	columns: {
		id: column.text({ primaryKey: true }),
		user_id: column.number({ references: () => User.columns.id }),
		expiresAt: column.number(),
	},
});
