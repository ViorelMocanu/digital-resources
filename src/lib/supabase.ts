// docs: https://supabase.com/docs/guides/api/rest/generating-types
import type { Database } from '@customtypes/supabase';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient<Database>(
	import.meta.env.SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
	import.meta.env.SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
