import { expect, test } from 'vitest';
import { requireMinWidth } from '../src/utils/imageRules';

test('an image at the minimum width passes', () => {
	const image = { src: '/a.png', width: 1000, height: 500 };
	expect(() => requireMinWidth(image, 1000, 'resources/a')).not.toThrow();
});

test('a narrower image stops the build with the rule and the entry it belongs to', () => {
	const image = { src: '/a.png', width: 999, height: 500 };
	expect(() => requireMinWidth(image, 1000, 'resources/a')).toThrow('resources/a: Imaginea trebuie să aibă minim 1000px lățime! (999px)');
});

// Astro keeps the plain text of an image it could not resolve (a remote address, a file that is not an image), and
// `undefined < 1000` is false: the rule passed in silence.
test('an image Astro could not resolve stops the build, naming the entry and the value', () => {
	expect(() => requireMinWidth('https://x.ro/a.jpg' as never, 1000, 'resources/a')).toThrow('resources/a: Imaginea nu a putut fi citită (https://x.ro/a.jpg)');
	expect(() => requireMinWidth(undefined as never, 1000, 'resources/a')).toThrow('resources/a: Imaginea nu a putut fi citită (undefined)');
});

// Section images are SVG files, which Astro gives as a component with the image's size on it.
test('an SVG component with its size passes', () => {
	expect(() =>
		requireMinWidth(
			Object.assign(() => '', { width: 288, height: 120 }),
			100,
			'sections/a'
		)
	).not.toThrow();
});

test('the rule names the minimum it was given', () => {
	expect(() => requireMinWidth({ width: 99 }, 100, 'sections/a')).toThrow('sections/a: Imaginea trebuie să aibă minim 100px lățime! (99px)');
});
