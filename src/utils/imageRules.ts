/**
 * Stops the build when a collection image is narrower than its rule allows.
 *
 * The collection schema carried this rule until Astro's Content Layer: there, the schema sees an image only as a
 * path, so its width is first known where the entry is used.
 * An image Astro could not resolve arrives as its plain text, without a width; that stops the build too.
 * @param {object} image The image as the collection entry holds it.
 * @param {number} image.width Its width, in pixels.
 * @param {number} min The smallest width allowed, in pixels.
 * @param {string} entry The collection and id of the entry, for the error message.
 */
export function requireMinWidth(image: { width: number }, min: number, entry: string): void {
	const width: unknown = (image as { width?: unknown } | null | undefined)?.width;
	if (typeof width !== 'number') throw new Error(`${entry}: Imaginea nu a putut fi citită (${String(image)})`);
	if (width < min) throw new Error(`${entry}: Imaginea trebuie să aibă minim ${min}px lățime! (${width}px)`);
}
