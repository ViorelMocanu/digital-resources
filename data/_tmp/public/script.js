document.getElementById('upload-csv').addEventListener('change', function (event) {
	const file = event.target.files[0];
	if (file) {
		Papa.parse(file, {
			header: true,
			complete: function (results) {
				const data = results.data;
				processLinks(data);
			},
		});
	}
});

/**
 *
 * @param data
 */
function processLinks(data) {
	data.forEach((row, index) => {
		fetchMetadata(row.url).then((metadata) => {
			console.log(`Index: ${index}`);
			console.log(`ID: ${row.id}`);
			console.log(`URL: ${row.url}`);
			console.log(`Link Text: ${row.link_text}`);
			console.log(`Meta Title: ${metadata.title}`);
			console.log(`Meta Description: ${metadata.description}`);
			console.log(`Open Graph Image: ${metadata.ogImage}`);
			console.log('-----------------------------');
		});
	});
}

/**
 *
 * @param url
 */
async function fetchMetadata(url) {
	try {
		const response = await fetch(url);
		const text = await response.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(text, 'text/html');

		const title = doc.querySelector('title') ? doc.querySelector('title').innerText : '';
		const description = doc.querySelector('meta[name="description"]') ? doc.querySelector('meta[name="description"]').getAttribute('content') : '';
		const ogImage = doc.querySelector('meta[property="og:image"]') ? doc.querySelector('meta[property="og:image"]').getAttribute('content') : '';

		return {
			title,
			description,
			ogImage,
		};
	} catch (error) {
		console.error('Error fetching metadata for URL:', url, error);
		return {
			title: '',
			description: '',
			ogImage: '',
		};
	}
}
