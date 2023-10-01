const getFormattedDate = (date: Date): string => {
	return new Intl.DateTimeFormat("ro-RO").format(date);
};

export { getFormattedDate };