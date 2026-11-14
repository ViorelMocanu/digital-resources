// Plain `tsc` (the second half of `pnpm typecheck`) cannot read `.astro` files: only `astro check` and the editor plugin
// can, and Astro 7 ships no declaration for them. A unit test that renders a component through the container API
// imports one, so the import gets the type that the container's `renderToString` takes.
declare module '*.astro' {
	const component: Parameters<import('astro/container').experimental_AstroContainer['renderToString']>[0];
	export default component;
}
