// The printed date must not depend on the build machine's time zone. In its own file: a time zone set at runtime
// stays for the rest of the process, so it must not reach other tests.
import { afterEach, describe, expect, it } from 'vitest';
import { getFormattedDate } from '../src/utils/resourceMeta';

const startZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

afterEach(() => {
	// Deleting TZ does not bring the old zone back; setting it does.
	process.env['TZ'] = startZone;
});

describe.each(['UTC', 'America/New_York', 'Asia/Tokyo'])('getFormattedDate in %s', (zone) => {
	it('prints the day of a date-only string and of an instant at midnight UTC', () => {
		process.env['TZ'] = zone;
		expect(getFormattedDate('2022-01-01')).toBe('2022-01-01');
		expect(getFormattedDate(new Date('2022-01-01T00:00:00.000Z'))).toBe('2022-01-01');
	});

	// The owner's choice, open: the site prints dates in UTC.
	it('prints the UTC day of a late-evening instant', () => {
		process.env['TZ'] = zone;
		expect(getFormattedDate('2022-01-01T23:30:00Z')).toBe('2022-01-01');
	});
});
