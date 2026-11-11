/**
 * `import.meta.main` (Node 24.2 and later) is true in the file Node was started with. The Node type package this
 * repository installs predates it; remove this declaration once that package declares the property itself.
 */
interface ImportMeta {
	readonly main: boolean;
}
