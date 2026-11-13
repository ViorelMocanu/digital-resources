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

test('the rule names the minimum it was given', () => {
	expect(() => requireMinWidth({ width: 99 }, 100, 'sections/a')).toThrow('sections/a: Imaginea trebuie să aibă minim 100px lățime! (99px)');
});
