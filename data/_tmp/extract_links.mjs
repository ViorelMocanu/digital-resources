import fs from 'fs';
import Papa from 'papaparse';
import markdownLinkExtractor from 'markdown-link-extractor';

const MARKDOWN_FILE_PATH = './path/to/your/markdown.md'; // Replace with the path to your Markdown file
const CSV_FILE_PATH = './downloads/Deduplicated_Links.csv'; // Path to save the deduplicated CSV file

function extractLinksFromMarkdown(filePath) {
	const markdownContent = fs.readFileSync(filePath, 'utf8');
	const links = markdownLinkExtractor(markdownContent, true);
	return links.map(link => ({
		url: link.href,
		text: link.text || link.href,
	}));
}

function deduplicateLinks(links) {
	const deduplicated = {};
	links.forEach(link => {
		if (deduplicated[link.url]) {
			deduplicated[link.url].text += ` | ${link.text}`;
		} else {
			deduplicated[link.url] = { url: link.url, text: link.text };
		}
	});
	return Object.values(deduplicated);
}

function convertLinksToCSV(links, filePath) {
	const data = links.map((link, index) => ({
		id: index + 1,
		url: link.url,
		link_text: link.text,
		link_meta_title: '',
		link_meta_description: '',
		link_meta_ogimage: '',
	}));
	const csv = Papa.unparse(data);
	fs.writeFileSync(filePath, csv, 'utf8');
}

(async () => {
	try {
		console.log('Extracting links from Markdown file...');
		const links = extractLinksFromMarkdown(MARKDOWN_FILE_PATH);
		console.log(`Extracted ${links.length} links. Deduplicating...`);
		const deduplicatedLinks = deduplicateLinks(links);
		console.log(`Deduplicated to ${deduplicatedLinks.length} unique links. Converting to CSV...`);
		convertLinksToCSV(deduplicatedLinks, CSV_FILE_PATH);
		console.log(`Links extracted, deduplicated, and saved to ${CSV_FILE_PATH}`);
	} catch (error) {
		console.error('Error processing the Markdown file:', error);
	}
})();
