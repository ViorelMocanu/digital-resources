// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.
import type { CollectionEntry, CollectionKey } from "astro:content";

// My .env file imports
const PUBLIC_APP_ENV = import.meta.env.PUBLIC_APP_ENV;
const PUBLIC_APP_DEBUG = import.meta.env.PUBLIC_APP_DEBUG;
const PUBLIC_APP_URL = (PUBLIC_APP_ENV === "local" || PUBLIC_APP_ENV === "development") ? import.meta.env.PUBLIC_APP_URL_LOCAL :
	(PUBLIC_APP_ENV === "staging" || PUBLIC_APP_ENV === "preview") ? import.meta.env.PUBLIC_APP_URL_STAGING || import.meta.env.BASE_URL :
		import.meta.env.PUBLIC_APP_URL_PRODUCTION;
export const CLARITY_ID = import.meta.env.CLARITY_ID;
export const PIWIK_ID = import.meta.env.PIWIK_ID;

// @TODO: make variables below asynchronous

// My static config variables
export const ENV = PUBLIC_APP_ENV;
export const DEBUG = PUBLIC_APP_DEBUG;
export const URL = PUBLIC_APP_URL;
export const SITE_TITLE = "Centralizator de resurse digitale gratuite pentru învățare";
export const SITE_DESCRIPTION = "Învață mai ușor urmărind resurse gratuite din domeniile: Front End Development, Back End Development, Design și UX, Marketing Online, Cyber Security și altele.";
export const SITE_NAME = "resurse.dev";
export const CONTACT_EMAIL = "contact@resurse.dev";
export const LANGUAGE = "ro"; //					🛑 @TODO: multi-language support with i18n
export const LANGUAGE_EXTENDED = "ro_RO";
export const LANGUAGE_EXTENDED_DASH = "ro-RO";
export const FACEBOOK_APP_ID = ""; //				🛑 @TODO: facebook app ID
export const TWITTER_SITE = ""; //					🛑 @TODO: twitter site
export const TWITTER_CREATOR = ""; //				🛑 @TODO: twitter creator
export const ACCENT_COLOR = "#2f8ded";
export const OG_IMAGE = "../public/ogimage.jpg";
export const OG_IMAGE_ALT = ""; //					🛑 @TODO: OG Image ALT
export const GLOBAL_PUB_DATE = "2023-09-30T19:35:55+03:00";
export const PAGE_SIZE = 10;

export const resourceTypeIcon: { [key: string]: string } = {
	generic: "🔗",
	carte: "📖",
	curs: "💡",
	video: "🎥",
	text: "📃",
};

// My introduced types

export type BreadcrumbArray = {
	href: string | URL;
	title: string;
	label: string;
}[];

export type Headings = {
	depth: number;
	slug: string;
	text: string;
}[];

export type extendedCategory = CollectionEntry<"categories"> & {
	subCategoryData: CollectionEntry<"subcategories">[] ;
};

export type extendedResource = Omit<CollectionEntry<"resources">, 'render'> & {
	type: string;
	tagData: CollectionEntry<"tags">[];
	sectionData: CollectionEntry<"sections"> | undefined;
	categoryData: CollectionEntry<"categories">[];
	subCategoryData: CollectionEntry<"subcategories">[] ;
};

export type Order = 'asc' | 'desc';
export type Type = 'text' | 'number' | 'date';
export type CollectionKeyEnum = 'sections' | 'categories' | 'subcategories' | 'resources' | 'tags' | CollectionKey;
