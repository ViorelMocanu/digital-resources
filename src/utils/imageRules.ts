/**
 * Stops the build when a collection image is narrower than its rule allows.
 *
 * The collection schema carried this rule until Astro's Content Layer: there, the schema sees an image only as a
 * path, so its width is first known where the entry is used.
 * @template T
 * @param {T} image The image as the collection entry holds it.
 * @param {number} min The smallest width allowed, in pixels.
 * @param {string} message The rule, as the content author should read it.
 * @param {string} entry The collection and id of the entry, for the error message.
 * @returns {T} The same image, when it is wide enough.
 */
export function requireMinWidth<T extends { width: number }>(image: T, min: number, message: string, entry: string): T {
	if (image.width < min) throw new Error(`${entry}: ${message} (${image.width}px)`);
	return image;
}
