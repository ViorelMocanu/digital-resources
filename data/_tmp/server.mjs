import express from 'express';
import axios from 'axios';
import Papa from 'papaparse';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { SingleBar, Presets } from 'cli-progress';
import chalk from 'chalk';
import { JSDOM, ResourceLoader } from 'jsdom';
import https from 'https';

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });
const wss = new WebSocketServer({ noServer: true });

let errorCount = 0;

app.use(express.static('public'));

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getFormattedTimestamp = () => {
	const now = new Date();
	return now.toISOString().replace(/T/, '-').replace(/:/g, '-').slice(0, 16);
};

const logError = (id, url, message, errorFilePath) => {
	const timestamp = new Date().toISOString();
	const errorData = [{ id, url, error_message: message, timestamp }];
	const csv = Papa.unparse(errorData, { header: false });
	fs.appendFileSync(errorFilePath, `${csv}\n`, 'utf8');
	broadcast({ type: 'error', message: `\nError processing ${url}: ${message}` });
	errorCount++;
};

const initializeFile = (filePath, headers) => {
	const csv = Papa.unparse([headers]);
	fs.writeFileSync(filePath, csv, 'utf8');
};

const appendToCsvFile = (row, filePath) => {
	const csv = Papa.unparse([row], { header: false });
	fs.appendFileSync(filePath, `${csv}\n`, 'utf8');
};

const broadcast = (message) => {
	wss.clients.forEach(client => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(message));
		}
	});
};

const displayProgress = (processed, total, errors, currentUrl) => {
	const progressMessage = `\nLinks: ${processed}/${total} | Errors: ${errors} | Current: ${currentUrl}\n`;
	broadcast({ type: 'progress', message: progressMessage });
	console.log(progressMessage);
};

// Custom resource loader to block external resource loading
class CustomResourceLoader extends ResourceLoader {
	fetch(url, options) {
		return Promise.resolve(Buffer.from(''));
	}
}

// Metadata fetching functions
const fetchMetadataWithRetry = async (id, url, retries, errorFilePath) => {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await fetchMetadata(url, errorFilePath);
		} catch (error) {
			if (error.response) {
				const status = error.response.status;
				if (status === 403) logError(id, url, '403 Forbidden', errorFilePath);
				else if (status === 404) logError(id, url, '404 Not Found', errorFilePath);
				else if (status === 522) logError(id, url, '522 Connection Timed Out', errorFilePath);
				break;
			} else if (error.code === 'ENOTFOUND') {
				logError(id, url, 'ENOTFOUND - Domain not found', errorFilePath);
				break;
			} else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
				logError(id, url, 'Certificate verification error', errorFilePath);
				break;
			}
			if (attempt < retries) {
				console.warn(`Retry ${attempt} for ${url}`);
				await delay(2000);
			} else {
				logError(id, url, `Failed after ${retries} attempts`, errorFilePath);
				return null;
			}
		}
	}
	return null;
};

const fetchMetadata = async (url, errorFilePath) => {
	try {
		const agent = new https.Agent({
			rejectUnauthorized: false // Bypass SSL certificate validation
		});
		const response = await axios.get(url, {
			maxRedirects: 5,
			headers: { 'User-Agent': 'Mozilla/5.0' },
			maxContentLength: 100 * 1024 * 1024,
			httpsAgent: agent
		});
		if (response.headers['content-length'] && parseInt(response.headers['content-length'], 10) > 100 * 1024 * 1024) {
			logError(id, url, 'File is too large', errorFilePath);
			return null;
		}

		const dom = new JSDOM(response.data, {
			resources: new CustomResourceLoader(),
			runScripts: 'outside-only' // Disable script execution
		});
		const { document } = dom.window;

		const title = document.querySelector('title')?.textContent || '';
		const description = document.querySelector('meta[name="description"]')?.content || '';
		const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';

		return { title, description, ogImage };
	} catch (error) {
		logError(id, url, error.message, errorFilePath);
		throw error;
	}
};

// Main processing function
const processLinks = async (data, newFilePath, errorFilePath, tempFilePath) => {
	const totalLinks = data.length;
	let processedLinks = 0;

	const progressBar = new SingleBar({
		format: '\nProgress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} links processed',
		barCompleteChar: '\u2588',
		barIncompleteChar: '\u2591',
		hideCursor: true
	}, Presets.shades_classic);

	progressBar.start(totalLinks, 0);

	for (const row of data) {
		const currentUrl = row.url;
		const currentId = row.id;
		if (typeof currentUrl === 'string' && (currentUrl.endsWith('.zip') || currentUrl.endsWith('?dl=1'))) {
			logError(currentId, currentUrl, 'Skipped zip / Dropbox file', errorFilePath);
			continue;
		}

		let metadata;
		try {
			metadata = await fetchMetadataWithRetry(currentId, currentUrl, 3, errorFilePath);
		} catch {
			errorCount++;
			continue;
		}

		if (metadata) {
			row.link_url = currentUrl.replace('\_', '_');
			row.link_meta_title = metadata.title.replace(/\n/g, ' ') || '';
			row.link_meta_description = metadata.description.replace(/\n/g, ' ') || '';
			row.link_meta_ogimage = metadata.ogImage.replace(/\n/g, ' ') || '';
		} else {
			row.link_meta_title = '';
			row.link_meta_description = '';
			row.link_meta_ogimage = '';
		}

		processedLinks++;
		progressBar.update(processedLinks);
		displayProgress(processedLinks, totalLinks, errorCount, currentUrl);

		appendToCsvFile(row, newFilePath);

		await delay(2000);
	}

	progressBar.stop();
	console.log('\nProcessing complete.');
	broadcast({ type: 'complete', message: 'Processing complete.' });

	fs.unlinkSync(tempFilePath);
};

// Express routes
app.post('/upload', upload.single('file'), (req, res) => {
	const filePath = req.file.path;
	const csvData = fs.readFileSync(filePath, 'utf8');
	
	Papa.parse(csvData, {
		header: true,
		complete: results => {
			const data = results.data;
			const timestamp = getFormattedTimestamp();
			const newFilePath = `uploads/database-${timestamp}.csv`;
			const errorFilePath = `uploads/errors-${timestamp}.csv`;
			initializeFile(errorFilePath, ['id', 'url', 'error_message', 'timestamp']);
			initializeFile(newFilePath, ['id', 'url', 'link_text', 'link_meta_title', 'link_meta_description', 'link_meta_ogimage']);
			processLinks(data, newFilePath, errorFilePath, filePath);
		}
	});

	res.sendFile(path.join(path.resolve(), 'public', 'processing.html'));
});

// WebSocket setup
const server = app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}\n`);
});

server.on('upgrade', (request, socket, head) => {
	wss.handleUpgrade(request, socket, head, (ws) => {
		wss.emit('connection', ws, request);
	});
});
