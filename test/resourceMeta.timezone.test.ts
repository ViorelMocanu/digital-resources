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

	// The owner's choice of 2026-11-15: the site prints the day as it is in Bucharest (Europe/Bucharest: EET, UTC+2,
	// in winter and EEST, UTC+3, in summer), whatever the build machine's zone.
	it('prints the Bucharest day of a late-evening instant in winter, at UTC+2', () => {
		process.env['TZ'] = zone;
		expect(getFormattedDate('2022-01-01T21:59:00Z')).toBe('2022-01-01');
		expect(getFormattedDate('2022-01-01T22:00:00Z')).toBe('2022-01-02');
		expect(getFormattedDate('2022-01-01T23:30:00Z')).toBe('2022-01-02');
	});

	it('prints the Bucharest day of a late-evening instant in summer, at UTC+3', () => {
		process.env['TZ'] = zone;
		expect(getFormattedDate('2022-07-01T20:59:00Z')).toBe('2022-07-01');
		expect(getFormattedDate('2022-07-01T21:00:00Z')).toBe('2022-07-02');
	});
});
