// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly OAUTH_GOOGLE_CALLBACK_URL: string;
	readonly PUBLIC_SUPABASE_URL: string;
	readonly PUBLIC_SUPABASE_ANON_KEY: string;
	readonly PUBLIC_APP_ENV: string;
	readonly PUBLIC_APP_DEBUG: boolean;
	readonly PUBLIC_APP_URL_LOCAL: string;
	readonly PUBLIC_APP_URL_STAGING: string;
	readonly PUBLIC_APP_URL_PRODUCTION: string;
	readonly CLARITY_ID: string;
	readonly PIWIK_ID: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
