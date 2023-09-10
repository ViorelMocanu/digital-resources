import Astro from 'astro';

export function urlBaseClass(urlFragment: string, activeClass: string): string {
	if (Astro.request.url.startsWith(urlFragment)) {
		return activeClass
	}
	return ''
}