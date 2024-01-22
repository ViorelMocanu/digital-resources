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
					category: number | null;
					created_at: string;
					description: string | null;
					id: number;
					image: string | null;
					image_alt: string | null;
					language: string;
					modified_at: string | null;
					price: number | null;
					rating: number | null;
					required_time: number | null;
					section: number | null;
					slug: string | null;
					subcategory: number | null;
					title: string;
					type: number | null;
					url: string;
				};
				Insert: {
					author_name?: string | null;
					author_url?: string | null;
					category?: number | null;
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					image_alt?: string | null;
					language?: string;
					modified_at?: string | null;
					price?: number | null;
					rating?: number | null;
					required_time?: number | null;
					section?: number | null;
					slug?: string | null;
					subcategory?: number | null;
					title: string;
					type?: number | null;
					url: string;
				};
				Update: {
					author_name?: string | null;
					author_url?: string | null;
					category?: number | null;
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					image_alt?: string | null;
					language?: string;
					modified_at?: string | null;
					price?: number | null;
					rating?: number | null;
					required_time?: number | null;
					section?: number | null;
					slug?: string | null;
					subcategory?: number | null;
					title?: string;
					type?: number | null;
					url?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'resources_category_fkey';
						columns: ['category'];
						isOneToOne: false;
						referencedRelation: 'taxonomy';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'resources_section_fkey';
						columns: ['section'];
						isOneToOne: false;
						referencedRelation: 'taxonomy';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'resources_subcategory_fkey';
						columns: ['subcategory'];
						isOneToOne: false;
						referencedRelation: 'taxonomy';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'resources_type_fkey';
						columns: ['type'];
						isOneToOne: false;
						referencedRelation: 'tags';
						referencedColumns: ['id'];
					},
				];
			};
			resources_tags: {
				Row: {
					created_at: string;
					id: number;
					modified_at: string | null;
					resource_id: number;
					tag_id: number;
				};
				Insert: {
					created_at?: string;
					id?: number;
					modified_at?: string | null;
					resource_id: number;
					tag_id: number;
				};
				Update: {
					created_at?: string;
					id?: number;
					modified_at?: string | null;
					resource_id?: number;
					tag_id?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'resources_tags_resource_id_fkey';
						columns: ['resource_id'];
						isOneToOne: false;
						referencedRelation: 'resources';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'resources_tags_tag_id_fkey';
						columns: ['tag_id'];
						isOneToOne: false;
						referencedRelation: 'tags';
						referencedColumns: ['id'];
					},
				];
			};
			tags: {
				Row: {
					created_at: string;
					description: string | null;
					id: number;
					image: string | null;
					modified_at: string | null;
					slug: string | null;
					title: string;
					type: number;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					modified_at?: string | null;
					slug?: string | null;
					title: string;
					type: number;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					modified_at?: string | null;
					slug?: string | null;
					title?: string;
					type?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'tags_type_fkey';
						columns: ['type'];
						isOneToOne: false;
						referencedRelation: 'tags_types';
						referencedColumns: ['id'];
					},
				];
			};
			tags_types: {
				Row: {
					created_at: string;
					description: string | null;
					id: number;
					image: string | null;
					modified_at: string | null;
					slug: string | null;
					title: string;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					modified_at?: string | null;
					slug?: string | null;
					title: string;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					modified_at?: string | null;
					slug?: string | null;
					title?: string;
				};
				Relationships: [];
			};
			taxonomy: {
				Row: {
					created_at: string;
					description: string | null;
					id: number;
					image: string | null;
					image_alt: string | null;
					menu: string;
					modified_at: string | null;
					parent: number | null;
					slug: string | null;
					sort_order: number;
					title: string;
					type: number;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					image_alt?: string | null;
					menu: string;
					modified_at?: string | null;
					parent?: number | null;
					slug?: string | null;
					sort_order?: number;
					title: string;
					type: number;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					id?: number;
					image?: string | null;
					image_alt?: string | null;
					menu?: string;
					modified_at?: string | null;
					parent?: number | null;
					slug?: string | null;
					sort_order?: number;
					title?: string;
					type?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'taxonomy_parent_fkey';
						columns: ['parent'];
						isOneToOne: false;
						referencedRelation: 'taxonomy';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'taxonomy_type_fkey';
						columns: ['type'];
						isOneToOne: false;
						referencedRelation: 'taxonomy_types';
						referencedColumns: ['id'];
					},
				];
			};
			taxonomy_types: {
				Row: {
					id: number;
					title: string;
				};
				Insert: {
					id?: number;
					title: string;
				};
				Update: {
					id?: number;
					title?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			slugify: {
				Args: {
					value: string;
				};
				Returns: string;
			};
			unaccent: {
				Args: {
					'': string;
				};
				Returns: string;
			};
			unaccent_init: {
				Args: {
					'': unknown;
				};
				Returns: unknown;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
}
