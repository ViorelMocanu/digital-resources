import { Author, Like, LikeTest, Rating, RelationResourceTag, Resource, Session, Tag, TagType, Taxonomy, TaxonomyType, User, Visits } from './tables';
import { defineDb } from 'astro:db';

export default defineDb({
	tables: {
		LikeTest,
		Author,
		User,
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
