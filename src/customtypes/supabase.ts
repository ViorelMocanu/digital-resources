export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					avatar_url: string | null;
					first_name: string | null;
					id: string;
					last_name: string | null;
					linkedin_profile_url: string | null;
					updated_at: string | null;
					username: string | null;
					website: string | null;
				};
				Insert: {
					avatar_url?: string | null;
					first_name?: string | null;
					id: string;
					last_name?: string | null;
					linkedin_profile_url?: string | null;
					updated_at?: string | null;
					username?: string | null;
					website?: string | null;
				};
				Update: {
					avatar_url?: string | null;
					first_name?: string | null;
					id?: string;
					last_name?: string | null;
					linkedin_profile_url?: string | null;
					updated_at?: string | null;
					username?: string | null;
					website?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'profiles_id_fkey';
						columns: ['id'];
						isOneToOne: true;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			resources: {
				Row: {
					author_name: string | null;
					author_url: string | null;
					categories: Json[] | null;
					created_at: string;
					description: string | null;
					id: number;
					image_alt: string | null;
					image_url: string | null;
					language: string;
					mandatory: boolean | null;
					modified_at: string | null;
					price: number | null;
					rating: number | null;
					required_time: number | null;
					section: Json | null;
					subcategories: Json[] | null;
					tags: Json[] | null;
					title: string;
					type: string | null;
					url: string;
				};
				Insert: {
					author_name?: string | null;
					author_url?: string | null;
					categories?: Json[] | null;
					created_at?: string;
					description?: string | null;
					id?: number;
					image_alt?: string | null;
					image_url?: string | null;
					language?: string;
					mandatory?: boolean | null;
					modified_at?: string | null;
					price?: number | null;
					rating?: number | null;
					required_time?: number | null;
					section?: Json | null;
					subcategories?: Json[] | null;
					tags?: Json[] | null;
					title: string;
					type?: string | null;
					url: string;
				};
				Update: {
					author_name?: string | null;
					author_url?: string | null;
					categories?: Json[] | null;
					created_at?: string;
					description?: string | null;
					id?: number;
					image_alt?: string | null;
					image_url?: string | null;
					language?: string;
					mandatory?: boolean | null;
					modified_at?: string | null;
					price?: number | null;
					rating?: number | null;
					required_time?: number | null;
					section?: Json | null;
					subcategories?: Json[] | null;
					tags?: Json[] | null;
					title?: string;
					type?: string | null;
					url?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
