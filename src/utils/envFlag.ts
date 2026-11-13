/**
 * Reads an environment variable as an on/off flag.
 *
 * Astro hands every environment value over as text, so `PUBLIC_APP_DEBUG=false` arrives as the string "false",
 * which JavaScript counts as true. Empty, "false" and "0" are off; anything else that is set is on.
 * @param {unknown} value The raw value from `import.meta.env`.
 * @returns {boolean} Whether the flag is on.
 */
export function envFlag(value: unknown): boolean {
	if (typeof value !== 'string') return Boolean(value);
	const text = value.trim().toLowerCase();
	return text !== '' && text !== 'false' && text !== '0';
}
