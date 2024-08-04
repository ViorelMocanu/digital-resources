declare module 'csv-parser' {
	import { Writable } from 'stream';

	interface Options {
		separator?: string;
		newline?: string;
		quote?: string;
		escape?: string;
		headers?: boolean | string[];
		mapHeaders?: ({ header, index }: { header: string; index: number }) => string | null;
		mapValues?: ({ header, index, value }: { header: string; index: number; value: string }) => string;
		skipLines?: number;
		maxRowBytes?: number;
		strict?: boolean;
	}

	interface CsvParserStream extends Writable {
		on(event: 'data', listener: (data) => void): this;
		on(event: 'end', listener: () => void): this;
		on(event: 'error', listener: (err: Error) => void): this;
	}

	function csvParser(options?: Options): CsvParserStream;

	export = csvParser;
}
