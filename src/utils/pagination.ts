/** One page of a paginated list, as Astro's `paginate()` gives it. */
export interface ListPage {
	currentPage: number;
	lastPage: number;
	url: {
		// Astro gives `first` from page 2 on; `current` is the first page itself on page 1.
		current: string;
		first?: string | undefined;
		next?: string;
		prev?: string;
	};
}

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
