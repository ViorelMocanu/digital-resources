import a11y from "eslint-plugin-jsx-a11y";
import astro from "eslint-plugin-astro";
import astroParser from "astro-eslint-parser";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{
		files: ["**/*.js"],
		ignores: [
			".astro/**",
			".cache/**",
			".github/**",
			".idea/**",
			".netlify/**",
			".vercel/**",
			"build/**",
			"coverage/**",
			"dev-dist/**",
			"dist/**",
			"node_modules/**",
			"static/**",
		],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: { modules: true },
				ecmaVersion: "latest",
			},
		},
		plugins: {
			"@typescript-eslint": ts,
			ts
		},
		rules: {
			...ts.configs["eslint-recommended"].rules,
			...ts.configs["recommended"].rules,
			"indent": ["error", "tab", {"SwitchCase": 1}],
			"linebreak-style": ["error", "unix"],
			"brace-style": ["error", "1tbs", { "allowSingleLine": true }],
			"sort-imports": "warn",
			"key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
			"keyword-spacing": ["error", { "before": true, "after": true }],
			"no-console": "warn",
			"no-dupe-args": "error",
			"no-duplicate-imports": "error",
			"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
			"no-unexpected-multiline": "error",
			"object-property-newline": ["error", { "allowAllPropertiesOnSameLine": true }],
			"semi": ["warn", "always", { "omitLastInOneLineBlock": true }],
			"semi-style": ["error", "last"],
			"semi-spacing": ["error", { "before": false, "after": true }],
			"space-before-blocks": "error",
			"space-before-function-paren": "warn",
			"space-in-parens": ["warn", "never"],
			"template-curly-spacing": "warn",
			"wrap-regex": "warn"
		}
	},
	{
		files: ["**/*.ts"],
		ignores: [
			".astro/**",
			".cache/**",
			".github/**",
			".idea/**",
			".netlify/**",
			".vercel/**",
			"build/**",
			"coverage/**",
			"dist/**",
			"dev-dist/**",
			"node_modules/**",
			"src/env.d.ts",
		],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: { modules: true },
				ecmaVersion: "latest",
			},
		},
		plugins: {
			"@typescript-eslint": ts,
			ts,
		},
		rules: {
			...ts.configs["eslint-recommended"].rules,
			...ts.configs["recommended"].rules,
			"indent": ["error", "tab", {"SwitchCase": 1}],
			"linebreak-style": ["error", "unix"],
			"brace-style": ["error", "1tbs", { "allowSingleLine": true }],
			"sort-imports": "warn",
			"key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
			"keyword-spacing": ["error", { "before": true, "after": true }],
			"no-console": "warn",
			"no-dupe-args": "error",
			"no-duplicate-imports": "error",
			"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
			"no-unexpected-multiline": "error",
			"object-property-newline": ["error", { "allowAllPropertiesOnSameLine": true }],
			"semi": ["warn", "always", { "omitLastInOneLineBlock": true }],
			"semi-style": ["error", "last"],
			"semi-spacing": ["error", { "before": false, "after": true }],
			"space-before-blocks": "error",
			"space-before-function-paren": "warn",
			"space-in-parens": ["warn", "never"],
			"template-curly-spacing": "warn",
			"wrap-regex": "warn"
		}
	},
	{
		files: ["**/*.astro"],
		ignores: [
			".astro/**",
			".cache/**",
			".github/**",
			".idea/**",
			".netlify/**",
			".vercel/**",
			"build/**",
			"coverage/**",
			"dist/**",
			"dev-dist/**",
			"node_modules/**",
		],
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tsParser,
				ecmaFeatures: { modules: true },
				ecmaVersion: "latest",
			},
		},
		plugins: {
			astro,
			a11y
		},
		rules: {
			"indent": ["error", "tab", {"SwitchCase": 1}],
			"linebreak-style": ["error", "unix"],
			"astro/no-conflict-set-directives": "error",
			"astro/no-deprecated-astro-canonicalurl": "error",
			"astro/no-deprecated-astro-fetchcontent": "error",
			"astro/no-deprecated-astro-resolve": "error",
			"astro/no-deprecated-getentrybyslug": "error",
			"astro/no-unused-define-vars-in-style": "error",
			"astro/no-set-html-directive": "error",
			"astro/no-set-text-directive": "error",
			"astro/prefer-class-list-directive": "warn",
			"astro/prefer-object-class-list": "warn",
			"astro/prefer-split-class-list": "warn",
			"astro/jsx-a11y/alt-text": "error",
			"astro/jsx-a11y/anchor-ambiguous-text": "warn",
			"astro/jsx-a11y/anchor-has-content": "error",
			"astro/jsx-a11y/anchor-is-valid": "warn",
			"astro/jsx-a11y/aria-activedescendant-has-tabindex": "warn",
			"astro/jsx-a11y/aria-props": "error",
			"astro/jsx-a11y/aria-proptypes": "error",
			"astro/jsx-a11y/aria-role": "error",
			"astro/jsx-a11y/aria-unsupported-elements": "error",
			"astro/jsx-a11y/autocomplete-valid": "warn",
			"astro/jsx-a11y/control-has-associated-label": "warn",
			"astro/jsx-a11y/heading-has-content": "error",
			"astro/jsx-a11y/html-has-lang": "error",
			"astro/jsx-a11y/iframe-has-title": "error",
			"astro/jsx-a11y/img-redundant-alt": "warn",
			"astro/jsx-a11y/interactive-supports-focus": "warn",
			"astro/jsx-a11y/label-has-associated-control": "warn",
			"astro/jsx-a11y/lang": "error",
			"astro/jsx-a11y/media-has-caption": "warn",
			"astro/jsx-a11y/no-access-key": "warn",
			"astro/jsx-a11y/no-aria-hidden-on-focusable": "warn",
			"astro/jsx-a11y/no-autofocus": "warn",
			"astro/jsx-a11y/no-distracting-elements": "error",
			"astro/jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",
			"astro/jsx-a11y/no-noninteractive-element-interactions": "warn",
			"astro/jsx-a11y/no-noninteractive-element-to-interactive-role": "warn",
			"astro/jsx-a11y/no-noninteractive-tabindex": "warn",
			"astro/jsx-a11y/no-redundant-roles": "warn",
			"astro/jsx-a11y/prefer-tag-over-role": "error",
			"astro/jsx-a11y/role-has-required-aria-props": "error",
			"astro/jsx-a11y/role-supports-aria-props": "warn",
			"astro/jsx-a11y/scope": "warn",
			"astro/jsx-a11y/tabindex-no-positive": "warn",
			"brace-style": ["error", "1tbs", { "allowSingleLine": true }],
			"sort-imports": "warn",
			"key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
			"keyword-spacing": ["error", { "before": true, "after": true }],
			"no-console": "warn",
			"no-dupe-args": "error",
			"no-duplicate-imports": "error",
			"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
			"no-unexpected-multiline": "error",
			"object-property-newline": ["error", { "allowAllPropertiesOnSameLine": true }],
			"semi": ["warn", "always", { "omitLastInOneLineBlock": true }],
			"semi-style": ["error", "last"],
			"semi-spacing": ["error", { "before": false, "after": true }],
			"space-before-blocks": "error",
			"space-before-function-paren": "warn",
			"space-in-parens": ["warn", "never"],
			"template-curly-spacing": "warn",
			"wrap-regex": "warn"
		}
	}
];
