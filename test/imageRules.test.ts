import { expect, test } from 'vitest';
import { requireMinWidth } from '../src/utils/imageRules';

test('an image at the minimum width is returned as it is', () => {
	const image = { src: '/a.png', width: 1000, height: 500 };
	expect(requireMinWidth(image, 1000, 'Imaginea trebuie să aibă minim 1000px lățime!', 'resources/a')).toBe(image);
});

test('a narrower image stops the build with the rule and the entry it belongs to', () => {
	const image = { src: '/a.png', width: 999, height: 500 };
	expect(() => requireMinWidth(image, 1000, 'Imaginea trebuie să aibă minim 1000px lățime!', 'resources/a')).toThrow(
		'resources/a: Imaginea trebuie să aibă minim 1000px lățime! (999px)'
	);
});
