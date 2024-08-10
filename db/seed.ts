import * as fs from 'fs';
import { Author, Like, LikeTest, NOW, Rating, Resource, TagType, Taxonomy, TaxonomyType, User, Visits, db } from 'astro:db';
import { createSlug } from '../src/utils/urlHelpers';
import csv from 'csv-parser';

/**
 * Asynchronously inserts a new row into the Taxonomy table.
 * @param {Taxonomy.$inferInsert} row The row data to be inserted, following the structure of the Taxonomy table.
 * @returns {Promise<void>} A promise that resolves once the insertion is completed.
 */
async function insertTaxonomyRow(row: typeof Taxonomy.$inferInsert): Promise<void> {
	try {
		await db.insert(Taxonomy).values(row).run();
	} catch (err) {
		if (err instanceof Error) {
			throw new Error(`Error inserting Taxonomy row with ID ${row.id}: ${err.message}`);
		}
		throw err;
	}
}

/**
 * Asynchronously inserts a new row into the Resource table.
 * @param {Resource.$inferInsert} row The row data to be inserted, following the structure of the Resource table.
 * @returns {Promise<void>} A promise that resolves once the insertion is completed.
 */
async function insertResourceRow(row: typeof Resource.$inferInsert): Promise<void> {
	try {
		await db.insert(Resource).values(row).run();
	} catch (err) {
		if (err instanceof Error) {
			throw new Error(`Error inserting Resource row with ID ${row.id}: ${err.message}`);
		}
		throw err;
	}
}

/**
 *
 */
