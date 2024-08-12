import { Author, Like, LikeTest, Rating, RelationResourceTag, Resource, ResourceType, Session, Tag, TagType, Taxonomy, TaxonomyType, User, Visits } from './tables';
import { defineDb } from 'astro:db';

export default defineDb({
	tables: {
		LikeTest,
		Author,
		User,
		ResourceType,
		Resource,
		Like,
		Rating,
		TaxonomyType,
		Taxonomy,
		TagType,
		Tag,
		RelationResourceTag,
		Visits,
		Session,
	},
});
