import type { APIRoute } from 'astro';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const formData = await request.formData();
	const email = formData.get('email')?.toString();
	const password = formData.get('password')?.toString();
	const provider = formData.get('provider')?.toString() as Provider;

	if (provider) {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: 'http://localhost:4321/api/auth/callback',
			},
		});

		if (error) {
			return new Response(error.message, { status: 500 });
		}

		return redirect(data.url);
	}

	if (!email || !password) {
		return new Response('E nevoie de email și parolă pentru înregistrare', { status: 400 });
	}

	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return new Response(error.message, { status: 500 });
	}

	const { access_token, refresh_token } = data.session;
	cookies.set('sb-access-token', access_token, {
		path: '/',
	});
	cookies.set('sb-refresh-token', refresh_token, {
		path: '/',
	});
	return redirect('/dashboard');
};