export default async function seed() {
	console.info('Seeding AstroDB database...');

	await db
		.insert(Author)
		.values([
			{
				id: 1,
				name: 'Viorel Mocanu',
				slug: 'viorel-mocanu',
				url: 'https://resurse.dev/',
				created_at: NOW,
				modified_at: NOW,
			},
			{
				id: 2,
				name: 'Costică Puntaru',
				slug: 'costica-puntaru',
				url: '',
				created_at: NOW,
				modified_at: NOW,
			},
		])
		.then(() => console.info('Author seeded'));

	await db
		.insert(TaxonomyType)
		.values([
			{
				id: 1,
				created_at: NOW,
				modified_at: NOW,
				title: 'Section',
			},
			{
				id: 2,
				created_at: NOW,
				modified_at: NOW,
				title: 'Category',
			},
			{
				id: 3,
				created_at: NOW,
				modified_at: NOW,
				title: 'Subcategory',
			},
		])
		.then(() => console.info('TaxonomyType seeded'));

	await db
		.insert(Taxonomy)
		.values([
			{
				id: 999999,
				title: 'TaxTest',
				title_en: 'TestTax',
				slug: 'test',
				description: 'Taxonomie de test.',
				description_en: 'Test taxonomy.',
				type: 1,
				parent: null,
				menu: 'TaxTest',
				menu_en: 'TestTax',
				sort_order: 999999,
				image: '',
				image_alt: '',
				created_at: NOW,
				modified_at: NOW,
			},
			{
				id: 999998,
				title: 'CatTest2',
				title_en: 'TestCat2',
				slug: 'test2',
				description: 'Taxonomie de test.',
				description_en: 'Test taxonomy.',
				type: 2,
				parent: 999999,
				menu: 'CatTest',
				menu_en: 'TestCat',
				sort_order: 999998,
				image: '',
				image_alt: '',
				created_at: NOW,
				modified_at: NOW,
			},
			{
				id: 999997,
				title: 'SubcatTest3',
				title_en: 'TestSubcat3',
				slug: 'test3',
				description: 'Taxonomie de test.',
				description_en: 'Test taxonomy.',
				type: 3,
				parent: 999998,
				menu: 'SubcatTest',
				menu_en: 'TestSubcat',
				sort_order: 999997,
				image: '',
				image_alt: '',
				created_at: NOW,
				modified_at: NOW,
			},
		])
		.then(() => console.info('Taxonomy pre-seeded'));

	await db
		.insert(User)
		.values([
			{
				id: 1,
				name: 'Viorel Mocanu',
				username: 'Viorel',
				slug: 'viorel-mocanu',
				email: 'resurse@viorelmocanu.ro',
				url: 'https://www.viorelmocanu.ro/',
				avatar: '',
				github: 'https://github.com/ViorelMocanu',
				created_at: NOW,
				modified_at: NOW,
			},
		])
		.then(() => console.info('User seeded'));

	await db
		.insert(Resource)
		.values([
			{
				id: 999999,
				title: 'Un Test',
				title_en: 'A Test',
				slug: 'test',
				url: 'https://resurse.dev/',
				language: 'ro',
				description: 'Un site de test.',
				description_en: 'A test site.',
				author_id: 1,
				type: 'course',
				price: 0,
				required_time: 60,
				image: '',
				image_alt: '',
				taxonomy_id: 999997,
				created_at: NOW,
				modified_at: NOW,
			},
			{
				id: 999998,
				title: 'Nivel 2',
				title_en: 'Level 2',
				slug: 'nivel-2',
				url: 'https://resurse.dev/test',
				language: 'en',
				description: 'Un site de test 2.',
				description_en: 'A test site 2.',
				author_id: 2,
				type: 'video',
				price: 0,
				required_time: 60,
				image: '',
				image_alt: '',
				taxonomy_id: 999997,
				created_at: NOW,
				modified_at: NOW,
			},
		])
		.then(() => console.info('Resource pre-seeded'));

	let data: Array<typeof Taxonomy.$inferInsert> = [];

	fs.createReadStream('./data/taxonomies.csv')
		.pipe(csv())
		.on('data', (row: typeof Taxonomy.$inferInsert) => {
			let r = row as typeof Taxonomy.$inferInsert;
			r.slug = !!row.slug ? row.slug : createSlug(row.title.toLowerCase());
			data.push(r);
		})
		.on('end', async () => {
			// Sort data by type to ensure sections and categories are inserted before subcategories
			data.sort((a, b) => {
				if (a.type === 1 && b.type !== 1) return -1;
				if (a.type === 2 && b.type === 3) return -1;
				return 1;
			});

			// Insert data in the correct order
			let count = 0;
			for (const row of data) {
				await insertTaxonomyRow(row).then(() => {
					// let separator = (parseInt(`${row.type}`) === 1) ? '├── ' : (parseInt(`${row.type}`) === 2) ? '├───┼─ ' : '│   ├──── ';
					// console.log(`${separator} ${row.slug} ` + "\x1b[2m%s\x1b[0m", `(id: ${row.id}, type: ${row.type})`);
					count++;
				});
			}
			console.info('Taxonomy CSV file successfully processed. ' + '\x1b[32m%s\x1b[0m', `${count} taxonomies processed.`);
		});

	const resource_data: Array<typeof Resource.$inferInsert> = [];

	fs.createReadStream('./data/resources.csv')
		.pipe(csv())
		.on('data', (row: typeof Resource.$inferInsert) => {
			let r = row as typeof Resource.$inferInsert;
			r.slug = !!row.slug ? row.slug : createSlug(row.title.toLowerCase());
			resource_data.push(r);
		})
		.on('end', async () => {
			// Insert data
			let count = 0;
			for (const row of resource_data) {
				await insertResourceRow(row).then(() => {
					// let separator = (parseInt(`${row.type}`) === 1) ? '├── ' : (parseInt(`${row.type}`) === 2) ? '├───┼─ ' : '│   ├──── ';
					// console.log(`${separator} ${row.slug} ` + "\x1b[2m%s\x1b[0m", `(id: ${row.id}, type: ${row.type})`);
					count++;
				});
			}
			console.info('Resource CSV file successfully processed. ' + '\x1b[32m%s\x1b[0m', `${count} resources processed.`);
		});

	await db
		.insert(LikeTest)
		.values([
			{ id: 1, likes: 1 },
			{ id: 2, likes: 2 },
		])
		.then(() => console.info('LikeTest seeded'));

	await db
		.insert(Like)
		.values([
			{ id: 1, resource_id: 999999, user_id: 1 },
			{ id: 2, resource_id: 999998, user_id: 1 },
		])
		.then(() => console.info('Like seeded'));

	await db
		.insert(TagType)
		.values([
			{
				id: 1,
				created_at: NOW,
				modified_at: NOW,
				title: 'Nivel',
				slug: 'nivel',
				description: '',
				image: '',
				image_alt: '',
			},
			{
				id: 2,
				created_at: NOW,
				modified_at: NOW,
				title: 'Tip',
				slug: 'tip',
				description: '',
				image: '',
				image_alt: '',
			},
			{
				id: 3,
				created_at: NOW,
				modified_at: NOW,
				title: 'Preț',
				slug: 'pret',
				description: '',
				image: '',
				image_alt: '',
			},
			{
				id: 4,
				created_at: NOW,
				modified_at: NOW,
				title: 'Obligatoriu',
				slug: 'obligatoriu',
				description: '',
				image: '',
				image_alt: '',
			},
		])
		.then(() => console.info('TagType seeded'));

	await db
		.insert(Rating)
		.values([
			{ id: 1, resource_id: 999999, rating: 5, user_id: 1 },
			{ id: 2, resource_id: 999998, rating: 4, user_id: 1 },
		])
		.then(() => console.info('Rating seeded'));

	await db
		.insert(Visits)
		.values({
			page_slug: '/',
			pagination: 1,
			visitor_logged_in: false,
			visitor_user_id: null,
			visitor_ip_hash: '30963a87dd481e4366237ed9cb37f001e24bcb865833be0036f7f081176b9812',
			visitor_user_agent_hash: 'c08ae1ccbe7296f4d6589acb026c5a0379bb07f1915cca8829d4cead13211e26',
			visitor_count: 10,
		})
		.then(() => console.info('Visits seeded'));
}
