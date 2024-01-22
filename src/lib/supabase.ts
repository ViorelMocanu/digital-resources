// docs: https://supabase.com/docs/guides/api/rest/generating-types
// docs for running supabase locally: https://supabase.com/docs/reference/cli/global-flags
import { type PostgrestError, createClient } from '@supabase/supabase-js';
import type { Database } from '@customtypes/supabase';
import { getTaxonomyChildren } from '@utils/getTaxonomies';

export const supabase = createClient<Database>(
	import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
	import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;
export type DbResultErr = PostgrestError;
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

const sectionQuery = supabase
	.from('taxonomy')
	.select(`
		id,
		created_at,
		modified_at,
		title,
		slug,
		type (
			id,
			title
		),
		parent (
			id,
			title,
			slug
		),
		menu,
		sort_order,
		description,
		image,
		image_alt
	`)
	.eq('type', '1')
	.is('parent', null)
	.order('sort_order', { ascending: true });
export type Sections = DbResultOk<typeof sectionQuery>;
let { data: sections, error: errSections } = await sectionQuery;
if (errSections) throw errSections;

export const allSections = sections;

const taxonomyQuery = supabase
	.from('taxonomy')
	.select(`
		id,
		created_at,
		modified_at,
		title,
		slug,
		type (
			id,
			title
		),
		parent,
		menu,
		sort_order,
		description,
		image,
		image_alt
	`)
	.order('sort_order', { ascending: true });
export type Taxonomies = DbResultOk<typeof taxonomyQuery>;
let { data: taxonomies, error: errTaxonomies } = await taxonomyQuery;
if (errTaxonomies) throw errTaxonomies;

export const allTaxonomies = taxonomies;

export const taxonomyTree = sections?.map((section) => ({
	...section,
	categories: getTaxonomyChildren(taxonomies, section.id),
}));

const allResourcesQuery = supabase.from('resources').select(`
	id,
	created_at,
	modified_at,
	title,
	slug,
	url,
	language,
	description,
	author_name,
	author_url,
	section (
		id,
		title,
		slug,
		type,
		parent,
		menu,
		sort_order,
		description,
		image,
		image_alt
	),
	tags (
		id,
		title,
		slug,
		type (
			id,
			title,
			slug,
			description
		),
		description,
		image
	),
	rating,
	price,
	required_time,
	image,
	image_alt
`);
let { data: resources, error } = await allResourcesQuery;
export type Resources = DbResultOk<typeof allResourcesQuery>;
if (error) throw error;

export const allResources = resources;
