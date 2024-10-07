// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.
import type { CollectionEntry, CollectionKey } from 'astro:content';

// My .env file imports
const PUBLIC_APP_ENV = import.meta.env.PUBLIC_APP_ENV;
const PUBLIC_APP_DEBUG = import.meta.env.PUBLIC_APP_DEBUG;

let u: string = import.meta.env.BASE_URL || import.meta.env.VERCEL_URL;
if (PUBLIC_APP_ENV === 'local' || PUBLIC_APP_ENV === 'development') {
	// we are in a local or development environment
	u = import.meta.env.PUBLIC_APP_URL_LOCAL;
} else if (PUBLIC_APP_ENV === 'staging' || PUBLIC_APP_ENV === 'preview') {
	// we are in a staging or preview environment
	u = import.meta.env.PUBLIC_APP_URL_STAGING;
} else {
	// we are in a production environment
	u = import.meta.env.PUBLIC_APP_URL_PRODUCTION;
}
const PUBLIC_APP_URL = u;

// @TODO: make variables below asynchronous

// My static config variables
export const ENV = PUBLIC_APP_ENV || import.meta.env.VERCEL_ENV;
export const DEBUG = PUBLIC_APP_DEBUG;
export const URL = PUBLIC_APP_URL;
export const SITE_TITLE = 'Centralizator de resurse digitale gratuite pentru învățare';
export const SITE_DESCRIPTION =
	'Învață mai ușor urmărind resurse gratuite din domeniile: Front End Development, Back End Development, Design și UX, Marketing Online, Cyber Security și altele.';
export const SITE_NAME = 'resurse.dev';
export const SITE_TYPE = 'website'; // @see https://ogp.me/#types
export const CONTACT_EMAIL = 'contact@resurse.dev';
export const LANGUAGE = 'ro'; //					🛑 @TODO: multi-language support with i18n
export const LANGUAGE_EXTENDED = 'ro_RO';
export const LANGUAGE_EXTENDED_DASH = 'ro-RO';
export const FACEBOOK_APP_ID = ''; //				🛑 @TODO: facebook app ID
export const TWITTER_CARD = 'summary_large_image'; // "summary" | "summary_large_image" | "app" | "player" @see https://developer.x.com/en/docs/twitter-for-websites/cards/overview/abouts-cards
export const TWITTER_SITE = '@ViorelMocanu'; //		🛑 @TODO: twitter site
export const TWITTER_CREATOR = '@ViorelMocanu'; //	🛑 @TODO: twitter creator
export const ACCENT_COLOR = '#2f8ded';
export const OG_IMAGE = '../public/ogimage.jpg';
export const OG_IMAGE_ALT = ''; //					🛑 @TODO: OG Image ALT
export const GLOBAL_PUB_DATE = '2023-09-30T19:35:55+03:00';
export const DEFAULT_URL = '/';
export const DEFAULT_TITLE = 'Titlul nu a fost găsit';
export const DEFAULT_DESCRIPTION = 'Descrierea nu a fost găsită.';
export const DEFAULT_MENULABEL = 'Pagină';
export const PAGE_SIZE = 10;

export const resourceTypeIcon: { [key: string]: string } = {
	generic: '🔗',
	book: '📖',
	course: '💡',
	video: '🎥',
	text: '📃',
};

// My introduced types
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
