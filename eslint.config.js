import * as astroParser from 'astro-eslint-parser';
import a11y from 'eslint-plugin-jsx-a11y';
import astro from 'eslint-plugin-astro';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

const ignoreArray = [
	'.astro/**',
	'.cache/**',
	'.github/**',
	'.idea/**',
	'.netlify/**',
	'.vercel/**',
	'/.vercel/**',
	'build/**',
	'coverage/**',
	'demo/**',
	'dev-dist/**',
	'dist/**',
	'node_modules/**',
	'tmp/**',
	'test-results/**',
	'playwright-report/**',
	'static/**',
	'src/env.d.ts',
];

const parserOptions = {
	ecmaFeatures: { modules: true },
	ecmaVersion: 'latest',
};

// The rules every linted file shares: scripts, TypeScript and the script part of Astro components.
const sharedRules = {
	'indent': ['error', 'tab', { SwitchCase: 1 }],
	'linebreak-style': ['error', 'unix'],
	'brace-style': ['error', '1tbs', { allowSingleLine: true }],
	'sort-imports': 'warn',
	'key-spacing': ['error', { beforeColon: false, afterColon: true }],
	'keyword-spacing': ['error', { before: true, after: true }],
	'no-console': 'warn',
	'no-dupe-args': 'error',
	'no-duplicate-imports': 'error',
	'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
	'no-unexpected-multiline': 'error',
	'object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
	'semi': ['warn', 'always', { omitLastInOneLineBlock: true }],
	'semi-style': ['error', 'last'],
	'semi-spacing': ['error', { before: false, after: true }],
	'space-before-blocks': 'error',
	'space-in-parens': ['warn', 'never'],
	'template-curly-spacing': 'warn',
	'wrap-regex': 'warn',
	'jsdoc/require-description': 'warn',
};

export default [
	{
		files: ['**/*.js', '**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions,
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			jsdoc,
		},
		rules: {
			...tseslint.plugin.configs['recommended'].rules,
			...jsdoc.configs['flat/recommended'].rules,
			...sharedRules,
		},
	},
	{
		files: ['**/*.astro'],
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tseslint.parser,
				...parserOptions,
			},
		},
		plugins: {
			astro,
			a11y,
			jsdoc,
		},
		rules: {
			'astro/no-conflict-set-directives': 'error',
			'astro/no-deprecated-astro-canonicalurl': 'error',
			'astro/no-deprecated-astro-fetchcontent': 'error',
			'astro/no-deprecated-astro-resolve': 'error',
			'astro/no-deprecated-getentrybyslug': 'error',
			'astro/no-unused-define-vars-in-style': 'error',
			'astro/no-set-html-directive': 'error',
			'astro/no-set-text-directive': 'error',
			'astro/prefer-class-list-directive': 'warn',
			'astro/prefer-object-class-list': 'warn',
			'astro/prefer-split-class-list': 'warn',
			'astro/jsx-a11y/alt-text': 'error',
			'astro/jsx-a11y/anchor-ambiguous-text': 'warn',
			'astro/jsx-a11y/anchor-has-content': 'error',
			'astro/jsx-a11y/anchor-is-valid': 'warn',
			'astro/jsx-a11y/aria-activedescendant-has-tabindex': 'warn',
			'astro/jsx-a11y/aria-props': 'error',
			'astro/jsx-a11y/aria-proptypes': 'error',
			'astro/jsx-a11y/aria-role': 'error',
			'astro/jsx-a11y/aria-unsupported-elements': 'error',
			'astro/jsx-a11y/autocomplete-valid': 'warn',
			'astro/jsx-a11y/control-has-associated-label': 'warn',
			'astro/jsx-a11y/heading-has-content': 'error',
			'astro/jsx-a11y/html-has-lang': 'error',
			'astro/jsx-a11y/iframe-has-title': 'error',
			'astro/jsx-a11y/img-redundant-alt': 'warn',
			'astro/jsx-a11y/interactive-supports-focus': 'warn',
			'astro/jsx-a11y/label-has-associated-control': 'warn',
			'astro/jsx-a11y/lang': 'error',
			'astro/jsx-a11y/media-has-caption': 'warn',
			'astro/jsx-a11y/no-access-key': 'warn',
			'astro/jsx-a11y/no-aria-hidden-on-focusable': 'warn',
			'astro/jsx-a11y/no-autofocus': 'warn',
			'astro/jsx-a11y/no-distracting-elements': 'error',
			'astro/jsx-a11y/no-interactive-element-to-noninteractive-role': 'warn',
			'astro/jsx-a11y/no-noninteractive-element-interactions': 'warn',
			'astro/jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
			'astro/jsx-a11y/no-noninteractive-tabindex': 'warn',
			'astro/jsx-a11y/no-redundant-roles': 'warn',
			'astro/jsx-a11y/prefer-tag-over-role': 'error',
			'astro/jsx-a11y/role-has-required-aria-props': 'error',
			'astro/jsx-a11y/role-supports-aria-props': 'warn',
			'astro/jsx-a11y/scope': 'warn',
			'astro/jsx-a11y/tabindex-no-positive': 'warn',
			...sharedRules,
		},
	},
	{
		// In TypeScript the types live in the signatures, where the compiler checks them; a second copy in JSDoc is not checked.
		files: ['**/*.ts'],
		rules: {
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns-type': 'off',
		},
	},
	{
		// Harness scripts and end-to-end tests are run by Node: their regular expressions are written unwrapped, and a
		// command-line script prints its result.
		files: ['scripts/**/*.ts', 'e2e/**/*.ts', 'playwright.config.ts'],
		rules: {
			'wrap-regex': 'off',
			'no-console': 'off',
		},
	},
	{
		ignores: [...ignoreArray],
	},
];
