/**
 * Inserts proper class names to navigational elements that should be marked as Active when appro
 * @param {string} urlFragment The slug you would like to check against the current link to make active
 * @param {string} standardClass The CSS class names you would like to have by default on all links / buttons
 * @param {string} activeClass The CSS class names you would like to have on Active links / buttons
 * @param {string} [currentUrl] The current URL you would like to check against the current link to make active
 * @returns {string} A series of concatenated CSS class names
 */
export function highlightUrl (urlFragment: string, standardClass: string, activeClass: string, currentUrl?: string): string {
	if (currentUrl && currentUrl.startsWith(urlFragment)) return `${standardClass} ${activeClass}`;
	if (typeof window !== "undefined" && window.location.href.startsWith(urlFragment)) return `${standardClass} ${activeClass}`;
	return standardClass;
}