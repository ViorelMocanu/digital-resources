module.exports = {
	extends: [
		"plugin:astro/recommended",
	],
	overrides: [
		{
			files: ["*.astro"],
			plugins: ["astro"],
			env: {
				// Enables global variables available in Astro components.
				node: true,
				"astro/astro": true,
				es2020: true,
			},
			parser: "astro-eslint-parser",
			// Parse the script in `.astro` as TypeScript by adding the following configuration.
			// It's the setting you need when using TypeScript.
			parserOptions: {
				parser: "@typescript-eslint/parser",
				extraFileExtensions: [".astro"],
			},
			rules: {
				// override/add rules settings here, such as:
				// "astro/no-set-html-directive": "error"
				"astro/no-conflict-set-directives": "error",
				"astro/no-unused-define-vars-in-style": "error",
			},
		},
	],
}