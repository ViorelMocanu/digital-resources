// Page links are built from the list's first address. They were built by cutting "/<n>" out of the next page's
// address, which also cut the "/3" of a segment such as "3d-modelling".
import { expect, it } from 'vitest';
import { pageUrl } from '../src/utils/pagination';

it('keeps a path segment that starts with a digit', () => {
	expect(pageUrl('/design/3d-modelling', 3)).toBe('/design/3d-modelling/3');
});

it('gives the first page the list address itself', () => {
	expect(pageUrl('/design/3d-modelling', 1)).toBe('/design/3d-modelling');
});

it('writes no double slash after a list address that ends with one', () => {
	expect(pageUrl('/front-end/', 2)).toBe('/front-end/2');
});
