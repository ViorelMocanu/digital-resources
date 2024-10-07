/**
 * Inserts proper class names to navigational elements that should be marked as Active when appropriate
 * @function highlightUrl
 * @param {string} urlFragment The slug you would like to check against the current link to make active
 * @param {string} standardClass The CSS class names you would like to have by default on all links / buttons
 * @param {string} activeClass The CSS class names you would like to have on Active links / buttons
 * @param {string} [currentUrl] The current URL you would like to check against the current link to make active
 * @returns {Array.<string>} An array of strings representing CSS class names
 */
export function highlightUrl(urlFragment: string, standardClass: string, activeClass: string, currentUrl?: string): string[] {
	if (!urlFragment || !standardClass || !activeClass) return ['Error'];

	const classes = [standardClass];

	const isActive = currentUrl ? currentUrl.startsWith(urlFragment) : typeof window !== 'undefined' && window.location.href.startsWith(urlFragment);

	if (isActive) {
		classes.push(activeClass);
	}

	return classes;
}

/**
 * Creates a slug from a title string
 * @function createSlug
 * @param {string} title The title of the current resource
 * @returns {string} A slugified version of the title
 */
export function createSlug(title: string): string {
	return (
		title
			// remove leading & trailing whitespace
			.trim()
			// remove special characters
			.replace(/[^A-Za-z0-9 ]/g, '')
			// replace spaces
			.replace(/\s+/g, '-')
			// remove leading & trailing separtors
			.replace(/^-+|-+$/g, '')
			// output lowercase
			.toLowerCase()
	);
}
// @TODO: why not https://www.npmjs.com/package/limax ???
