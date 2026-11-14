/**
 * The address of one page of a paginated list.
 * @param firstUrl The address of the list's first page, with or without a final slash.
 * @param page The page number, from 1.
 * @returns The list address for page 1, else the list address followed by the number.
 */
export function pageUrl(firstUrl: string, page: number): string {
	const base = firstUrl.replace(/\/$/, '');
	return page === 1 ? base || '/' : `${base}/${page}`;
}
