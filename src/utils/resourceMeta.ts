export function getFormattedDate (date: Date | string): string {
	if (!date) return 'Malformed date';
	let d;
	if (typeof date === 'string') d = new Date(date);
	else d = date;
	// @TODO: find a better way to display the date as YYYY-MM-DD instead of using French Canadian locales
	return new Intl.DateTimeFormat(
		"fr-CA",
		{
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			timeZone: 'Europe/Bucharest'
		}
	).format(new Date(d));
};
