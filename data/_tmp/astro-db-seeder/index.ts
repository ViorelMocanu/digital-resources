import * as fs from 'fs';
import { createClient } from '@astrojs/db';
import csv from 'csv-parser';

interface TaxonomyRow {
	taxonomy_id: number;
	taxonomy_title: string;
	taxonomy_type: string;
	taxonomy_parent: number | null;
	slug: string;
	sort_order: number;
	taxonomy_description: string;
}

// Initialize the Astro DB client
const client = createClient({
	serviceUrl: 'https://api.astro.build/v1', // Replace with the actual API endpoint
	appToken: 'your_app_token', // Replace with your actual App Token
});

const database = client.database('your_db_name'); // Replace with your database name

fs.createReadStream('taxonomy_with_final_descriptions.csv')
	.pipe(csv())
	.on('data', async (row: TaxonomyRow) => {
		try {
			await database.insert('Taxonomy', {
				taxonomy_id: row.taxonomy_id,
				taxonomy_title: row.taxonomy_title,
				taxonomy_type: row.taxonomy_type,
				taxonomy_parent: row.taxonomy_parent,
				slug: row.slug,
				sort_order: row.sort_order,
				taxonomy_description: row.taxonomy_description,
			});
			console.log('Row inserted');
		} catch (err) {
			console.error(err);
		}
	})
	.on('end', () => {
		console.log('CSV file successfully processed');
	});
